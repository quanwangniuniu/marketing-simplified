from __future__ import annotations

from typing import Any
from types import SimpleNamespace
import uuid
from datetime import datetime, timedelta, date

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import generics, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from .services import get_calendar_events

from core.models import ProjectMember
from .models import (
    Calendar,
    CalendarShare,
    CalendarSubscription,
    Event,
    EventAttendee,
    RecurrenceException,
    EventReminder,
)
from .permissions import (
    IsAuthenticatedInOrganization,
    CalendarAccessPermission,
    EventAccessPermission,
    SubscriptionOwnerPermission,
    get_user_organization,
)
from .serializers import (
    CalendarSerializer,
    CalendarCreateUpdateSerializer,
    CalendarShareSerializer,
    CalendarShareRequestSerializer,
    CalendarSubscriptionSerializer,
    CalendarSubscriptionRequestSerializer,
    EventSerializer,
    EventCreateUpdateSerializer,
    EventAttendeeSerializer,
    AttendeeCreateRequestSerializer,
    AttendeeResponseRequestSerializer,
    EventReminderSerializer,
)
from .exceptions import calendar_error_response

from google_calendar_integration.tasks import export_event_to_google_task


class CalendarViewSet(viewsets.ModelViewSet):
    """
    Calendar CRUD aligned with `/calendars/` endpoints.

    - `list`: calendars owned by or shared with the user (optionally including subscriptions)
    - `create`: create new calendar for current user and organization
    - `retrieve/update/destroy`: calendar details, soft delete on destroy
    """

    serializer_class = CalendarSerializer
    permission_classes = [IsAuthenticatedInOrganization, CalendarAccessPermission]
    required_permission = "view_all"

    def initial(self, request, *args, **kwargs):
        if getattr(self, "action", None) in {"update", "partial_update", "destroy"}:
            self.required_permission = "manage"
        else:
            self.required_permission = "view_all"
        super().initial(request, *args, **kwargs)

    def get_queryset(self):
        user = self.request.user
        organization = get_user_organization(user)
        if not organization:
            return Calendar.objects.none()

        visibility = self.request.query_params.get("visibility")
        project_id_param = self.request.query_params.get("project_id")
        include_subscriptions_param = self.request.query_params.get("include_subscriptions", "true")
        include_subscriptions = include_subscriptions_param.lower() != "false"

        owned_qs = Calendar.objects.filter(
            organization=organization,
            owner=user,
            is_deleted=False,
        )

        shared_calendar_ids = CalendarShare.objects.filter(
            organization=organization,
            shared_with=user,
            is_deleted=False,
        ).values_list("calendar_id", flat=True)

        legacy_qs = Calendar.objects.filter(
            Q(pk__in=owned_qs.values_list("pk", flat=True))
            | Q(pk__in=shared_calendar_ids)
        ).filter(is_deleted=False, organization=organization)

        if include_subscriptions:
            subscribed_calendar_ids = CalendarSubscription.objects.filter(
                organization=organization,
                user=user,
                is_deleted=False,
                calendar__isnull=False,
            ).values_list("calendar_id", flat=True)
            legacy_qs = legacy_qs | Calendar.objects.filter(
                pk__in=subscribed_calendar_ids,
                organization=organization,
                is_deleted=False,
            )

        project_ids = ProjectMember.objects.filter(
            user=user,
            is_active=True,
        ).values_list("project_id", flat=True)
        project_qs = Calendar.objects.filter(
            project_id__in=project_ids,
            is_deleted=False,
        )

        qs = legacy_qs | project_qs

        if visibility:
            qs = qs.filter(visibility=visibility)

        if project_id_param:
            try:
                qs = qs.filter(project_id=int(project_id_param))
            except (TypeError, ValueError):
                return Calendar.objects.none()

        return qs.distinct().order_by("-is_primary", "name")

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return CalendarCreateUpdateSerializer
        return CalendarSerializer

    def perform_create(self, serializer):
        user = self.request.user
        organization = get_user_organization(user)
        if not organization:
            raise ValueError("Organization context is required to create calendars.")
        serializer.save(owner=user, organization=organization)

    def perform_destroy(self, instance: Calendar):
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted", "updated_at"])


class CalendarShareListCreateView(generics.ListCreateAPIView):
    """
    List and create calendar shares for a given calendar.
    """

    permission_classes = [IsAuthenticatedInOrganization, CalendarAccessPermission]
    required_permission = "manage"
    serializer_class = CalendarShareSerializer

    def get_calendar(self) -> Calendar:
        user = self.request.user
        organization = get_user_organization(user)
        calendar_id = self.kwargs["calendar_id"]
        calendar = get_object_or_404(
            Calendar, id=calendar_id, organization=organization, is_deleted=False
        )
        self.check_object_permissions(self.request, calendar)
        return calendar

    def get_queryset(self):
        calendar = self.get_calendar()
        return CalendarShare.objects.filter(
            organization=calendar.organization,
            calendar=calendar,
            is_deleted=False,
        )

    def get(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request, *args, **kwargs):
        calendar = self.get_calendar()

        request_serializer = CalendarShareRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        data = request_serializer.validated_data

        user_model = self.request.user.__class__
        shared_with = get_object_or_404(
            user_model,
            id=data["user_id"],
            organization_id=calendar.organization_id,
        )

        share, _created = CalendarShare.objects.update_or_create(
            organization=calendar.organization,
            calendar=calendar,
            shared_with=shared_with,
            defaults={
                "permission": data["permission"],
                "can_invite_others": data.get("can_invite_others", False),
            },
        )

        serializer = self.get_serializer(share)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CalendarShareDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a calendar share.
    """

    permission_classes = [IsAuthenticatedInOrganization, CalendarAccessPermission]
    required_permission = "manage"
    serializer_class = CalendarShareSerializer
    lookup_url_kwarg = "share_id"

    def get_object(self):
        user = self.request.user
        organization = get_user_organization(user)
        calendar_id = self.kwargs["calendar_id"]
        share_id = self.kwargs["share_id"]

        calendar = get_object_or_404(
            Calendar, id=calendar_id, organization=organization, is_deleted=False
        )
        self.check_object_permissions(self.request, calendar)

        share = get_object_or_404(
            CalendarShare,
            id=share_id,
            organization=organization,
            calendar=calendar,
            is_deleted=False,
        )
        return share

    def perform_destroy(self, instance: CalendarShare):
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted", "updated_at"])


class SubscriptionListCreateView(generics.ListCreateAPIView):
    """
    List and create calendar subscriptions.
    """

    permission_classes = [IsAuthenticatedInOrganization, IsAuthenticated]
    serializer_class = CalendarSubscriptionSerializer

    def get_queryset(self):
        user = self.request.user
        organization = get_user_organization(user)
        if not organization:
            return CalendarSubscription.objects.none()

        return CalendarSubscription.objects.filter(
            organization=organization,
            user=user,
            is_deleted=False,
        ).select_related("calendar")

    def get(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request, *args, **kwargs):
        user = self.request.user
        organization = get_user_organization(user)
        if not organization:
            return Response(
                {"error": "Organization context is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request_serializer = CalendarSubscriptionRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        data = request_serializer.validated_data

        calendar = None
        if "calendar_id" in data:
            calendar = get_object_or_404(
                Calendar,
                id=data["calendar_id"],
                organization=organization,
                is_deleted=False,
            )

        subscription, _created = CalendarSubscription.objects.update_or_create(
            organization=organization,
            user=user,
            calendar=calendar,
            source_url=data.get("source_url"),
            defaults={
                "color_override": data.get("color_override"),
                "is_hidden": data.get("is_hidden", False),
                "notification_enabled": data.get("notification_enabled", True),
            },
        )

        serializer = self.get_serializer(subscription)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SubscriptionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a subscription.
    """

    permission_classes = [IsAuthenticatedInOrganization, SubscriptionOwnerPermission]
    serializer_class = CalendarSubscriptionSerializer
    lookup_url_kwarg = "subscription_id"

    def get_object(self):
        user = self.request.user
        organization = get_user_organization(user)
        subscription_id = self.kwargs["subscription_id"]

        subscription = get_object_or_404(
            CalendarSubscription,
            id=subscription_id,
            organization=organization,
            is_deleted=False,
        )
        self.check_object_permissions(self.request, subscription)
        return subscription

    def patch(self, request, *args, **kwargs):
        subscription = self.get_object()

        partial_data = {
            key: request.data.get(key)
            for key in ["color_override", "is_hidden", "notification_enabled"]
            if key in request.data
        }
        for key, value in partial_data.items():
            setattr(subscription, key, value)
        subscription.save()

        serializer = self.get_serializer(subscription)
        return Response(serializer.data)

    def perform_destroy(self, instance: CalendarSubscription):
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted", "updated_at"])


class EventViewSet(viewsets.ModelViewSet):
    """
    Event CRUD aligned with `/events/` endpoints.
    """

    serializer_class = EventSerializer
    permission_classes = [IsAuthenticatedInOrganization, EventAccessPermission]
    required_permission = "view_all"

    def initial(self, request, *args, **kwargs):
        if getattr(self, "action", None) in {"create", "update", "partial_update", "destroy"}:
            self.required_permission = "edit"
        else:
            self.required_permission = "view_all"
        super().initial(request, *args, **kwargs)

    def get_queryset(self):
        user = self.request.user
        project_id_param = self.request.query_params.get("project_id")
        project_id = None
        if project_id_param:
            try:
                project_id = int(project_id_param)
            except (TypeError, ValueError):
                return Event.objects.none()

        calendars = _get_accessible_calendars(user, project_id=project_id)
        queryset = Event.objects.select_related("calendar", "created_by").filter(
            calendar__in=calendars,
            is_deleted=False,
        )

        calendar_ids_param = self.request.query_params.get("calendar_ids")
        if calendar_ids_param:
            calendar_ids = [cid for cid in calendar_ids_param.split(",") if cid]
            queryset = queryset.filter(calendar_id__in=calendar_ids)

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        event_type = self.request.query_params.get("event_type")
        if event_type:
            queryset = queryset.filter(event_type=event_type)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(location__icontains=search)
            )

        start_min = self.request.query_params.get("start_min")
        if start_min:
            queryset = queryset.filter(start_datetime__gte=start_min)

        start_max = self.request.query_params.get("start_max")
        if start_max:
            queryset = queryset.filter(start_datetime__lte=start_max)

        time_min = self.request.query_params.get("time_min")
        if time_min:
            queryset = queryset.filter(end_datetime__gt=time_min)

        time_max = self.request.query_params.get("time_max")
        if time_max:
            queryset = queryset.filter(start_datetime__lt=time_max)

        return queryset.order_by("start_datetime")

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return EventCreateUpdateSerializer
        return EventSerializer

    def create(self, request, *args, **kwargs):
        """
        Create event and return full Event representation (with id, calendar_id, etc.).
        """
        serializer = EventCreateUpdateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        target_calendar = get_object_or_404(
            Calendar,
            id=serializer.validated_data["calendar_id"],
            is_deleted=False,
        )
        perm = CalendarAccessPermission()
        self.required_permission = "edit"
        if not perm.has_object_permission(request, self, target_calendar):
            raise PermissionDenied("You do not have permission to create events on this calendar.")

        event = serializer.save(
            calendar=target_calendar,
            organization=target_calendar.organization,
            created_by=request.user if request.user.is_authenticated else None,
        )
        eid = str(event.id)
        transaction.on_commit(lambda: export_event_to_google_task.delay(eid))
        output_serializer = EventSerializer(event)
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        """
        Update event and return full Event representation.
        """
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        # ETag / If-Match handling (optimistic concurrency)
        if_match = request.META.get("HTTP_IF_MATCH")
        if if_match is not None and instance.etag and if_match != instance.etag:
            return calendar_error_response(
                error="PRECONDITION_FAILED",
                message="ETag mismatch. Resource has been modified.",
                status_code=status.HTTP_412_PRECONDITION_FAILED,
            )

        serializer = EventCreateUpdateSerializer(
            instance, data=request.data, partial=partial, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        event = serializer.save()
        eid = str(event.id)
        transaction.on_commit(lambda: export_event_to_google_task.delay(eid))
        output_serializer = EventSerializer(event)
        return Response(output_serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance: Event):
        eid = str(instance.id)
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted", "updated_at"])
        transaction.on_commit(lambda: export_event_to_google_task.delay(eid))


class EventSearchView(generics.ListAPIView):
    """
    Event search endpoint backed by the same Event model.
    """

    serializer_class = EventSerializer
    permission_classes = [IsAuthenticatedInOrganization, EventAccessPermission]

    def get_queryset(self):
        user = self.request.user
        project_id_param = self.request.query_params.get("project_id")
        project_id = None
        if project_id_param:
            try:
                project_id = int(project_id_param)
            except (TypeError, ValueError):
                return Event.objects.none()

        calendars = _get_accessible_calendars(user, project_id=project_id)
        queryset = Event.objects.select_related("calendar", "created_by").filter(
            calendar__in=calendars,
            is_deleted=False,
        )

        q = self.request.query_params.get("q")
        if not q or len(q.strip()) < 2:
            return Event.objects.none()
        q = q.strip()

        queryset = queryset.filter(
            Q(title__icontains=q)
            | Q(description__icontains=q)
            | Q(location__icontains=q)
        )

        calendar_ids_param = self.request.query_params.get("calendar_ids")
        if calendar_ids_param:
            calendar_ids = [cid for cid in calendar_ids_param.split(",") if cid]
            queryset = queryset.filter(calendar_id__in=calendar_ids)

        time_min = self.request.query_params.get("time_min")
        if time_min:
            queryset = queryset.filter(end_datetime__gt=time_min)

        time_max = self.request.query_params.get("time_max")
        if time_max:
            queryset = queryset.filter(start_datetime__lt=time_max)

        return queryset.order_by("start_datetime")


def _parse_iso_datetime(value: str):
    dt = parse_datetime(value)
    if dt is None:
        raise ValueError("Invalid datetime format")
    if timezone.is_naive(dt):
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _parse_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except Exception:
        raise ValueError("Invalid date format, expected YYYY-MM-DD")


def _get_accessible_calendars(
    user,
    calendar_ids: list[str] | None = None,
    project_id: int | None = None,
):
    organization = get_user_organization(user)
    qs = Calendar.objects.none()

    if organization:
        owned = Calendar.objects.filter(
            organization=organization,
            owner=user,
            is_deleted=False,
        )
        shared_ids = CalendarShare.objects.filter(
            organization=organization,
            shared_with=user,
            is_deleted=False,
        ).values_list("calendar_id", flat=True)
        subscribed_ids = CalendarSubscription.objects.filter(
            organization=organization,
            user=user,
            is_deleted=False,
            calendar__isnull=False,
            is_hidden=False,
        ).values_list("calendar_id", flat=True)

        legacy_qs = Calendar.objects.filter(
            organization=organization,
            is_deleted=False,
        ).filter(
            Q(pk__in=owned.values_list("pk", flat=True))
            | Q(pk__in=shared_ids)
            | Q(pk__in=subscribed_ids)
        )
        qs = qs | legacy_qs

    project_ids = ProjectMember.objects.filter(
        user=user,
        is_active=True,
    ).values_list("project_id", flat=True)
    project_qs = Calendar.objects.filter(
        project_id__in=project_ids,
        is_deleted=False,
    )
    qs = qs | project_qs

    if calendar_ids:
        qs = qs.filter(id__in=calendar_ids)
    if project_id is not None:
        qs = qs.filter(project_id=project_id)

    return qs.distinct()


def _build_calendar_view_payload(
    user,
    start_dt,
    end_dt,
    calendar_ids: list[str] | None,
    project_id: int | None,
    view_type: str,
):
    calendars = _get_accessible_calendars(user, calendar_ids, project_id=project_id)
    if not calendars.exists():
        return {
            "view_type": view_type,
            "start_date": start_dt.isoformat().replace("+00:00", "Z"),
            "end_date": end_dt.isoformat().replace("+00:00", "Z"),
            "events": [],
            "calendars": [],
        }

    events_qs = (
        Event.objects.select_related("calendar", "created_by", "recurrence_rule")
        .filter(
            calendar__in=calendars,
            is_deleted=False,
            start_datetime__lt=end_dt,
            end_datetime__gt=start_dt,
        )
    )

    instances: list[Any] = []
    for ev in events_qs:
        if ev.is_recurring and ev.recurrence_rule_id:
            instances.extend(_expand_recurring_event(ev, start_dt, end_dt))
        else:
            instances.append(ev)

    events_data = EventSerializer(instances, many=True).data

    # Query the CalendarEvent automatically generated by the system (from Task / Decision)
    from .models import CalendarEvent
    from .serializers import CalendarEventSerializer

    organization = get_user_organization(user)
    derived_qs = CalendarEvent.objects.filter(
        organization=organization,
        start_time__lt=end_dt,
        end_time__gt=start_dt,
        is_deleted=False,
    )
    derived_data = CalendarEventSerializer(derived_qs, many=True).data

    # Combine two types of events
    events_data = list(events_data) + list(derived_data)
    calendars_data = CalendarSerializer(calendars, many=True).data

    return {
        "view_type": view_type,
        "start_date": start_dt.isoformat().replace("+00:00", "Z"),
        "end_date": end_dt.isoformat().replace("+00:00", "Z"),
        "events": events_data,
        "calendars": calendars_data,
    }


def _expand_recurring_event(
    event: Event,
    time_min,
    time_max,
    max_results: int = 250,
):
    """
    Expand a recurring event into concrete instances within [time_min, time_max).
    Currently supports simple DAILY and WEEKLY patterns based on start_datetime.
    """
    if not event.is_recurring or not event.recurrence_rule_id:
        return []

    rule = event.recurrence_rule
    frequency = rule.frequency
    interval = max(int(rule.interval or 1), 1)

    duration = event.end_datetime - event.start_datetime
    instances: list[Any] = []

    # Load exceptions for this event/rule within range
    exceptions = RecurrenceException.objects.filter(
        organization=event.organization,
        recurrence_rule=rule,
        original_event=event,
        exception_date__gte=time_min,
        exception_date__lt=time_max,
    ).select_related("modified_event")
    exceptions_by_date = {exc.exception_date: exc for exc in exceptions}

    current = event.start_datetime

    # Fast-forward to first occurrence that could intersect [time_min, time_max)
    if frequency == "DAILY":
        step = timezone.timedelta(days=interval)
    elif frequency == "WEEKLY":
        step = timezone.timedelta(weeks=interval)
    else:
        # For now only basic DAILY/WEEKLY patterns are supported in expansion.
        return []

    while current + duration <= time_max and len(instances) < max_results:
        # Check intersection with requested window
        if current < time_max and (current + duration) > time_min:
            exc = exceptions_by_date.get(current)
            if exc:
                if exc.is_cancelled:
                    # Skip cancelled instance
                    pass
                else:
                    # Use modified event instance
                    instances.append(exc.modified_event)
            else:
                # Create a lightweight instance based on the master event
                attrs = {}
                for field in Event._meta.fields:
                    name = field.name
                    attrs[name] = getattr(event, name)

                # Override fields specific to this occurrence
                attrs["id"] = event.id  # master id; original_start differentiates instances
                attrs["start_datetime"] = current
                attrs["end_datetime"] = current + duration
                attrs["original_start"] = current

                instance_obj = SimpleNamespace(**attrs)
                instances.append(instance_obj)

        current = current + step

    return instances


class EventInstancesView(generics.ListAPIView):
    """
    Return expanded instances for a recurring event.
    """

    serializer_class = EventSerializer
    permission_classes = [IsAuthenticatedInOrganization, EventAccessPermission]

    def get(self, request, *args, **kwargs):
        event_id = self.kwargs["event_id"]
        event = get_object_or_404(
            Event,
            id=event_id,
            is_deleted=False,
        )

        # Object-level permission
        perm = EventAccessPermission()
        setattr(self, "required_permission", "view_all")
        if not perm.has_object_permission(request, self, event):
            raise PermissionDenied("You do not have access to this event.")

        time_min_raw = request.query_params.get("time_min")
        time_max_raw = request.query_params.get("time_max")
        max_results_raw = request.query_params.get("max_results")

        if not time_min_raw or not time_max_raw:
            return Response(
                {"detail": "time_min and time_max are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            time_min = _parse_iso_datetime(time_min_raw)
            time_max = _parse_iso_datetime(time_max_raw)
        except ValueError:
            return Response(
                {"detail": "Invalid datetime format for time_min or time_max."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if time_min >= time_max:
            return Response(
                {"detail": "time_min must be earlier than time_max."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_results = 250
        if max_results_raw is not None:
            try:
                max_results = max(min(int(max_results_raw), 2500), 1)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "max_results must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        instances = _expand_recurring_event(event, time_min, time_max, max_results)
        serializer = self.get_serializer(instances, many=True)
        return Response(serializer.data)


class DayView(generics.GenericAPIView):
    """
    Day view: events for a specific date.
    """

    permission_classes = [IsAuthenticatedInOrganization]

    def get(self, request, *args, **kwargs):
        date_str = request.query_params.get("date")
        if not date_str:
            return calendar_error_response(
                "BAD_REQUEST",
                "date query parameter is required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            d = _parse_date(date_str)
        except ValueError as exc:
            return calendar_error_response(
                "INVALID_DATETIME",
                str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        start_dt = timezone.make_aware(datetime.combine(d, datetime.min.time()), timezone.utc)
        end_dt = start_dt + timedelta(days=1)

        calendar_ids_param = request.query_params.get("calendar_ids")
        calendar_ids = calendar_ids_param.split(",") if calendar_ids_param else None
        project_id_param = request.query_params.get("project_id")
        project_id = int(project_id_param) if project_id_param and project_id_param.isdigit() else None

        payload = _build_calendar_view_payload(
            request.user,
            start_dt,
            end_dt,
            calendar_ids,
            project_id,
            view_type="day",
        )
        if isinstance(payload, Response):
            return payload
        return Response(payload)


class WeekView(generics.GenericAPIView):
    """
    Week view starting from start_date.
    """

    permission_classes = [IsAuthenticatedInOrganization]

    def get(self, request, *args, **kwargs):
        start_str = request.query_params.get("start_date")
        if not start_str:
            return calendar_error_response(
                "BAD_REQUEST",
                "start_date query parameter is required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            d = _parse_date(start_str)
        except ValueError as exc:
            return calendar_error_response(
                "INVALID_DATETIME",
                str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        start_dt = timezone.make_aware(datetime.combine(d, datetime.min.time()), timezone.utc)
        end_dt = start_dt + timedelta(days=7)

        calendar_ids_param = request.query_params.get("calendar_ids")
        calendar_ids = calendar_ids_param.split(",") if calendar_ids_param else None
        project_id_param = request.query_params.get("project_id")
        project_id = int(project_id_param) if project_id_param and project_id_param.isdigit() else None

        payload = _build_calendar_view_payload(
            request.user,
            start_dt,
            end_dt,
            calendar_ids,
            project_id,
            view_type="week",
        )
        if isinstance(payload, Response):
            return payload
        return Response(payload)


class MonthView(generics.GenericAPIView):
    """
    Month view for a given year and month.
    """

    permission_classes = [IsAuthenticatedInOrganization]

    def get(self, request, *args, **kwargs):
        year_str = request.query_params.get("year")
        month_str = request.query_params.get("month")
        if not year_str or not month_str:
            return calendar_error_response(
                "BAD_REQUEST",
                "year and month query parameters are required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            year = int(year_str)
            month = int(month_str)
            d = date(year=year, month=month, day=1)
        except Exception:
            return calendar_error_response(
                "BAD_REQUEST",
                "Invalid year or month.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        start_dt = timezone.make_aware(datetime.combine(d, datetime.min.time()), timezone.utc)
        # next month
        if month == 12:
            next_month = date(year=year + 1, month=1, day=1)
        else:
            next_month = date(year=year, month=month + 1, day=1)
        end_dt = timezone.make_aware(datetime.combine(next_month, datetime.min.time()), timezone.utc)

        calendar_ids_param = request.query_params.get("calendar_ids")
        calendar_ids = calendar_ids_param.split(",") if calendar_ids_param else None
        project_id_param = request.query_params.get("project_id")
        project_id = int(project_id_param) if project_id_param and project_id_param.isdigit() else None

        payload = _build_calendar_view_payload(
            request.user,
            start_dt,
            end_dt,
            calendar_ids,
            project_id,
            view_type="month",
        )
        if isinstance(payload, Response):
            return payload
        return Response(payload)


class AgendaView(generics.GenericAPIView):
    """
    Agenda view for an arbitrary datetime range.
    """

    permission_classes = [IsAuthenticatedInOrganization]

    def get(self, request, *args, **kwargs):
        start_raw = request.query_params.get("start_date")
        end_raw = request.query_params.get("end_date")
        if not start_raw:
            return calendar_error_response(
                "BAD_REQUEST",
                "start_date query parameter is required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            start_dt = _parse_iso_datetime(start_raw)
            if end_raw:
                end_dt = _parse_iso_datetime(end_raw)
            else:
                end_dt = start_dt + timedelta(days=7)
        except ValueError as exc:
            return calendar_error_response(
                "INVALID_DATETIME",
                str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        calendar_ids_param = request.query_params.get("calendar_ids")
        calendar_ids = calendar_ids_param.split(",") if calendar_ids_param else None
        project_id_param = request.query_params.get("project_id")
        project_id = int(project_id_param) if project_id_param and project_id_param.isdigit() else None

        payload = _build_calendar_view_payload(
            request.user,
            start_dt,
            end_dt,
            calendar_ids,
            project_id,
            view_type="agenda",
        )
        if isinstance(payload, Response):
            return payload

        # Apply optional limit
        limit_raw = request.query_params.get("limit")
        if limit_raw and isinstance(payload.get("events"), list):
            try:
                limit = max(1, min(int(limit_raw), 500))
                payload["events"] = payload["events"][:limit]
            except (TypeError, ValueError):
                pass

        return Response(payload)


class EventAttendeeListCreateView(generics.ListCreateAPIView):
    """
    List and add attendees for a specific event.
    """

    serializer_class = EventAttendeeSerializer
    permission_classes = [IsAuthenticatedInOrganization]

    def _get_event(self) -> Event:
        event_id = self.kwargs["event_id"]
        event = get_object_or_404(
            Event,
            id=event_id,
            is_deleted=False,
        )

        # Object-level permission via EventAccessPermission
        perm = EventAccessPermission()
        setattr(self, "required_permission", "view_all")
        if not perm.has_object_permission(self.request, self, event):
            raise PermissionDenied("You do not have access to this event.")

        return event

    def get_queryset(self):
        event = self._get_event()
        return (
            event.attendees.select_related("user")
            .filter(is_deleted=False)
            .order_by("-is_organizer", "attendee_type", "email")
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        event = self._get_event()

        # Adding attendees requires edit permission
        perm = EventAccessPermission()
        setattr(self, "required_permission", "edit")
        if not perm.has_object_permission(self.request, self, event):
            raise PermissionDenied("You do not have permission to modify attendees.")

        req_serializer = AttendeeCreateRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)
        data = req_serializer.validated_data

        user = None
        email = data.get("email")

        if data.get("user_id"):
            user_model = self.request.user.__class__
            user_queryset = user_model.objects.filter(id=data["user_id"])
            if not event.calendar.project_id:
                user_queryset = user_queryset.filter(organization_id=event.organization_id)
            user = get_object_or_404(user_queryset)
            if not email:
                email = user.email

        attendee = EventAttendee(
            organization=event.organization,
            event=event,
            user=user,
            email=email,
            display_name=data.get("display_name") or "",
            attendee_type=data.get("attendee_type", "required"),
        )
        attendee.save()

        serializer = self.get_serializer(attendee)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class EventAttendeeDetailView(generics.DestroyAPIView):
    """
    Remove an attendee from an event.
    """

    permission_classes = [IsAuthenticatedInOrganization]
    serializer_class = EventAttendeeSerializer
    lookup_url_kwarg = "attendee_id"

    def _get_event(self) -> Event:
        event_id = self.kwargs["event_id"]
        event = get_object_or_404(
            Event,
            id=event_id,
            is_deleted=False,
        )

        perm = EventAccessPermission()
        setattr(self, "required_permission", "edit")
        if not perm.has_object_permission(self.request, self, event):
            raise PermissionDenied("You do not have permission to modify attendees.")

        return event

    def get_object(self):
        event = self._get_event()
        attendee_id = self.kwargs["attendee_id"]
        attendee = get_object_or_404(
            EventAttendee,
            id=attendee_id,
            organization=event.organization,
            event=event,
            is_deleted=False,
        )
        return attendee

    def perform_destroy(self, instance: EventAttendee):
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted", "updated_at"])


class EventRSVPView(generics.GenericAPIView):
    """
    RSVP endpoint for the authenticated user.
    """

    serializer_class = AttendeeResponseRequestSerializer
    permission_classes = [IsAuthenticatedInOrganization]

    def _get_event(self) -> Event:
        event_id = self.kwargs["event_id"]
        event = get_object_or_404(
            Event,
            id=event_id,
            is_deleted=False,
        )

        perm = EventAccessPermission()
        setattr(self, "required_permission", "view_all")
        if not perm.has_object_permission(self.request, self, event):
            raise PermissionDenied("You do not have access to this event.")

        return event

    def post(self, request, *args, **kwargs):
        event = self._get_event()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user

        attendee = (
            EventAttendee.objects.filter(
                organization=event.organization,
                event=event,
                user=user,
                is_deleted=False,
            )
            .select_related("user")
            .first()
        )

        if not attendee:
            attendee = EventAttendee(
                organization=event.organization,
                event=event,
                user=user,
                email=getattr(user, "email", None),
                attendee_type="required",
            )

        attendee.response_status = data["response_status"]
        attendee.response_comment = data.get("response_comment") or ""
        attendee.save()

        output = EventAttendeeSerializer(attendee)
        return Response(output.data, status=status.HTTP_200_OK)


class EventInstanceModifyView(generics.GenericAPIView):
    """
    Modify a specific instance of a recurring event.
    """

    serializer_class = EventCreateUpdateSerializer
    permission_classes = [IsAuthenticatedInOrganization, EventAccessPermission]

    def _get_event(self, request, *args, **kwargs) -> Event:
        event_id = self.kwargs["event_id"]
        event = get_object_or_404(
            Event,
            id=event_id,
            is_deleted=False,
        )

        perm = EventAccessPermission()
        setattr(self, "required_permission", "edit")
        if not perm.has_object_permission(request, self, event):
            raise PermissionDenied("You do not have permission to modify this event.")

        if not event.is_recurring or not event.recurrence_rule_id:
            raise PermissionDenied("Event is not recurring.")

        return event

    def patch(self, request, *args, **kwargs):
        event = self._get_event(request, *args, **kwargs)

        original_start_raw = request.query_params.get("original_start")
        if not original_start_raw:
            return Response(
                {"detail": "original_start query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            original_start = _parse_iso_datetime(original_start_raw)
        except ValueError:
            return Response(
                {"detail": "Invalid datetime format for original_start."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find existing exception (if any)
        exc = (
            RecurrenceException.objects.filter(
                organization=event.organization,
                recurrence_rule=event.recurrence_rule,
                original_event=event,
                exception_date=original_start,
            )
            .select_related("modified_event")
            .first()
        )

        modified_event = None
        if exc and not exc.is_cancelled:
            modified_event = exc.modified_event
        else:
            # Create a cloned one-off event for this instance
            cloned = Event.objects.get(pk=event.pk)
            cloned.pk = None
            cloned.id = uuid.uuid4()
            cloned.is_recurring = False
            cloned.recurrence_rule = None
            cloned.original_start = original_start
            duration = event.end_datetime - event.start_datetime
            cloned.start_datetime = original_start
            cloned.end_datetime = original_start + duration
            cloned.ical_uid = None
            cloned.is_deleted = False
            cloned.save()

            modified_event = cloned

            # Create or update exception record
            if exc:
                exc.is_cancelled = False
                exc.modified_event = modified_event
                exc.exception_date = original_start
                exc.organization = event.organization
                exc.recurrence_rule = event.recurrence_rule
                exc.original_event = event
                exc.save()
            else:
                RecurrenceException.objects.create(
                    organization=event.organization,
                    recurrence_rule=event.recurrence_rule,
                    original_event=event,
                    exception_date=original_start,
                    is_cancelled=False,
                    modified_event=modified_event,
                )

        # Apply patch data to the modified_event using EventCreateUpdateSerializer
        serializer = EventCreateUpdateSerializer(
            modified_event,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        modified_event = serializer.save()

        output = EventSerializer(modified_event)
        return Response(output.data, status=status.HTTP_200_OK)


class EventInstanceCancelView(generics.GenericAPIView):
    """
    Cancel (delete) a specific instance of a recurring event.
    """

    permission_classes = [IsAuthenticatedInOrganization, EventAccessPermission]

    def _get_event(self, request, *args, **kwargs) -> Event:
        event_id = self.kwargs["event_id"]
        event = get_object_or_404(
            Event,
            id=event_id,
            is_deleted=False,
        )

        perm = EventAccessPermission()
        setattr(self, "required_permission", "edit")
        if not perm.has_object_permission(request, self, event):
            raise PermissionDenied("You do not have permission to modify this event.")

        if not event.is_recurring or not event.recurrence_rule_id:
            raise PermissionDenied("Event is not recurring.")

        return event

    def delete(self, request, *args, **kwargs):
        event = self._get_event(request, *args, **kwargs)

        original_start_raw = request.query_params.get("original_start")
        if not original_start_raw:
            return Response(
                {"detail": "original_start query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            original_start = _parse_iso_datetime(original_start_raw)
        except ValueError:
            return Response(
                {"detail": "Invalid datetime format for original_start."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exc = (
            RecurrenceException.objects.filter(
                organization=event.organization,
                recurrence_rule=event.recurrence_rule,
                original_event=event,
                exception_date=original_start,
            )
            .select_related("modified_event")
            .first()
        )

        if exc:
            # Soft delete any existing modified_event and mark exception as cancelled
            if exc.modified_event_id:
                exc.modified_event.is_deleted = True
                exc.modified_event.save(update_fields=["is_deleted", "updated_at"])
            exc.modified_event = None
            exc.is_cancelled = True
            exc.save()
        else:
            RecurrenceException.objects.create(
                organization=event.organization,
                recurrence_rule=event.recurrence_rule,
                original_event=event,
                exception_date=original_start,
                is_cancelled=True,
                modified_event=None,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class FreeBusyView(generics.GenericAPIView):
    """
    Free/busy info for calendars within a time range.
    """

    permission_classes = [IsAuthenticatedInOrganization]

    def post(self, request, *args, **kwargs):
        body = request.data or {}

        time_min_raw = body.get("time_min")
        time_max_raw = body.get("time_max")
        if not time_min_raw or not time_max_raw:
            return calendar_error_response(
                "BAD_REQUEST",
                "time_min and time_max are required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            time_min = _parse_iso_datetime(time_min_raw)
            time_max = _parse_iso_datetime(time_max_raw)
        except ValueError as exc:
            return calendar_error_response(
                "INVALID_DATETIME",
                str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if time_min >= time_max:
            return calendar_error_response(
                "BAD_REQUEST",
                "time_min must be earlier than time_max.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        calendar_ids = body.get("calendar_ids") or []
        if isinstance(calendar_ids, str):
            calendar_ids = [calendar_ids]
        project_id_raw = body.get("project_id")
        project_id = int(project_id_raw) if str(project_id_raw).isdigit() else None

        calendars = _get_accessible_calendars(request.user, calendar_ids or None, project_id=project_id)

        result = {
            "time_min": time_min.isoformat().replace("+00:00", "Z"),
            "time_max": time_max.isoformat().replace("+00:00", "Z"),
            "calendars": {},
        }

        for cal in calendars:
            events_qs = (
                Event.objects.filter(
                    calendar=cal,
                    is_deleted=False,
                    start_datetime__lt=time_max,
                    end_datetime__gt=time_min,
                )
                .select_related("recurrence_rule")
            )

            intervals = []
            for ev in events_qs:
                if ev.is_recurring and ev.recurrence_rule_id:
                    instances = _expand_recurring_event(ev, time_min, time_max)
                    for inst in instances:
                        intervals.append(
                            [
                                getattr(inst, "start_datetime"),
                                getattr(inst, "end_datetime"),
                            ]
                        )
                else:
                    intervals.append([ev.start_datetime, ev.end_datetime])

            # Merge overlapping intervals
            intervals = sorted(intervals, key=lambda x: x[0])
            merged = []
            for start, end in intervals:
                if not merged:
                    merged.append([start, end])
                else:
                    last_start, last_end = merged[-1]
                    if start <= last_end:
                        merged[-1][1] = max(last_end, end)
                    else:
                        merged.append([start, end])

            busy = [
                {
                    "start": s.isoformat().replace("+00:00", "Z"),
                    "end": e.isoformat().replace("+00:00", "Z"),
                }
                for s, e in merged
            ]

            result["calendars"][str(cal.id)] = {
                "busy": busy,
                "errors": [],
            }

        return Response(result, status=status.HTTP_200_OK)


class EventReminderListCreateView(generics.ListCreateAPIView):
    """
    List and add reminders for a specific event.
    """

    serializer_class = EventReminderSerializer
    permission_classes = [IsAuthenticatedInOrganization]

    def _get_event(self) -> Event:
        event_id = self.kwargs["event_id"]
        event = get_object_or_404(
            Event,
            id=event_id,
            is_deleted=False,
        )

        perm = EventAccessPermission()
        # Listing reminders requires view_all
        setattr(self, "required_permission", "view_all")
        if not perm.has_object_permission(self.request, self, event):
            raise PermissionDenied("You do not have access to this event.")

        return event

    def get_queryset(self):
        event = self._get_event()
        return event.reminders.select_related("user").filter(is_deleted=False).order_by("scheduled_time")

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        event = self._get_event()

        # Creating reminders requires edit permission
        perm = EventAccessPermission()
        setattr(self, "required_permission", "edit")
        if not perm.has_object_permission(self.request, self, event):
            raise PermissionDenied("You do not have permission to modify reminders.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reminder = serializer.save(
            organization=event.organization,
            event=event,
            user=request.user if request.user.is_authenticated else None,
        )

        output = self.get_serializer(reminder)
        return Response(output.data, status=status.HTTP_201_CREATED)

# SMP-407
from .models import CalendarEvent
from .serializers import CalendarEventSerializer

class CalendarEventListView(generics.ListAPIView):
    """
    Read-only endpoint for system-derived calendar events.
    Events are auto-generated from Decisions and Tasks.
    Supports filtering by date range, event type, owner, and project.
    No mutation is allowed — this API is GET only.
    """

    serializer_class = CalendarEventSerializer
    permission_classes = [IsAuthenticatedInOrganization]

    def get_queryset(self):
        user = self.request.user
        organization = get_user_organization(user)
        if not organization:
            return CalendarEvent.objects.none()

        return get_calendar_events(
            organization=organization,
            start=self.request.query_params.get('start'),
            end=self.request.query_params.get('end'),
            event_type=self.request.query_params.get('event_type'),
            project_id=self.request.query_params.get('project_id'),
        )