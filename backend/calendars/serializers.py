from __future__ import annotations

import re
from datetime import timezone as dt_timezone
from typing import Any

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from core.models import Organization
from .permissions import get_user_organization
from .models import (
    BookingLink,
    Calendar,
    CalendarShare,
    CalendarSubscription,
    Event,
    EventAttendee,
    EventReminder,
    EventCategory,
    EventCategoryAssignment,
    CalendarSettings,
    Notification,
    RecurrenceRule,
)


User = get_user_model()


class UserSummarySerializer(serializers.ModelSerializer):
    """
    Minimal user representation matching the Calendar OpenAPI `User` schema.
    """

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "username", "full_name"]
        read_only_fields = fields

    def get_full_name(self, obj: User) -> str:
        get_full_name = getattr(obj, "get_full_name", None)
        if callable(get_full_name):
            value = get_full_name() or ""
            if value:
                return value
        return getattr(obj, "full_name", "") or ""


class OrganizationField(serializers.PrimaryKeyRelatedField):
    """
    Read-only organization ID exposure.
    """

    def to_representation(self, value: Organization) -> Any:
        return str(value.pk)


class CalendarSerializer(serializers.ModelSerializer):
    """
    Calendar resource serializer.
    Used for both read and write; owner/organization are derived from request.
    """

    organization_id = OrganizationField(source="organization", read_only=True)
    project_id = serializers.IntegerField(read_only=True, allow_null=True)
    owner = UserSummarySerializer(read_only=True)

    class Meta:
        model = Calendar
        fields = [
            "id",
            "organization_id",
            "project_id",
            "owner",
            "name",
            "description",
            "color",
            "visibility",
            "timezone",
            "is_primary",
            "location",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization_id", "project_id", "owner", "created_at", "updated_at"]


class CalendarCreateUpdateSerializer(CalendarSerializer):
    """
    Explicit serializer for create/update to make intent clear in views.
    """

    class Meta(CalendarSerializer.Meta):
        read_only_fields = ["id", "organization_id", "owner", "created_at", "updated_at"]


class CalendarShareSerializer(serializers.ModelSerializer):
    """
    Calendar sharing representation.
    """

    calendar_id = serializers.UUIDField(read_only=True)
    shared_with = UserSummarySerializer(read_only=True)

    class Meta:
        model = CalendarShare
        fields = [
            "id",
            "calendar_id",
            "shared_with",
            "permission",
            "can_invite_others",
            "notification_enabled",
            "created_at",
        ]
        read_only_fields = ["id", "calendar_id", "shared_with", "created_at"]


class CalendarShareRequestSerializer(serializers.Serializer):
    """
    Request body for creating/updating shares.
    Matches `CalendarShareRequest` semantics in OpenAPI.
    """

    user_id = serializers.IntegerField()
    permission = serializers.ChoiceField(choices=[c[0] for c in CalendarShare.PERMISSION_CHOICES])
    can_invite_others = serializers.BooleanField(required=False, default=False)


class CalendarSubscriptionSerializer(serializers.ModelSerializer):
    """
    Subscription representation for list/detail responses.
    """

    user = UserSummarySerializer(read_only=True)
    calendar = CalendarSerializer(read_only=True)

    class Meta:
        model = CalendarSubscription
        fields = [
            "id",
            "user",
            "calendar",
            "source_url",
            "color_override",
            "is_hidden",
            "notification_enabled",
            "created_at",
        ]
        read_only_fields = ["id", "user", "calendar", "created_at"]


class CalendarSubscriptionRequestSerializer(serializers.Serializer):
    """
    Request body for creating subscriptions.
    """

    calendar_id = serializers.UUIDField(required=False)
    source_url = serializers.URLField(required=False)
    color_override = serializers.RegexField(
        regex=r"^#[0-9A-Fa-f]{6}$",
        required=False,
        allow_null=True,
    )
    is_hidden = serializers.BooleanField(required=False)
    notification_enabled = serializers.BooleanField(required=False)

    def validate(self, attrs: dict) -> dict:
        calendar_id = attrs.get("calendar_id")
        source_url = attrs.get("source_url")
        if not calendar_id and not source_url:
            raise serializers.ValidationError(
                "Either calendar_id or source_url must be provided."
            )
        if calendar_id and source_url:
            raise serializers.ValidationError(
                "Provide only one of calendar_id or source_url (not both)."
            )
        return attrs


class RecurrenceRuleSerializer(serializers.ModelSerializer):
    """
    Server-side recurrence rule representation.
    """

    class Meta:
        model = RecurrenceRule
        fields = [
            "id",
            "frequency",
            "interval",
            "by_day",
            "by_month_day",
            "by_set_pos",
            "by_month",
            "count",
            "until",
            "exception_dates",
            "rrule_string",
        ]
        read_only_fields = ["id", "rrule_string"]


class RecurrenceRuleInputSerializer(serializers.ModelSerializer):
    """
    Input-only serializer for recurrence rules.
    """

    class Meta:
        model = RecurrenceRule
        fields = [
            "frequency",
            "interval",
            "by_day",
            "by_month_day",
            "by_set_pos",
            "by_month",
            "count",
            "until",
            "exception_dates",
        ]


class EventSerializer(serializers.ModelSerializer):
    """
    Event representation for list/detail.
    """

    organization_id = OrganizationField(source="organization", read_only=True)
    calendar_id = serializers.UUIDField(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    recurrence_rule = RecurrenceRuleSerializer(read_only=True)
    etag = serializers.CharField(read_only=True)

    class Meta:
        model = Event
        fields = [
            "id",
            "organization_id",
            "calendar_id",
            "created_by",
            "title",
            "description",
            "start_datetime",
            "end_datetime",
            "timezone",
            "is_all_day",
            "location",
            "location_lat",
            "location_lng",
            "status",
            "event_type",
            "color",
            "visibility",
            "is_recurring",
            "recurrence_rule",
            "original_start",
            "has_conference",
            "conference_data",
            "guests_can_modify",
            "guests_can_invite_others",
            "guests_can_see_other_guests",
            "attachments",
            "metadata",
            "ical_uid",
            "etag",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization_id",
            "calendar_id",
            "created_by",
            "recurrence_rule",
            "ical_uid",
            "etag",
            "created_at",
            "updated_at",
        ]


class EventCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for event create/update requests.
    It accepts a recurrence pattern payload that is translated into RecurrenceRule.
    """

    recurrence = RecurrenceRuleInputSerializer(
        write_only=True, required=False, allow_null=True
    )
    calendar_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = Event
        fields = [
            "calendar_id",
            "title",
            "description",
            "start_datetime",
            "end_datetime",
            "timezone",
            "is_all_day",
            "location",
            "location_lat",
            "location_lng",
            "status",
            "event_type",
            "color",
            "visibility",
            "is_recurring",
            "recurrence",
            "original_start",
            "has_conference",
            "conference_data",
            "guests_can_modify",
            "guests_can_invite_others",
            "guests_can_see_other_guests",
            "attachments",
            "metadata",
        ]

    def validate(self, attrs: dict) -> dict:
        is_recurring = attrs.get("is_recurring")
        recurrence = attrs.get("recurrence")
        if recurrence and is_recurring is None:
            attrs["is_recurring"] = True
            is_recurring = True

        if is_recurring and not recurrence:
            raise serializers.ValidationError(
                {"recurrence": "Recurring events must include recurrence pattern data."}
            )
        if is_recurring is False and recurrence:
            raise serializers.ValidationError(
                {"recurrence": "Non-recurring events must not include recurrence data."}
            )
        return attrs

    def _ensure_calendar(self, calendar_id, organization: Organization | None = None) -> Calendar:
        try:
            queryset = Calendar.objects.filter(id=calendar_id, is_deleted=False)
            if organization is not None:
                queryset = queryset.filter(organization=organization)
            return queryset.get()
        except Calendar.DoesNotExist:
            raise serializers.ValidationError(
                {"calendar_id": "Calendar not found."}
            )

    def _normalize_recurrence_bounds(self, recurrence_data: dict) -> dict:
        """
        Keep count/until mutually exclusive per RecurrenceRule constraint.
        """
        data = dict(recurrence_data)
        if data.get("count") is not None:
            data["until"] = None
        elif data.get("until") is not None:
            data["count"] = None
        else:
            data["count"] = None
            data["until"] = None
        return data

    def _create_or_update_recurrence_rule(
        self, organization: Organization, recurrence_data: dict | None
    ) -> RecurrenceRule | None:
        if not recurrence_data:
            return None
        rule = RecurrenceRule(
            organization=organization,
            **self._normalize_recurrence_bounds(recurrence_data),
        )
        rule.save()
        return rule

    def create(self, validated_data: dict) -> Event:
        recurrence_data = validated_data.pop("recurrence", None)
        validated_data.pop("is_recurring", None)
        calendar_id = validated_data.pop("calendar_id")
        calendar = validated_data.pop("calendar", None) or self._ensure_calendar(calendar_id)
        organization = validated_data.pop("organization", None) or calendar.organization

        request = self.context.get("request")
        user = validated_data.pop("created_by", None)
        if user is None:
            request_user = getattr(request, "user", None)
            user = request_user if request_user and request_user.is_authenticated else None

        recurrence_rule = self._create_or_update_recurrence_rule(
            organization, recurrence_data
        )

        event = Event.objects.create(
            organization=organization,
            calendar=calendar,
            created_by=user if user and user.is_authenticated else None,
            is_recurring=bool(recurrence_rule),
            recurrence_rule=recurrence_rule,
            **validated_data,
        )
        return event

    def update(self, instance: Event, validated_data: dict) -> Event:
        recurrence_data = validated_data.pop("recurrence", None)
        is_recurring = validated_data.pop("is_recurring", None)
        calendar_id = validated_data.pop("calendar_id", None)

        organization = instance.organization
        if calendar_id is not None:
            calendar = self._ensure_calendar(calendar_id, organization)
            instance.calendar = calendar

        if is_recurring is False:
            instance.is_recurring = False
            instance.recurrence_rule = None
        elif recurrence_data is not None:
            normalized = self._normalize_recurrence_bounds(recurrence_data)
            if instance.recurrence_rule:
                for field, value in normalized.items():
                    setattr(instance.recurrence_rule, field, value)
                instance.recurrence_rule.save()
                recurrence_rule = instance.recurrence_rule
            else:
                recurrence_rule = self._create_or_update_recurrence_rule(
                    organization, recurrence_data
                )
            instance.is_recurring = bool(recurrence_rule)
            instance.recurrence_rule = recurrence_rule

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


class EventAttendeeSerializer(serializers.ModelSerializer):
    """
    Attendee representation used under `/events/{id}/attendees` and RSVP endpoints.
    """

    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = EventAttendee
        fields = [
            "id",
            "user",
            "email",
            "display_name",
            "attendee_type",
            "response_status",
            "response_comment",
            "responded_at",
            "is_organizer",
            "can_modify",
            "notification_enabled",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "responded_at",
            "is_organizer",
            "created_at",
            "updated_at",
        ]


class AttendeeCreateRequestSerializer(serializers.Serializer):
    """
    Request body for adding an attendee to an event.
    """

    user_id = serializers.IntegerField(required=False)
    email = serializers.EmailField(required=False)
    display_name = serializers.CharField(required=False, allow_blank=True)
    attendee_type = serializers.ChoiceField(
        choices=[choice[0] for choice in EventAttendee.ATTENDEE_TYPE_CHOICES],
        required=False,
        default="required",
    )

    def validate(self, attrs: dict) -> dict:
        if not attrs.get("user_id") and not attrs.get("email"):
            raise serializers.ValidationError(
                "Either user_id or email must be provided."
            )
        return attrs


class AttendeeResponseRequestSerializer(serializers.Serializer):
    """
    Maps to AttendeeResponseRequest in OpenAPI.
    """

    response_status = serializers.ChoiceField(
        choices=[choice[0] for choice in EventAttendee.RESPONSE_STATUS_CHOICES]
    )
    response_comment = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )


class EventReminderSerializer(serializers.ModelSerializer):
    """
    Reminder representation for `/events/{id}/reminders`.
    """

    class Meta:
        model = EventReminder
        fields = [
            "id",
            "method",
            "minutes_before",
            "time_value",
            "time_unit",
            "is_sent",
            "sent_at",
            "scheduled_time",
            "send_attempts",
            "last_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "is_sent",
            "sent_at",
            "scheduled_time",
            "send_attempts",
            "last_error",
            "created_at",
            "updated_at",
        ]


class EventCategorySerializer(serializers.ModelSerializer):
    """
    Event category representation.
    """

    class Meta:
        model = EventCategory
        fields = [
            "id",
            "name",
            "color",
            "description",
            "is_system",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_system", "created_at", "updated_at"]


class EventCategoryAssignmentSerializer(serializers.ModelSerializer):
    """
    Category assignment representation.
    """

    category = EventCategorySerializer(read_only=True)

    class Meta:
        model = EventCategoryAssignment
        fields = ["id", "category"]
        read_only_fields = fields


class CalendarSettingsSerializer(serializers.ModelSerializer):
    """
    Per-user calendar settings representation.
    """

    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = CalendarSettings
        fields = [
            "id",
            "user",
            "default_view",
            "week_start",
            "time_format",
            "timezone",
            "default_event_duration",
            "default_reminders",
            "working_hours_enabled",
            "working_hours_start",
            "working_hours_end",
            "working_days",
            "email_notifications_enabled",
            "notification_preferences",
            "show_declined_events",
            "auto_add_invitations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at"]


class NotificationSerializer(serializers.ModelSerializer):
    """
    Calendar notification representation.
    """

    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "user",
            "notification_type",
            "title",
            "message",
            "event",
            "calendar",
            "is_read",
            "read_at",
            "action_url",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "read_at", "created_at", "updated_at"]


# SMP-407: Read-only serializer for system-derived calendar events
from .models import CalendarEvent

class CalendarEventSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for system-derived CalendarEvent.
    These events are auto-generated from Decisions and Tasks.
    All fields are read-only — no mutation allowed via API.
    """

    # Expose source entity IDs for front-end click navigation
    decision_id = serializers.IntegerField(
        source='decision.id',
        read_only=True,
        allow_null=True,
    )
    task_id = serializers.IntegerField(
        source='task.id',
        read_only=True,
        allow_null=True,
    )
    # Slugs for front-end navigation (browser URLs and API lookups are slug-only)
    decision_slug = serializers.SlugField(
        source='decision.slug',
        read_only=True,
        allow_null=True,
    )
    task_slug = serializers.SlugField(
        source='task.slug',
        read_only=True,
        allow_null=True,
    )
    review_id = serializers.IntegerField(
        source='review.id',
        read_only=True,
        allow_null=True,
    )
    # Expose project_id for front-end permission check on navigation
    # Decision events use decision.project_id, task events use task.project_id
    project_id = serializers.SerializerMethodField()
    
    # Provide user-friendly description with details from source entity
    description = serializers.SerializerMethodField()

    def get_project_id(self, obj) -> int | None:
        # Get project_id from the source entity (decision or task)
        if obj.decision:
            return obj.decision.project_id
        if obj.task:
            return obj.task.project_id
        return None
    
    def get_description(self, obj) -> str:
        """Generate user-friendly description with source entity details."""
        if obj.decision:
            parts = []
            if obj.decision.context_summary:
                parts.append(f"Context: {obj.decision.context_summary[:200]}...")
            if obj.decision.risk_level:
                parts.append(f"Risk Level: {obj.decision.get_risk_level_display()}")
            if obj.decision.status:
                parts.append(f"Status: {obj.decision.get_status_display()}")
            if obj.decision.planned_decision_date:
                parts.append(f"Planned Decision Date: {obj.decision.planned_decision_date.strftime('%Y-%m-%d %H:%M')}")
            return "\n".join(parts) if parts else f"Decision #{obj.decision.id}"
            
        if obj.task:
            parts = []
            if obj.task.description:
                parts.append(f"Description: {obj.task.description[:200]}...")
            if obj.task.status:
                parts.append(f"Status: {obj.task.get_status_display()}")
            if obj.task.planned_start_date:
                parts.append(f"Planned Start: {obj.task.planned_start_date}")
            if obj.task.due_date:
                parts.append(f"Due Date: {obj.task.due_date}")
            if obj.task.planned_start_date and obj.task.due_date:
                duration = (obj.task.due_date - obj.task.planned_start_date).days + 1
                parts.append(f"Duration: {duration} day(s)")
            return "\n".join(parts) if parts else f"Task #{obj.task.id}"
            
        return "System-generated calendar event"

    class Meta:
        model = CalendarEvent
        fields = [
            'id',
            'event_type',    # decision / task / decision_review
            'title',
            'description',   # User-friendly description with source entity details
            'start_time',
            'end_time',
            'decision_id',   # For front-end navigation to decision detail
            'task_id',       # For front-end navigation to task detail
            'decision_slug', # Slug-based navigation (URLs are slug-only)
            'task_slug',     # Slug-based navigation (URLs are slug-only)
            'review_id',     # For front-end navigation to review detail
            'project_id',    # For front-end permission header on navigation
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'event_type', 'title', 'description', 'start_time', 'end_time',
            'decision_id', 'task_id', 'decision_slug', 'task_slug', 'review_id', 'project_id',
            'created_at', 'updated_at',
        ]

# ── MED-284: public booking link serializers ─────────────────────────────


class PublicBookingLinkSerializer(serializers.ModelSerializer):
    """
    Booking link as shown to an anonymous visitor.

    Deliberately narrow: the page needs to say who the meeting is with and how
    long it runs, and nothing else. The owner's email, calendar id, internal
    ids and the organisation record stay out — this payload is served to
    anyone holding the URL.
    """

    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = BookingLink
        fields = [
            "slug",
            "title",
            "description",
            "duration_minutes",
            "timezone",
            "owner_name",
        ]

    def get_owner_name(self, obj):
        owner = obj.owner
        if not owner:
            return ""
        full_name = f"{owner.first_name or ''} {owner.last_name or ''}".strip()
        return full_name or owner.username


class BookingRequestSerializer(serializers.Serializer):
    """An incoming booking from an anonymous visitor."""

    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    start = serializers.DateTimeField(
        help_text="Slot start, ISO 8601 with offset. Must match an offered slot."
    )
    notes = serializers.CharField(
        max_length=2000, required=False, allow_blank=True, default=""
    )

    def validate_name(self, value):
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("Name cannot be blank.")
        return name

    def validate_start(self, value):
        # DRF makes a naive datetime aware using the server's current timezone
        # before this runs, so `is_naive(value)` is always False and cannot be
        # used to detect a missing offset. Inspect the raw input instead: a
        # booking time without an offset is ambiguous and must be rejected
        # rather than silently interpreted as server-local.
        raw = str((self.initial_data or {}).get("start", "")).strip()
        if not re.search(r"(Z|z|[+-]\d{2}:?\d{2})$", raw):
            raise serializers.ValidationError(
                "start must include a timezone offset (e.g. 2026-09-01T10:00:00Z)."
            )
        return value.astimezone(dt_timezone.utc)


class BookingLinkSerializer(serializers.ModelSerializer):
    """
    Owner-facing CRUD for a booking link.

    Distinct from PublicBookingLinkSerializer, which is the narrow anonymous
    view. This one exposes the scheduling rules so an owner can manage them;
    `owner` and `organization` are never accepted from the body — the view sets
    them from the request.
    """

    calendar_id = serializers.UUIDField(write_only=True, required=False)

    # The org that actually owns this link, so the client never has to guess it
    # when building the public URL. It is taken from the user's own organization
    # on create (see BookingLinkViewSet.perform_create), which is not
    # necessarily the organization of whatever project happens to be active —
    # a user can be a member of projects in other orgs. Guessing produces a
    # link that 404s only after it has been sent to a prospect.
    organization_slug = serializers.SlugField(
        source="organization.slug", read_only=True
    )

    # Declared explicitly so a zero is rejected here as a 400. The model's
    # clean() also guards these, but it raises Django's ValidationError from
    # save(), which the DRF exception handler surfaces as a 500.
    duration_minutes = serializers.IntegerField(min_value=1, required=False)
    slot_increment_minutes = serializers.IntegerField(min_value=1, required=False)
    max_advance_days = serializers.IntegerField(min_value=1, required=False)

    class Meta:
        model = BookingLink
        fields = [
            "id",
            "slug",
            "organization_slug",
            "title",
            "description",
            "calendar_id",
            "duration_minutes",
            "slot_increment_minutes",
            "buffer_before_minutes",
            "buffer_after_minutes",
            "min_notice_minutes",
            "max_advance_days",
            "timezone",
            "availability_windows",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization_slug", "created_at", "updated_at"]

    def validate_slug(self, value):
        slug = (value or "").strip().lower()
        if not slug:
            raise serializers.ValidationError("Slug cannot be blank.")
        return slug

    def validate_calendar_id(self, value):
        """
        The target calendar must be one the requesting user owns, and primary.

        The primary requirement is not arbitrary: Google export skips any event
        whose calendar is not the owner's primary one (see
        should_export_event_to_google). A link on a secondary calendar would
        take bookings that silently never reach Google, breaking the promise
        that a booking lands in both calendars. Rejecting it at creation fails
        loudly instead.
        """
        user = self.context["request"].user
        calendar = Calendar.objects.filter(
            id=value, owner=user, is_deleted=False
        ).first()
        if not calendar:
            raise serializers.ValidationError(
                "Calendar not found, or it is not owned by you."
            )
        if not calendar.is_primary:
            raise serializers.ValidationError(
                "Booking links must use your primary calendar, otherwise "
                "bookings cannot be synced to Google Calendar."
            )
        return calendar

    def validate(self, attrs):
        # Surface the (organization, slug) constraint as a readable 400 rather
        # than letting it surface as a 500 from IntegrityError.
        organization = get_user_organization(self.context["request"].user)
        slug = attrs.get("slug", getattr(self.instance, "slug", None))
        clashes = BookingLink.objects.filter(
            organization=organization, slug=slug, is_deleted=False
        )
        if self.instance is not None:
            clashes = clashes.exclude(pk=self.instance.pk)
        if clashes.exists():
            raise serializers.ValidationError(
                {"slug": "You already have a booking link with this slug."}
            )
        return attrs

    def create(self, validated_data):
        calendar = validated_data.pop("calendar_id", None)
        if calendar is None:
            raise serializers.ValidationError({"calendar_id": "This field is required."})
        validated_data["calendar"] = calendar
        return super().create(validated_data)

    def update(self, instance, validated_data):
        calendar = validated_data.pop("calendar_id", None)
        if calendar is not None:
            validated_data["calendar"] = calendar
        return super().update(instance, validated_data)
