import json
import logging

from django.shortcuts import redirect, get_object_or_404
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model
from django.core import signing
from django.utils.crypto import get_random_string
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny

from meetings.models import Meeting
from meetings.views import _ensure_project_membership

from .services import (
    get_authorization_url,
    exchange_code_for_token,
    save_token_for_user,
    create_zoom_meeting,
    upsert_zoom_meeting_identity,
    find_zoom_meeting_data_for_webhook,
)
from .tasks import process_zoom_webhook_event
from .webhook import (
    ZOOM_URL_VALIDATION_EVENT,
    encrypt_zoom_url_validation_token,
    is_timestamp_valid,
    verify_zoom_webhook_signature,
)
from .models import ZoomCredential
from .serializers import (
    CreateMeetingSerializer,
    MeetingResponseSerializer,
    ZoomMeetingLinkSerializer,
)

logger = logging.getLogger(__name__)


def _zoom_api_id_to_str(value) -> str:
    """Zoom may return numeric ids; normalize to str for API and storage."""
    if value is None:
        return ""
    return str(value)


ZOOM_OAUTH_STATE_SALT = "zoom-oauth-state"
ZOOM_OAUTH_STATE_MAX_AGE_SECONDS = 600


def _build_zoom_oauth_state(user) -> str:
    """Signed OAuth state: binds Zoom callback to a user without relying on session cookies."""
    return signing.dumps(
        {"user_id": user.id, "nonce": get_random_string(16)},
        salt=ZOOM_OAUTH_STATE_SALT,
    )


class ZoomConnectView(APIView):
    """
    GET /api/v1/zoom/connect/
    Generate Zoom authorization URL, redirect user to Zoom for authorization
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        state = _build_zoom_oauth_state(request.user)
        auth_url = get_authorization_url(state)
        return Response({"auth_url": auth_url})


class ZoomCallbackView(APIView):
    """
    GET /api/v1/zoom/callback/
    Zoom authorization completed, callback here, exchange code for token.
    No JWT auth required — user id is carried in the signed ``state`` query param
    (session cookies are unreliable across API vs OAuth redirect domains).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get("code")
        state = request.query_params.get("state")

        if not state:
            return redirect(f"{settings.FRONTEND_URL}/integrations-v2?zoom_error=invalid_state")

        try:
            payload = signing.loads(
                state,
                salt=ZOOM_OAUTH_STATE_SALT,
                max_age=ZOOM_OAUTH_STATE_MAX_AGE_SECONDS,
            )
        except signing.SignatureExpired:
            return redirect(f"{settings.FRONTEND_URL}/integrations-v2?zoom_error=state_expired")
        except signing.BadSignature:
            return redirect(f"{settings.FRONTEND_URL}/integrations-v2?zoom_error=invalid_state")

        user_id = payload.get("user_id")
        if not user_id:
            return redirect(f"{settings.FRONTEND_URL}/integrations-v2?zoom_error=invalid_state")

        if not code:
            error = request.query_params.get("error", "unknown")
            return redirect(f"{settings.FRONTEND_URL}/integrations-v2?zoom_error={error}")

        User = get_user_model()
        try:
            user = User.objects.get(id=user_id)
            token_data = exchange_code_for_token(code)
            save_token_for_user(user, token_data)
        except User.DoesNotExist:
            return redirect(f"{settings.FRONTEND_URL}/integrations-v2?zoom_error=user_not_found")
        except Exception:
            return redirect(f"{settings.FRONTEND_URL}/integrations-v2?zoom_error=token_exchange_failed")

        return redirect(f"{settings.FRONTEND_URL}/meetings?zoom_connected=true")


class ZoomStatusView(APIView):
    """
    GET /api/v1/zoom/status/
    Check if the current user is connected to Zoom
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        connected = ZoomCredential.objects.filter(user=request.user).exists()
        return Response({"connected": connected})


class ZoomDisconnectView(APIView):
    """
    DELETE /api/v1/zoom/disconnect/
    Disconnect from Zoom (delete token)
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        ZoomCredential.objects.filter(user=request.user).delete()
        return Response({"message": "Successfully disconnected from Zoom"})


class CreateMeetingView(APIView):
    """
    POST /api/v1/zoom/meetings/
    Create a Zoom meeting
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateMeetingSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            meeting_data = create_zoom_meeting(
                user=request.user,
                topic=serializer.validated_data["topic"],
                start_time=serializer.validated_data["start_time"].isoformat(),
                duration=serializer.validated_data["duration"],
            )
        except ValueError as e:
            # user not connected to Zoom
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except PermissionError as e:
            # token invalid
            return Response({"error": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception:
            logger.exception(
                "Zoom create meeting failed",
                extra={"user_id": getattr(request.user, "id", None)},
            )
            return Response(
                {
                    "error": "Could not create Zoom meeting. Please try again later.",
                    "code": "zoom_meeting_create_failed",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Map Zoom's "id" to API field "meeting_id" (DRF input validation uses field names, not source=).
        zoom_uuid = meeting_data.get("uuid")
        response_payload = {
            "meeting_id": _zoom_api_id_to_str(meeting_data.get("id")),
            "uuid": "" if zoom_uuid is None else str(zoom_uuid),
            "topic": meeting_data.get("topic"),
            "join_url": meeting_data.get("join_url"),
            "start_url": meeting_data.get("start_url"),
            "start_time": meeting_data.get("start_time"),
            "duration": meeting_data.get("duration"),
        }
        response_serializer = MeetingResponseSerializer(data=response_payload)
        if not response_serializer.is_valid():
            logger.error(
                "Zoom create meeting returned unexpected payload",
                extra={
                    "user_id": getattr(request.user, "id", None),
                    "errors": response_serializer.errors,
                },
            )
            return Response(
                {
                    "error": "Could not create Zoom meeting. Please try again later.",
                    "code": "zoom_meeting_create_failed",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            response_serializer.validated_data,
            status=status.HTTP_201_CREATED,
        )


class ZoomMeetingLinkView(APIView):
    """
    POST /api/v1/zoom/meetings/link/
    Persist Zoom meeting identity on the project's MediaJira Meeting (ZoomMeetingData).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ZoomMeetingLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        meeting = get_object_or_404(
            Meeting.objects.filter(is_deleted=False),
            id=serializer.validated_data["meeting_id"],
            project_id=serializer.validated_data["project_id"],
        )
        _ensure_project_membership(request.user, meeting.project)

        upsert_zoom_meeting_identity(
            meeting,
            zoom_meeting_id=serializer.validated_data["zoom_meeting_id"],
            zoom_uuid=serializer.validated_data.get("zoom_uuid") or "",
            zoom_host_user=request.user,
        )
        return Response(
            {
                "project_id": meeting.project_id,
                "meeting_id": meeting.id,
                "zoom_meeting_id": serializer.validated_data["zoom_meeting_id"],
                "zoom_uuid": serializer.validated_data.get("zoom_uuid") or "",
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name="dispatch")
class ZoomWebhookView(APIView):
    """
    POST /api/v1/zoom/webhook/
    Zoom event notifications. ``endpoint.url_validation`` is handled first (no HMAC).
    Other events require ``x-zm-request-timestamp`` and ``x-zm-signature`` (v0 HMAC).
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw_body = request.body
        try:
            data = json.loads(raw_body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return Response({"error": "invalid json"}, status=status.HTTP_400_BAD_REQUEST)

        secret = getattr(settings, "ZOOM_WEBHOOK_SECRET_TOKEN", "") or ""
        event = data.get("event")

        if event == ZOOM_URL_VALIDATION_EVENT:
            if not secret:
                return Response(
                    {"error": "webhook secret not configured"},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            payload = data.get("payload") or {}
            plain = payload.get("plainToken")
            if not plain or not isinstance(plain, str):
                return Response(
                    {"error": "invalid url validation payload"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            enc = encrypt_zoom_url_validation_token(plain, secret)
            return Response(
                {"plainToken": plain, "encryptedToken": enc},
                status=status.HTTP_200_OK,
            )

        if not secret:
            return Response(
                {"error": "webhook secret not configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        ts = request.headers.get("x-zm-request-timestamp") or request.headers.get(
            "X-ZM-REQUEST-TIMESTAMP"
        )
        sig = request.headers.get("x-zm-signature") or request.headers.get("X-ZM-SIGNATURE")
        if not ts or not is_timestamp_valid(ts):
            return Response({"error": "invalid timestamp"}, status=status.HTTP_401_UNAUTHORIZED)
        if not sig or not verify_zoom_webhook_signature(
            raw_body=raw_body,
            timestamp=ts,
            signature_header=sig,
            secret=secret,
        ):
            return Response({"error": "invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        payload = data.get("payload") or {}
        obj = payload.get("object") or {}
        zoom_meeting_id = str(obj.get("id") or "").strip()
        zu = obj.get("uuid")
        zoom_uuid_str = "" if zu is None else str(zu)

        row = find_zoom_meeting_data_for_webhook(
            zoom_meeting_id,
            zoom_uuid_str if zoom_uuid_str else None,
        )
        if not row:
            logger.info(
                "Zoom webhook: no ZoomMeetingData for zoom_meeting_id=%s (event=%s)",
                zoom_meeting_id,
                event,
            )
            return Response({"received": True}, status=status.HTTP_200_OK)

        try:
            process_zoom_webhook_event.delay(
                event_type=event or "",
                zoom_meeting_data_id=row.pk,
                webhook_uuid=zoom_uuid_str,
            )
        except Exception:
            logger.exception("Zoom webhook: failed to enqueue Celery task")
            return Response({"error": "enqueue failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({"received": True}, status=status.HTTP_200_OK)