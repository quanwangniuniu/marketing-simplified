from __future__ import annotations

import logging

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.db import transaction
from django.shortcuts import redirect
from django.utils.crypto import get_random_string
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GoogleCalendarConnection
from .serializers import GoogleCalendarConnectSerializer, GoogleCalendarStatusSerializer
from .services import (
    build_google_calendar_auth_url,
    disconnect_user_calendar,
    ensure_import_calendar,
    exchange_code_for_token,
    export_primary_calendar_events_to_google,
    fetch_google_email,
    fetch_primary_calendar_id,
    get_calendar_redirect_uri,
    import_events_for_connection,
)

logger = logging.getLogger(__name__)

User = get_user_model()

GOOGLE_CALENDAR_STATE_SALT = "google-calendar-oauth-state"
GOOGLE_CALENDAR_STATE_MAX_AGE_SECONDS = 600


def _build_oauth_state(user) -> str:
    return signing.dumps(
        {"user_id": user.id, "nonce": get_random_string(16)},
        salt=GOOGLE_CALENDAR_STATE_SALT,
    )


class GoogleCalendarStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        connection = GoogleCalendarConnection.objects.filter(
            user=request.user,
            is_active=True,
        ).first()
        payload = {
            "connected": bool(connection and connection.get_access_token()),
            "google_email": connection.google_email if connection else None,
            "needs_reconnect": connection.needs_reconnect if connection else False,
            "last_import_at": connection.last_import_at if connection else None,
            "last_export_at": connection.last_export_at if connection else None,
            "last_error_message": connection.last_error_message if connection else None,
        }
        serializer = GoogleCalendarStatusSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)


class GoogleCalendarConnectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        missing_settings = []
        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            missing_settings.append("GOOGLE_CLIENT_ID (or GOOGLE_OAUTH_CLIENT_ID)")
        if not settings.GOOGLE_OAUTH_CLIENT_SECRET:
            missing_settings.append("GOOGLE_CLIENT_SECRET (or GOOGLE_OAUTH_CLIENT_SECRET)")
        if not get_calendar_redirect_uri():
            missing_settings.append("GOOGLE_CALENDAR_OAUTH_REDIRECT_URI")

        if missing_settings:
            return Response(
                {
                    "error": "Google Calendar OAuth is not configured.",
                    "details": {
                        "missing_settings": missing_settings,
                        "expected_redirect_uri_path": "/api/google-calendar/callback/",
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        state = _build_oauth_state(request.user)
        payload = {
            "auth_url": build_google_calendar_auth_url(state),
            "state": state,
        }
        serializer = GoogleCalendarConnectSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)


class GoogleCalendarCallbackView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        code = request.query_params.get("code")
        state = request.query_params.get("state")
        if not code or not state:
            return redirect(f"{settings.FRONTEND_URL}/settings?google_calendar_error=missing_code")

        try:
            payload = signing.loads(
                state,
                salt=GOOGLE_CALENDAR_STATE_SALT,
                max_age=GOOGLE_CALENDAR_STATE_MAX_AGE_SECONDS,
            )
        except signing.SignatureExpired:
            return redirect(f"{settings.FRONTEND_URL}/settings?google_calendar_error=state_expired")
        except signing.BadSignature:
            return redirect(f"{settings.FRONTEND_URL}/settings?google_calendar_error=invalid_state")

        user_id = payload.get("user_id")
        if not user_id:
            return redirect(f"{settings.FRONTEND_URL}/settings?google_calendar_error=invalid_state")

        try:
            token_data = exchange_code_for_token(code)
            access_token = token_data.get("access_token")
            if not access_token:
                raise ValueError("No access token returned by Google.")
            email = fetch_google_email(access_token)
            user = User.objects.filter(id=user_id).first()
            if not user:
                return redirect(f"{settings.FRONTEND_URL}/settings?google_calendar_error=invalid_state")

            cal = ensure_import_calendar(user, email)
            primary_id = fetch_primary_calendar_id(access_token)

            connection, _ = GoogleCalendarConnection.objects.get_or_create(user_id=user_id)
            connection.google_email = email
            connection.set_access_token(access_token)
            connection.set_refresh_token(
                token_data.get("refresh_token") or connection.get_refresh_token()
            )
            connection.token_expiry = token_data.get("token_expiry")
            connection.is_active = True
            connection.needs_reconnect = False
            connection.last_error_message = None
            connection.primary_calendar_id = primary_id
            connection.import_calendar = cal
            connection.save()

            from .tasks import import_for_connection_task

            transaction.on_commit(lambda cid=connection.pk: import_for_connection_task.delay(cid))
        except (requests.RequestException, ValueError) as exc:
            logger.warning("Google Calendar callback failed: %s", exc)
            return redirect(f"{settings.FRONTEND_URL}/settings?google_calendar_error=token_exchange_failed")

        return redirect(f"{settings.FRONTEND_URL}/settings?open_google_calendar=1")


class GoogleCalendarDisconnectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        disconnect_user_calendar(request.user)
        return Response({"success": True}, status=status.HTTP_200_OK)


class GoogleCalendarSyncView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        connection = GoogleCalendarConnection.objects.filter(
            user=request.user,
            is_active=True,
        ).first()
        if not connection or not connection.get_access_token():
            return Response(
                {"error": "Google Calendar is not connected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            import_events_for_connection(connection)
        except requests.HTTPError:
            return Response(
                {"error": "Sync failed. Check connection status and try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        export_primary_calendar_events_to_google(connection)
        connection.refresh_from_db()
        return Response(
            {
                "success": True,
                "last_import_at": connection.last_import_at,
                "last_export_at": connection.last_export_at,
            }
        )
