import datetime
import uuid

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Max, Min, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tracking.models import TrackingEvent, TrackingSession
from tracking.serializers import TrackingEventListSerializer


class ConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "idle_seconds": settings.TRACKING_IDLE_SECONDS,
            "heartbeat_seconds": settings.TRACKING_HEARTBEAT_SECONDS,
            "session_timeout_seconds": settings.TRACKING_SESSION_TIMEOUT_SECONDS,
            "event_flush_seconds": settings.TRACKING_EVENT_FLUSH_SECONDS,
        })


class TaskEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        from django.shortcuts import get_object_or_404  # noqa: PLC0415
        from task.lookups import resolve_task_lookup_kwargs  # noqa: PLC0415
        from task.models import Task  # noqa: PLC0415

        task = get_object_or_404(Task, **resolve_task_lookup_kwargs(task_id))
        task_id = task.pk
        ct = ContentType.objects.get(app_label='task', model='task')

        agg = TrackingEvent.objects.filter(
            user=request.user,
            content_type=ct,
            object_id=task_id,
        ).aggregate(
            open_count=Count('id', filter=Q(event_type='TASK_OPEN')),
            first_interaction_at=Min('occurred_at', filter=Q(event_type='FIRST_INTERACTION')),
            last_open_at=Max('occurred_at', filter=Q(event_type='TASK_OPEN')),
        )

        session_ids = TrackingEvent.objects.filter(
            user=request.user,
            content_type=ct,
            object_id=task_id,
        ).values_list('session_id', flat=True).distinct()

        total_active_seconds = (
            TrackingSession.objects.filter(id__in=session_ids)
            .aggregate(s=Sum('active_seconds'))['s'] or 0
        )

        return Response({
            'task_id': task_id,
            'open_count': agg['open_count'],
            'first_interaction_at': agg['first_interaction_at'],
            'last_open_at': agg['last_open_at'],
            'total_active_seconds': total_active_seconds,
        })


class _TrackingEventPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 500


def _parse_iso(value, param_name):
    try:
        dt = datetime.datetime.fromisoformat(value)
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        return dt
    except ValueError:
        raise ValidationError({param_name: f"Invalid ISO 8601 datetime: {value!r}"})


class TrackingEventListView(ListAPIView):
    """
    GET /api/tracking/events/

    At least one of: user, target_type+target_id, event_type, session is required.

    ?user=<id>                              filter by user; non-staff may only query own data
    ?target_type=<app.model>&target_id=<pk> filter by generic FK target
    ?event_type=<str>                       filter by event type
    ?session=<uuid>                         filter to a single session;
                                            since defaults to session.started_at
    ?since=<iso>                            default: now-30d (or session.started_at)
    ?until=<iso>                            default: now
    ?page_size=<n>                          page size, max 500
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TrackingEventListSerializer
    pagination_class = _TrackingEventPagination

    _FILTER_PARAMS = frozenset({'user', 'target_type', 'target_id', 'event_type', 'session'})

    def get_queryset(self):
        params = self.request.query_params

        if not (self._FILTER_PARAMS & set(params.keys())):
            raise ValidationError(
                "At least one filter is required: user, target_type+target_id, "
                "event_type, or session."
            )

        qs = (
            TrackingEvent.objects
            .select_related('session', 'user', 'content_type')
            .prefetch_related('target')
        )

        # --- session filter (resolve early; drives the since default) ---
        session_obj = None
        session_param = params.get('session')
        if session_param:
            try:
                session_obj = TrackingSession.objects.get(pk=uuid.UUID(session_param))
            except (ValueError, TrackingSession.DoesNotExist):
                raise ValidationError({"session": "Invalid or unknown session ID."})
            qs = qs.filter(session_id=session_param)

        # --- user filter / scope (always scope to caller unless staff) ---
        user_param = params.get('user')
        if user_param:
            if not self.request.user.is_staff and str(user_param) != str(self.request.user.pk):
                raise PermissionDenied("You may only query your own events.")
            qs = qs.filter(user_id=user_param)
        else:
            qs = qs.filter(user=self.request.user)

        # --- target_type + target_id (must appear together) ---
        target_type_str = params.get('target_type')
        target_id_str = params.get('target_id')
        if target_type_str or target_id_str:
            if not (target_type_str and target_id_str):
                raise ValidationError(
                    "target_type and target_id must be provided together."
                )
            try:
                app_label, model = target_type_str.split('.')
                ct = ContentType.objects.get(app_label=app_label, model=model)
            except (ValueError, ContentType.DoesNotExist):
                raise ValidationError(
                    {"target_type": f"Unknown content type: {target_type_str!r}"}
                )
            qs = qs.filter(content_type=ct, object_id=target_id_str)

        # --- event_type filter ---
        event_type = params.get('event_type')
        if event_type:
            qs = qs.filter(event_type=event_type)

        # --- time range ---
        now = timezone.now()
        # When a session filter is used, default since = session.started_at so that
        # events from sessions older than 30 days are not silently dropped.
        default_since = (
            session_obj.started_at if session_obj else now - datetime.timedelta(days=30)
        )
        since = _parse_iso(params['since'], 'since') if 'since' in params else default_since
        until = _parse_iso(params['until'], 'until') if 'until' in params else now

        return qs.filter(
            occurred_at__gte=since,
            occurred_at__lte=until,
        ).order_by('-occurred_at')
