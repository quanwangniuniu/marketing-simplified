"""Meta / Facebook OAuth and Graph API client for the integration layer.

Proven via spike on 2026-04-23 that Facebook Login for Business with config_id
returns a long-lived (~60 day) access token in a single `code -> token` exchange,
so the usual short -> long exchange step is not needed.
"""

import datetime as _dt
import logging
import secrets
import urllib.parse as _urlparse
from typing import Any

import requests
from django.conf import settings
from django.core import signing
from django.utils import timezone

from .models import FacebookConnection, MetaAdAccount


logger = logging.getLogger(__name__)


FB_OAUTH_STATE_SALT = "facebook_integration.oauth.state"
FB_OAUTH_STATE_MAX_AGE = 600  # 10 minutes


# OAuth state ------------------------------------------------------------------


def build_oauth_state(user_id: int, project_id: int | None = None) -> str:
    payload = {
        "user_id": int(user_id),
        "project_id": project_id,
        "nonce": secrets.token_urlsafe(16),
    }
    return signing.dumps(payload, salt=FB_OAUTH_STATE_SALT)


def unpack_oauth_state(state: str) -> dict[str, Any]:
    return signing.loads(state, salt=FB_OAUTH_STATE_SALT, max_age=FB_OAUTH_STATE_MAX_AGE)


def build_authorize_url(state: str) -> str:
    params = {
        "client_id": settings.FB_APP_ID,
        "config_id": settings.FB_CONFIG_ID,
        "redirect_uri": settings.FB_REDIRECT_URI,
        "state": state,
        "response_type": "code",
    }
    return f"https://www.facebook.com/{settings.FB_API_VERSION}/dialog/oauth?{_urlparse.urlencode(params)}"


# Token exchange ---------------------------------------------------------------


def exchange_code_for_token(code: str) -> dict[str, Any]:
    """Exchange authorization code for a long-lived access token.

    Returns the Graph API JSON response, which contains access_token, token_type,
    and expires_in (seconds).
    """
    url = f"https://graph.facebook.com/{settings.FB_API_VERSION}/oauth/access_token"
    params = {
        "client_id": settings.FB_APP_ID,
        "client_secret": settings.FB_APP_SECRET,
        "redirect_uri": settings.FB_REDIRECT_URI,
        "code": code,
    }
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


# Graph API helpers ------------------------------------------------------------


def _graph_get(path: str, access_token: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"https://graph.facebook.com/{settings.FB_API_VERSION}{path}"
    request_params = {"access_token": access_token}
    if params:
        request_params.update(params)
    resp = requests.get(url, params=request_params, timeout=20)
    resp.raise_for_status()
    return resp.json()


def fetch_me(access_token: str) -> dict[str, Any]:
    return _graph_get("/me", access_token, {"fields": "id,name,email"})


def fetch_my_businesses(access_token: str) -> list[dict[str, Any]]:
    data = _graph_get("/me/businesses", access_token, {"fields": "id,name", "limit": 100})
    return data.get("data", [])


def fetch_business_ad_accounts(business_id: str, access_token: str) -> list[dict[str, Any]]:
    """List both owned and client ad accounts for a business, marking which is which."""
    owned = _graph_get(
        f"/{business_id}/owned_ad_accounts",
        access_token,
        {"fields": "account_id,name,currency,timezone_name,account_status,business", "limit": 100},
    ).get("data", [])
    client = _graph_get(
        f"/{business_id}/client_ad_accounts",
        access_token,
        {"fields": "account_id,name,currency,timezone_name,account_status,business", "limit": 100},
    ).get("data", [])

    result = []
    for item in owned:
        result.append({**item, "is_owned": True})
    for item in client:
        result.append({**item, "is_owned": False})
    return result


# Connection lifecycle ---------------------------------------------------------


def store_connection_from_code(user, code: str) -> FacebookConnection:
    """Exchange code, fetch identity, select first business, persist connection.

    Caller is responsible for verifying OAuth state first.
    """
    token_data = exchange_code_for_token(code)
    access_token = token_data["access_token"]
    expires_in = int(token_data.get("expires_in") or 0)
    expires_at = timezone.now() + _dt.timedelta(seconds=expires_in) if expires_in else None

    me = fetch_me(access_token)
    businesses = fetch_my_businesses(access_token)
    chosen_business = businesses[0] if businesses else {"id": "", "name": ""}

    connection, _ = FacebookConnection.objects.update_or_create(
        user=user,
        defaults={
            "fb_user_id": str(me.get("id", "")),
            "fb_user_name": me.get("name", "") or "",
            "fb_email": me.get("email") or None,
            "business_id": str(chosen_business.get("id", "")),
            "business_name": chosen_business.get("name", "") or "",
            "token_expires_at": expires_at,
            "last_refreshed_at": timezone.now(),
            "is_active": True,
            "last_sync_error": "",
        },
    )
    connection.set_access_token(access_token)
    connection.save(update_fields=["encrypted_access_token", "updated_at"])

    if chosen_business.get("id"):
        _sync_ad_accounts_for_business(connection, access_token, chosen_business["id"])
    return connection


def _sync_ad_accounts_for_business(
    connection: FacebookConnection, access_token: str, business_id: str
) -> None:
    try:
        accounts = fetch_business_ad_accounts(business_id, access_token)
    except requests.HTTPError as err:
        logger.warning("fetch_business_ad_accounts failed: %s", err)
        connection.last_sync_error = f"ad account list: {err}"[:500]
        connection.save(update_fields=["last_sync_error", "updated_at"])
        return

    for entry in accounts:
        MetaAdAccount.objects.update_or_create(
            connection=connection,
            meta_account_id=str(entry.get("account_id", "")),
            defaults={
                "name": entry.get("name", "") or "",
                "currency": entry.get("currency", "") or "",
                "timezone_name": entry.get("timezone_name", "") or "",
                "account_status": entry.get("account_status"),
                "business_id": str((entry.get("business") or {}).get("id", "") or business_id),
                "is_owned": bool(entry.get("is_owned")),
            },
        )


def disconnect(connection: FacebookConnection) -> None:
    """Soft disconnect: clear token + mark inactive. Keeps audit trail."""
    connection.encrypted_access_token = ""
    connection.is_active = False
    connection.save(update_fields=["encrypted_access_token", "is_active", "updated_at"])
