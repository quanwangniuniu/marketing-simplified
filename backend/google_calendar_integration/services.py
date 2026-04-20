from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import quote, urlencode

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from calendars.models import Calendar, Event
from calendars.permissions import get_user_organization
from google_docs_integration.services import refresh_google_tokens

from .constants import (
    METADATA_GOOGLE_ETAG_KEY,
    METADATA_GOOGLE_EVENT_ID_KEY,
    METADATA_ICAL_UID_KEY,
    METADATA_RECURRING_EVENT_ID_KEY,
    METADATA_SOURCE_GOOGLE_CALENDAR,
    METADATA_SOURCE_KEY,
)
from .models import GoogleCalendarConnection

logger = logging.getLogger(__name__)

GOOGLE_OAUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"

GOOGLE_CALENDAR_SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar",
]


def get_calendar_redirect_uri() -> str:
    uri = getattr(settings, "GOOGLE_CALENDAR_OAUTH_REDIRECT_URI", "") or ""
    return uri.strip()


def build_google_calendar_auth_url(state: str) -> str:
    redirect_uri = get_calendar_redirect_uri()
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_CALENDAR_SCOPES),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_OAUTH_BASE_URL}?{urlencode(params)}"


def exchange_code_for_token(code: str) -> dict:
    redirect_uri = get_calendar_redirect_uri()
    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json()
    expires_in = int(payload.get("expires_in", 3600))
    payload["token_expiry"] = timezone.now() + timedelta(seconds=expires_in)
    return payload


def _persist_refreshed_tokens(connection: GoogleCalendarConnection, payload: dict) -> None:
    connection.set_access_token(payload["access_token"])
    new_refresh = payload.get("refresh_token")
    if new_refresh:
        connection.set_refresh_token(new_refresh)
    connection.token_expiry = payload.get("token_expiry")
    connection.save(
        update_fields=[
            "encrypted_access_token",
            "encrypted_refresh_token",
            "token_expiry",
            "updated_at",
        ]
    )


def get_access_token_for_api(connection: GoogleCalendarConnection) -> str:
    if not connection.get_access_token():
        raise ValueError("Google Calendar is not connected.")
    now = timezone.now()
    buffer = timedelta(minutes=2)
    expiry_ok = connection.token_expiry and connection.token_expiry > now + buffer
    if expiry_ok:
        return connection.get_access_token() or ""
    if not connection.get_refresh_token():
        return connection.get_access_token() or ""
    payload = refresh_google_tokens(connection.get_refresh_token())
    _persist_refreshed_tokens(connection, payload)
    return connection.get_access_token() or ""


def run_google_calendar_api(connection: GoogleCalendarConnection, fn):
    token = get_access_token_for_api(connection)
    try:
        return fn(token)
    except requests.HTTPError as exc:
        if exc.response is None or exc.response.status_code != 401:
            raise
        if not connection.get_refresh_token():
            raise
        payload = refresh_google_tokens(connection.get_refresh_token())
        _persist_refreshed_tokens(connection, payload)
        return fn(connection.get_access_token() or "")


def fetch_google_email(access_token: str) -> str | None:
    response = requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json().get("email")


def fetch_primary_calendar_id(access_token: str) -> str:
    r = requests.get(
        f"{GOOGLE_CALENDAR_API_BASE}/users/me/calendarList",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"maxResults": 250},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    for item in data.get("items", []):
        if item.get("primary"):
            return item["id"]
    for item in data.get("items", []):
        if item.get("id") == "primary":
            return "primary"
    raise ValueError("No primary Google calendar found.")


def ensure_import_calendar(user, google_email: str | None) -> Calendar:
    org = get_user_organization(user)
    if not org:
        raise ValueError("User has no organization.")
    label = google_email or "Calendar"
    name = f"Google ({label})"
    existing = (
        Calendar.objects.filter(
            organization=org,
            owner=user,
            name=name,
            is_deleted=False,
        )
        .first()
    )
    if existing:
        return existing
    return Calendar.objects.create(
        organization=org,
        owner=user,
        name=name,
        description="Imported events from Google Calendar",
        is_primary=False,
    )


def _google_time_to_platform(start: dict, end: dict) -> tuple[datetime, datetime, bool, str]:
    tz = "UTC"
    if "dateTime" in start:
        s = parse_datetime(start["dateTime"])
        e = parse_datetime(end["dateTime"])
        tz = start.get("timeZone") or end.get("timeZone") or "UTC"
        if s and e and timezone.is_naive(s):
            s = timezone.make_aware(s, timezone.utc)
        if e and timezone.is_naive(e):
            e = timezone.make_aware(e, timezone.utc)
        if not s or not e:
            raise ValueError("Invalid dateTime from Google")
        return s, e, False, tz
    if "date" in start:
        sd = parse_date(start["date"])
        ed = parse_date(end["date"])
        if not sd or not ed:
            raise ValueError("Invalid date from Google")
        # Google end date is exclusive for all-day
        s = timezone.make_aware(datetime.combine(sd, datetime.min.time()), timezone.utc)
        e_exclusive = ed
        e_inclusive = e_exclusive - timedelta(days=1)
        e = timezone.make_aware(
            datetime.combine(e_inclusive, datetime.max.time().replace(microsecond=0)),
            timezone.utc,
        )
        return s, e, True, tz
    raise ValueError("Unsupported Google event time format")


def _ical_uid_for_imported_event(google_event: dict) -> str:
    ge_id = google_event.get("id") or ""
    return f"{ge_id}@google-import"


def upsert_imported_event(
    connection: GoogleCalendarConnection,
    google_event: dict,
) -> None:
    if not connection.import_calendar_id:
        raise ValueError("import_calendar not set")
    status = google_event.get("status", "confirmed")
    if status == "cancelled":
        external_id = google_event.get("id")
        if external_id:
            Event.objects.filter(
                organization_id=connection.import_calendar.organization_id,
                calendar_id=connection.import_calendar_id,
                external_id=external_id,
            ).update(is_deleted=True, status="cancelled")
        return

    start = google_event.get("start") or {}
    end = google_event.get("end") or {}
    if not start or not end:
        return

    s_dt, e_dt, all_day, tz = _google_time_to_platform(start, end)
    external_id = google_event.get("id")
    if not external_id:
        return

    ical_uid = _ical_uid_for_imported_event(google_event)
    etag = google_event.get("etag", "")

    meta = {
        METADATA_SOURCE_KEY: METADATA_SOURCE_GOOGLE_CALENDAR,
        METADATA_GOOGLE_ETAG_KEY: etag,
        METADATA_ICAL_UID_KEY: google_event.get("iCalUID"),
    }
    if google_event.get("recurringEventId"):
        meta[METADATA_RECURRING_EVENT_ID_KEY] = google_event["recurringEventId"]

    defaults = {
        "title": google_event.get("summary") or "(No title)",
        "description": google_event.get("description") or "",
        "start_datetime": s_dt,
        "end_datetime": e_dt,
        "timezone": tz,
        "is_all_day": all_day,
        "location": google_event.get("location") or "",
        "status": "confirmed" if status == "confirmed" else "tentative",
        "metadata": meta,
        "ical_uid": ical_uid,
        "is_recurring": False,
        "recurrence_rule": None,
    }

    event = Event.objects.filter(
        organization_id=connection.import_calendar.organization_id,
        calendar_id=connection.import_calendar_id,
        external_id=external_id,
        is_deleted=False,
    ).first()

    if event:
        for k, v in defaults.items():
            setattr(event, k, v)
        event.save()
    else:
        event = Event(
            organization_id=connection.import_calendar.organization_id,
            calendar_id=connection.import_calendar_id,
            external_id=external_id,
            created_by=connection.user,
            **defaults,
        )
        event.save()


def import_events_for_connection(connection: GoogleCalendarConnection) -> None:
    if not connection.is_active or not connection.primary_calendar_id:
        return
    if not connection.import_calendar_id:
        return

    now = timezone.now()
    time_min = (now - timedelta(days=90)).isoformat()
    time_max = (now + timedelta(days=365)).isoformat()

    def _list_page(token: str, page_token: str | None = None):
        params: dict[str, Any] = {
            "timeMin": time_min,
            "timeMax": time_max,
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": 250,
        }
        if page_token:
            params["pageToken"] = page_token
        cid = connection.primary_calendar_id
        r = requests.get(
            f"{GOOGLE_CALENDAR_API_BASE}/calendars/{quote(cid, safe='')}/events",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=60,
        )
        r.raise_for_status()
        return r.json()

    try:
        page_token = None
        while True:
            pt = page_token

            def _call(token: str, _pt: str | None = pt):
                return _list_page(token, _pt)

            data = run_google_calendar_api(connection, _call)
            for item in data.get("items", []):
                upsert_imported_event(connection, item)
            page_token = data.get("nextPageToken")
            if not page_token:
                break
        connection.last_import_at = timezone.now()
        connection.needs_reconnect = False
        connection.last_error_message = None
        connection.save(
            update_fields=["last_import_at", "needs_reconnect", "last_error_message", "updated_at"]
        )
    except requests.HTTPError as exc:
        msg = "Google Calendar import failed."
        if exc.response is not None and exc.response.status_code in (401, 403):
            connection.needs_reconnect = True
            msg = "Google authorization expired or was revoked. Please reconnect."
        logger.warning("google_calendar import failed user=%s: %s", connection.user_id, exc)
        connection.last_error_message = msg
        connection.save(update_fields=["needs_reconnect", "last_error_message", "updated_at"])
        raise


def platform_event_to_google_body(event: Event) -> dict[str, Any]:
    body: dict[str, Any] = {
        "summary": event.title,
        "description": event.description or "",
    }
    if event.location:
        body["location"] = event.location
    if event.is_all_day:
        body["start"] = {"date": event.start_datetime.date().isoformat()}
        end_exclusive = event.end_datetime.date() + timedelta(days=1)
        body["end"] = {"date": end_exclusive.isoformat()}
    else:
        body["start"] = {
            "dateTime": event.start_datetime.isoformat(),
            "timeZone": event.timezone or "UTC",
        }
        body["end"] = {
            "dateTime": event.end_datetime.isoformat(),
            "timeZone": event.timezone or "UTC",
        }
    return body


def should_export_event_to_google(event: Event) -> bool:
    if not event.calendar or not event.calendar.is_primary:
        return False
    if event.is_recurring:
        return False
    meta = event.metadata or {}
    if meta.get(METADATA_SOURCE_KEY) == METADATA_SOURCE_GOOGLE_CALENDAR:
        return False
    return True


def export_event_to_google(event: Event) -> None:
    if not should_export_event_to_google(event):
        return
    owner = event.calendar.owner
    if not owner:
        return
    try:
        connection = GoogleCalendarConnection.objects.get(user=owner, is_active=True)
    except GoogleCalendarConnection.DoesNotExist:
        return
    if connection.needs_reconnect or not connection.primary_calendar_id:
        return

    cid = connection.primary_calendar_id
    body = platform_event_to_google_body(event)
    meta = dict(event.metadata or {})
    google_event_id = meta.get(METADATA_GOOGLE_EVENT_ID_KEY)
    google_etag = meta.get(METADATA_GOOGLE_ETAG_KEY)

    def _insert(token: str):
        r = requests.post(
            f"{GOOGLE_CALENDAR_API_BASE}/calendars/{quote(cid, safe='')}/events",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=body,
            timeout=30,
        )
        r.raise_for_status()
        return r.json()

    def _patch(token: str):
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        if google_etag:
            headers["If-Match"] = google_etag
        r = requests.patch(
            f"{GOOGLE_CALENDAR_API_BASE}/calendars/{quote(cid, safe='')}/events/{quote(google_event_id, safe='')}",
            headers=headers,
            json=body,
            timeout=30,
        )
        if r.status_code == 412 and google_etag:
            r2 = requests.get(
                f"{GOOGLE_CALENDAR_API_BASE}/calendars/{quote(cid, safe='')}/events/{quote(google_event_id, safe='')}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            r2.raise_for_status()
            latest = r2.json()
            etag = latest.get("etag")
            r = requests.patch(
                f"{GOOGLE_CALENDAR_API_BASE}/calendars/{quote(cid, safe='')}/events/{quote(google_event_id, safe='')}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    **({"If-Match": etag} if etag else {}),
                },
                json=body,
                timeout=30,
            )
        r.raise_for_status()
        return r.json()

    def _delete(token: str):
        r = requests.delete(
            f"{GOOGLE_CALENDAR_API_BASE}/calendars/{quote(cid, safe='')}/events/{quote(google_event_id, safe='')}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if r.status_code in (404, 410):
            return
        r.raise_for_status()

    try:
        if event.is_deleted:
            if google_event_id:
                run_google_calendar_api(connection, _delete)
            return

        if not google_event_id:
            created = run_google_calendar_api(connection, _insert)
            meta[METADATA_GOOGLE_EVENT_ID_KEY] = created.get("id")
            meta[METADATA_GOOGLE_ETAG_KEY] = created.get("etag", "")
            event.metadata = meta
            event.save(update_fields=["metadata", "updated_at"])
        else:
            updated = run_google_calendar_api(connection, _patch)
            meta[METADATA_GOOGLE_ETAG_KEY] = updated.get("etag", google_etag)
            event.metadata = meta
            event.save(update_fields=["metadata", "updated_at"])

        connection.last_export_at = timezone.now()
        connection.last_error_message = None
        connection.needs_reconnect = False
        connection.save(
            update_fields=["last_export_at", "last_error_message", "needs_reconnect", "updated_at"]
        )
    except requests.HTTPError as exc:
        msg = "Could not sync event to Google Calendar."
        if exc.response is not None and exc.response.status_code in (401, 403):
            connection.needs_reconnect = True
            msg = "Google authorization expired. Reconnect in Settings."
        logger.warning("google_calendar export failed event=%s: %s", event.id, exc)
        connection.last_error_message = msg
        connection.save(update_fields=["needs_reconnect", "last_error_message", "updated_at"])


def export_primary_calendar_events_to_google(connection: GoogleCalendarConnection) -> None:
    """Push eligible primary-calendar platform events to Google (same rules as export_event_to_google)."""
    org = get_user_organization(connection.user)
    if not org:
        return
    primary = (
        Calendar.objects.filter(
            organization=org,
            owner=connection.user,
            is_primary=True,
            is_deleted=False,
        )
        .first()
    )
    if not primary:
        return
    for event in (
        Event.objects.filter(calendar=primary)
        .select_related("calendar", "calendar__owner")
        .iterator(chunk_size=50)
    ):
        export_event_to_google(event)


@transaction.atomic
def disconnect_user_calendar(user) -> None:
    conn = GoogleCalendarConnection.objects.filter(user=user).first()
    if not conn:
        return
    cal = conn.import_calendar
    conn.import_calendar = None
    conn.set_access_token(None)
    conn.set_refresh_token(None)
    conn.token_expiry = None
    conn.primary_calendar_id = None
    conn.is_active = False
    conn.needs_reconnect = False
    conn.last_error_message = None
    conn.google_email = None
    conn.save()
    if cal:
        cal.delete()
