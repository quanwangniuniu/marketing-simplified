import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

from tracking.enums import EndReason, EventType


class TrackingSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tracking_sessions',
    )
    started_at = models.DateTimeField(auto_now_add=True)
    last_heartbeat_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    end_reason = models.CharField(
        max_length=20,
        choices=EndReason.choices,
        null=True,
        blank=True,
    )
    active_seconds = models.PositiveIntegerField(null=True, blank=True, default=0)
    user_agent = models.CharField(max_length=512, blank=True, default='')

    def __str__(self):
        return f"Session {self.id} — user={self.user_id} started={self.started_at}"


class TrackingEvent(models.Model):
    session = models.ForeignKey(
        TrackingSession,
        on_delete=models.CASCADE,
        related_name='events',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tracking_events',
    )
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
    )
    object_id = models.PositiveIntegerField(null=True)
    target = GenericForeignKey('content_type', 'object_id')
    event_type = models.CharField(max_length=30, choices=EventType.choices)
    occurred_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)
    project_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    client_event_id = models.UUIDField()

    class Meta:
        unique_together = [("user", "client_event_id")]
        indexes = [
            models.Index(fields=["user", "occurred_at"]),
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["project_id", "occurred_at"]),
            models.Index(fields=["session", "occurred_at"]),
        ]

    def __str__(self):
        return f"Event {self.id} [{self.event_type}] — user={self.user_id} at={self.occurred_at}"
