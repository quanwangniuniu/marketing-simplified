from django.conf import settings
from django.db import models

from google_docs_integration.crypto import decrypt_token, encrypt_token


class GoogleCalendarConnection(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="google_calendar_connection",
    )
    google_email = models.EmailField(blank=True, null=True)
    encrypted_access_token = models.TextField(blank=True, null=True)
    encrypted_refresh_token = models.TextField(blank=True, null=True)
    token_expiry = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    needs_reconnect = models.BooleanField(default=False)
    last_error_message = models.TextField(blank=True, null=True)
    primary_calendar_id = models.CharField(max_length=255, blank=True, null=True)
    import_calendar = models.ForeignKey(
        "calendars.Calendar",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="google_calendar_import_connections",
    )
    last_import_at = models.DateTimeField(blank=True, null=True)
    last_export_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "google_calendar_connections"

    def get_access_token(self) -> str | None:
        return decrypt_token(self.encrypted_access_token)

    def set_access_token(self, token: str | None) -> None:
        self.encrypted_access_token = encrypt_token(token)

    def get_refresh_token(self) -> str | None:
        return decrypt_token(self.encrypted_refresh_token)

    def set_refresh_token(self, token: str | None) -> None:
        self.encrypted_refresh_token = encrypt_token(token)

    def __str__(self):
        return f"GoogleCalendarConnection(user={self.user_id}, active={self.is_active})"
