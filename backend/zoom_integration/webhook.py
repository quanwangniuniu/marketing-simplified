"""
Zoom webhook verification (URL validation challenge + v0 HMAC for event payloads).

See https://developers.zoom.us/docs/api/webhooks/
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any

ZOOM_URL_VALIDATION_EVENT = "endpoint.url_validation"
MAX_TIMESTAMP_SKEW_SECONDS = 300


def encrypt_zoom_url_validation_token(plain_token: str, secret: str) -> str:
    """HMAC-SHA256 hex digest of ``plainToken`` using ``secret`` (Zoom URL validation)."""
    return hmac.new(
        secret.encode("utf-8"),
        plain_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_zoom_webhook_signature(
    *,
    raw_body: bytes,
    timestamp: str,
    signature_header: str,
    secret: str,
) -> bool:
    """
    Verify ``x-zm-signature`` for a normal event: message ``v0:{timestamp}:{raw_body}``.
    """
    if not secret or not signature_header or not timestamp:
        return False
    try:
        body_text = raw_body.decode("utf-8")
    except UnicodeDecodeError:
        return False
    message = f"v0:{timestamp}:{body_text}"
    expected_digest = hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    expected = f"v0={expected_digest}"
    return hmac.compare_digest(expected.strip(), signature_header.strip())


def is_timestamp_valid(timestamp: str, *, now: float | None = None) -> bool:
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    if now is None:
        now = time.time()
    return abs(now - ts) <= MAX_TIMESTAMP_SKEW_SECONDS


def parse_webhook_json(raw_body: bytes) -> Any:
    return json.loads(raw_body.decode("utf-8"))
