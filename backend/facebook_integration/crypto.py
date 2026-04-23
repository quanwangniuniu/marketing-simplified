"""Fernet encryption for OAuth tokens at rest.

Key derivation matches zoom_integration / google_docs_integration so any SECRET_KEY
rotation affects all three integrations consistently.
"""

import base64

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(settings.SECRET_KEY[:32].encode().ljust(32, b"="))
    return Fernet(key)


def encrypt_token(token: str | None) -> str | None:
    if not token:
        return None
    return _fernet().encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str | None) -> str | None:
    if not encrypted_token:
        return None
    return _fernet().decrypt(encrypted_token.encode()).decode()
