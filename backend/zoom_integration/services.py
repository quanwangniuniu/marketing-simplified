import requests
import base64
from datetime import timedelta
from urllib.parse import urlencode
from django.conf import settings
from django.utils import timezone
from .crypto import encrypt_token
from .models import ZoomCredential


ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize"
ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"
ZOOM_API_BASE  = "https://api.zoom.us/v2"


def get_authorization_url(state: str) -> str:
    """
    Generate URL for user to redirect to Zoom for authorization.
    ``state`` must be a server-issued signed payload (see views) so the callback can verify it
    without relying on session cookies.
    """
    params = {
        "response_type": "code",
        "client_id": settings.ZOOM_CLIENT_ID,
        "redirect_uri": settings.ZOOM_REDIRECT_URI,
        "state": state,
    }
    return f"{ZOOM_AUTH_URL}?{urlencode(params)}"


def _basic_auth_header() -> str:
    """
    Zoom token API requires Basic Auth with client_id:client_secret
    Format: base64("client_id:client_secret")
    """
    credentials = f"{settings.ZOOM_CLIENT_ID}:{settings.ZOOM_CLIENT_SECRET}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return f"Basic {encoded}"


def exchange_code_for_token(code: str) -> dict:
    """
    Exchange authorization code for access_token
    This is the standard Authorization Code Flow for OAuth
    """
    response = requests.post(
        ZOOM_TOKEN_URL,
        headers={
            "Authorization": _basic_auth_header(),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.ZOOM_REDIRECT_URI,
        },
    )
    response.raise_for_status()  # if HTTP status code is 4xx/5xx, raise an exception
    return response.json()
    # return format: {"access_token": "...", "refresh_token": "...", "expires_in": 3600}


def refresh_access_token(credential: ZoomCredential) -> ZoomCredential:
    """
    access_token is valid for only 1 hour, refresh it with refresh_token after expiration
    """
    response = requests.post(
        ZOOM_TOKEN_URL,
        headers={
            "Authorization": _basic_auth_header(),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={
            "grant_type": "refresh_token",
            "refresh_token": credential.get_refresh_token(),
        },
    )
    response.raise_for_status()
    data = response.json()

    credential.set_tokens(data["access_token"], data["refresh_token"])
    credential.token_expires_at = timezone.now() + timedelta(seconds=data["expires_in"])
    credential.save(
        update_fields=[
            "encrypted_access_token",
            "encrypted_refresh_token",
            "token_expires_at",
            "updated_at",
        ],
    )
    return credential


def get_valid_credential(user) -> ZoomCredential:
    """
    Get valid credential: if token is about to expire, refresh it automatically
    This way the caller doesn't need to worry about token expiration
    """
    try:
        credential = user.zoom_credential
    except ZoomCredential.DoesNotExist:
        raise ValueError("User has not connected to Zoom account")

    # if token is about to expire, refresh it automatically
    if credential.token_expires_at <= timezone.now() + timedelta(minutes=5):
        try:
            credential = refresh_access_token(credential)
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code in (400, 401):
                credential.delete()
                raise PermissionError(
                    "Zoom connection has expired or been revoked. Please reconnect your Zoom account."
                ) from exc
            raise

    return credential


def save_token_for_user(user, token_data: dict) -> ZoomCredential:
    """
    Save tokens from Zoom to database
    update_or_create: if exists, update, if not, create
    """
    expires_at = timezone.now() + timedelta(seconds=token_data["expires_in"])

    credential, _ = ZoomCredential.objects.update_or_create(
        user=user,
        defaults={
            "encrypted_access_token": encrypt_token(token_data["access_token"]) or "",
            "encrypted_refresh_token": encrypt_token(token_data["refresh_token"]) or "",
            "token_expires_at": expires_at,
        },
    )
    return credential


def create_zoom_meeting(user, topic: str, start_time: str, duration: int = 60) -> dict:
    """
    Core functionality: create a Zoom meeting for the user
    
    Parameters:
        topic      meeting topic
        start_time ISO8601 format time, e.g. "2026-04-10T10:00:00Z"
        duration   meeting duration (minutes), default 60 minutes
    """
    credential = get_valid_credential(user)  # automatically refresh token

    response = requests.post(
        f"{ZOOM_API_BASE}/users/me/meetings",  # me represents the currently authorized user
        headers={
            "Authorization": f"Bearer {credential.get_access_token()}",
            "Content-Type": "application/json",
        },
        json={
            "topic": topic,
            "type": 2,              # 2 = scheduled meeting (different from instant meeting type=1)
            "start_time": start_time,
            "duration": duration,
            "settings": {
                "host_video": True,
                "participant_video": True,
                "waiting_room": True,   # enable waiting room
            },
        },
    )

    if response.status_code == 401:
        # 401 means token is invalid (possibly user revoked authorization), prompt user to reconnect
        raise PermissionError("Your Zoom authorization has expired. Please reconnect your Zoom account.")

    response.raise_for_status()
    return response.json()
    # return format: {"join_url": "...", "start_url": "...", "meeting_id": "..."}