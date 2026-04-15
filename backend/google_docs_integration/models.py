from django.conf import settings
from django.db import models

from .crypto import decrypt_token, encrypt_token


class GoogleDocsConnection(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="google_docs_connection",
    )
    google_email = models.EmailField(blank=True, null=True)
    encrypted_access_token = models.TextField(blank=True, null=True)
    encrypted_refresh_token = models.TextField(blank=True, null=True)
    token_expiry = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "google_docs_connections"

    # --- token helpers (encrypt on write, decrypt on read) ---

    def get_access_token(self) -> str | None:
        return decrypt_token(self.encrypted_access_token)

    def set_access_token(self, token: str | None) -> None:
        self.encrypted_access_token = encrypt_token(token)

    def get_refresh_token(self) -> str | None:
        return decrypt_token(self.encrypted_refresh_token)

    def set_refresh_token(self, token: str | None) -> None:
        self.encrypted_refresh_token = encrypt_token(token)

    def __str__(self):
        return f"GoogleDocsConnection(user={self.user_id}, active={self.is_active})"
