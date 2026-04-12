import logging

from django.shortcuts import redirect
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.utils.crypto import get_random_string
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny

from .services import (
    get_authorization_url,
    exchange_code_for_token,
    save_token_for_user,
    create_zoom_meeting,
)
from .models import ZoomCredential
from .serializers import CreateMeetingSerializer, MeetingResponseSerializer

logger = logging.getLogger(__name__)

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
            return redirect(f"{settings.FRONTEND_URL}/settings?zoom_error=invalid_state")

        try:
            payload = signing.loads(
                state,
                salt=ZOOM_OAUTH_STATE_SALT,
                max_age=ZOOM_OAUTH_STATE_MAX_AGE_SECONDS,
            )
        except signing.SignatureExpired:
            return redirect(f"{settings.FRONTEND_URL}/settings?zoom_error=state_expired")
        except signing.BadSignature:
            return redirect(f"{settings.FRONTEND_URL}/settings?zoom_error=invalid_state")

        user_id = payload.get("user_id")
        if not user_id:
            return redirect(f"{settings.FRONTEND_URL}/settings?zoom_error=invalid_state")

        if not code:
            error = request.query_params.get("error", "unknown")
            return redirect(f"{settings.FRONTEND_URL}/settings?zoom_error={error}")

        User = get_user_model()
        try:
            user = User.objects.get(id=user_id)
            token_data = exchange_code_for_token(code)
            save_token_for_user(user, token_data)
        except User.DoesNotExist:
            return redirect(f"{settings.FRONTEND_URL}/settings?zoom_error=user_not_found")
        except Exception:
            return redirect(f"{settings.FRONTEND_URL}/settings?zoom_error=token_exchange_failed")

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
        response_payload = {
            "meeting_id": meeting_data.get("id"),
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