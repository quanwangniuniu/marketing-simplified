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
