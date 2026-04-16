from django.db import models
from django.conf import settings

from .crypto import decrypt_token, encrypt_token


class ZoomCredential(models.Model):
    """
    Store user's Zoom OAuth tokens (encrypted at rest, same Fernet derivation as Slack).
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="zoom_credential",
    )
    encrypted_access_token = models.TextField(
        help_text="Encrypted short-lived OAuth access token.",
    )
    encrypted_refresh_token = models.TextField(
        help_text="Encrypted OAuth refresh token.",
    )
    token_expires_at = models.DateTimeField()
    zoom_user_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def set_tokens(self, access_token: str | None, refresh_token: str | None) -> None:
        self.encrypted_access_token = encrypt_token(access_token) or ""
        self.encrypted_refresh_token = encrypt_token(refresh_token) or ""

    def get_access_token(self) -> str | None:
        return decrypt_token(self.encrypted_access_token)

    def get_refresh_token(self) -> str | None:
        return decrypt_token(self.encrypted_refresh_token)

    def __str__(self):
        return f"ZoomCredential for {self.user}"


class ZoomMeetingData(models.Model):
    """
    Zoom-side snapshot for a MediaJira Meeting (post-meeting metrics, recordings, sync state).
    One row per Meeting when the project links Zoom data.
    """

    class MeetingStatus(models.TextChoices):
        UNKNOWN = "unknown", "Unknown"
        SCHEDULED = "scheduled", "Scheduled"
        LIVE = "live", "Live"
        ENDED = "ended", "Ended"

    class RecordingStatus(models.TextChoices):
        UNKNOWN = "unknown", "Unknown"
        NONE = "none", "None"
        PROCESSING = "processing", "Processing"
        AVAILABLE = "available", "Available"
        DELETED = "deleted", "Deleted"

    class SummaryStatus(models.TextChoices):
        NOT_APPLICABLE = "not_applicable", "Not applicable"
        PENDING = "pending", "Pending"
        AVAILABLE = "available", "Available"
        FAILED = "failed", "Failed"

    class SyncState(models.TextChoices):
        NEVER = "never", "Never synced"
        IN_PROGRESS = "in_progress", "In progress"
        OK = "ok", "OK"
        PARTIAL = "partial", "Partial"
        ERROR = "error", "Error"

    meeting = models.OneToOneField(
        "meetings.Meeting",
        on_delete=models.CASCADE,
        related_name="zoom_meeting_data",
    )
    zoom_host_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="zoom_meeting_data_hosted",
        help_text="User whose Zoom OAuth credential owns this meeting (set when linking).",
    )
    zoom_meeting_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
        help_text="Zoom long meeting ID.",
    )
    zoom_uuid = models.CharField(
        max_length=128,
        blank=True,
        default="",
        db_index=True,
        help_text="Zoom meeting instance UUID (past-meeting APIs).",
    )

    meeting_status = models.CharField(
        max_length=32,
        choices=MeetingStatus.choices,
        default=MeetingStatus.UNKNOWN,
    )
    actual_start_time = models.DateTimeField(null=True, blank=True)
    actual_end_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    actual_participants_count = models.PositiveIntegerField(null=True, blank=True)

    participant_raw_json = models.JSONField(default=list, blank=True)
    participant_structured_json = models.JSONField(default=list, blank=True)

    recording_status = models.CharField(
        max_length=32,
        choices=RecordingStatus.choices,
        default=RecordingStatus.UNKNOWN,
    )
    recording_urls_json = models.JSONField(default=list, blank=True)
    recording_metadata_json = models.JSONField(default=dict, blank=True)

    summary_status = models.CharField(
        max_length=32,
        choices=SummaryStatus.choices,
        default=SummaryStatus.NOT_APPLICABLE,
    )
    summary_text = models.TextField(blank=True, default="")

    last_sync_at = models.DateTimeField(null=True, blank=True)
    sync_state = models.CharField(
        max_length=32,
        choices=SyncState.choices,
        default=SyncState.NEVER,
    )
    sync_error = models.TextField(blank=True, default="")

    def __str__(self) -> str:
        return f"ZoomMeetingData(meeting_id={self.meeting_id})"
