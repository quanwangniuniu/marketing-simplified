from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from django.conf import settings
from django.core import signing
from django.utils.crypto import get_random_string
from .models import SlackWorkspaceConnection, NotificationPreference
from .permissions import resolve_slack_access
from .serializers import (
    SlackOAuthInitSerializer, 
    SlackOAuthCallbackSerializer, 
    SlackConnectionStatusSerializer,
    NotificationPreferenceSerializer,
    SlackTestNotificationSerializer
)
from .services import (
    exchange_oauth_code,
    store_slack_connection,
    revoke_slack_connection,
    send_slack_message,
    get_slack_channels
)
from django.core.exceptions import ValidationError
from urllib.parse import urlencode

SLACK_OAUTH_STATE_SALT = "slack-oauth-state"
SLACK_OAUTH_STATE_MAX_AGE_SECONDS = 600


class SlackManagementAccessMixin:
    slack_permission_denied_message = (
        "You do not have permission to manage Slack for the requested project or organization."
    )

    def get_slack_access_scope(self, request, organization_id=None):
        return resolve_slack_access(
            request.user,
            request=request,
            organization_id=organization_id,
        )

    def require_slack_access(self, request, organization_id=None):
        scope = self.get_slack_access_scope(request, organization_id=organization_id)
        if not scope.can_manage_slack:
            raise PermissionDenied(self.slack_permission_denied_message)
        return scope

    def get_active_connection(self, request, scope=None):
        scope = scope or getattr(self, "slack_access_scope", None) or self.get_slack_access_scope(request)
        organization = getattr(scope, "organization", None)
        if organization is None:
            return None

        return SlackWorkspaceConnection.objects.filter(
            organization=organization,
            is_active=True,
        ).first()


class SlackAuthViewSet(SlackManagementAccessMixin, viewsets.ViewSet):
    """
    ViewSet for handling Slack OAuth flow.
    """
    permission_classes = [permissions.IsAuthenticated]

    def _build_oauth_state(self, user, organization_id):
        """
        Generates a signed state payload tied to the authenticated user.
        """
        return signing.dumps(
            {
                "user_id": user.id,
                "organization_id": organization_id,
                "nonce": get_random_string(16)
            },
            salt=SLACK_OAUTH_STATE_SALT
        )

    def _validate_oauth_state(self, state, user):
        """
        Validates the signed state payload and ensures it belongs to the current user.
        """
        try:
            payload = signing.loads(
                state,
                salt=SLACK_OAUTH_STATE_SALT,
                max_age=SLACK_OAUTH_STATE_MAX_AGE_SECONDS
            )
        except signing.SignatureExpired:
            raise ValidationError("Slack OAuth state has expired. Please try again.")
        except signing.BadSignature:
            raise ValidationError("Invalid Slack OAuth state.")

        if payload.get("user_id") != user.id:
            raise ValidationError("Slack OAuth state does not match the current user.")

        organization_id = payload.get("organization_id")
        if not organization_id:
            raise ValidationError("Slack OAuth state is missing organization context.")

        return payload

    @action(detail=False, methods=['get'])
    def init(self, request):
        """Generates the Slack OAuth Authorization URL."""
        scope = self.require_slack_access(request)

        client_id = settings.SLACK_CLIENT_ID
        redirect_uri = settings.SLACK_REDIRECT_URI
        scopes = "channels:read,chat:write,chat:write.public,commands,incoming-webhook,groups:read,im:read,mpim:read"

        state = self._build_oauth_state(request.user, scope.organization.id)
        oauth_url = "https://slack.com/oauth/v2/authorize?" + urlencode(
            {
                "client_id": client_id,
                "scope": scopes,
                "redirect_uri": redirect_uri,
                "state": state
            }
        )

        serializer = SlackOAuthInitSerializer(data={'url': oauth_url, 'state': state})
        serializer.is_valid()
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def callback(self, request):
        """Exchanges the temporary authorization code for an access token and persists the connection."""
        serializer = SlackOAuthCallbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data['code']
        state = serializer.validated_data['state']
        try:
            state_payload = self._validate_oauth_state(state, request.user)
        except ValidationError as e:
            error_message = e.messages[0] if getattr(e, "messages", None) else str(e)
            return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)

        scope = self.require_slack_access(
            request,
            organization_id=state_payload["organization_id"],
        )

        try:
            # Exchange code for token
            slack_data = exchange_oauth_code(code)
            
            # Store connection for the resolved Slack organization context
            connection = store_slack_connection(scope.organization, slack_data)
            
            return Response({
                "success": True,
                "team_name": connection.slack_team_name,
                "team_id": connection.slack_team_id
            }, status=status.HTTP_200_OK)
            
        except ValidationError as e:
            error_message = e.messages[0] if getattr(e, "messages", None) else str(e)
            return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Log exact error in prod, generic message here
            return Response({"error": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SlackConnectionView(SlackManagementAccessMixin, APIView):
    """Manages the lifecycle of the Slack Workspace Connection for the organization."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Retrieves the current connection status."""
        scope = self.get_slack_access_scope(request)

        base_payload = {
            "can_manage_slack": scope.can_manage_slack,
            "manageable_projects": [
                {"id": project.id, "name": project.name}
                for project in scope.manageable_projects
            ],
        }

        if not scope.can_manage_slack:
            return Response(
                {
                    "is_connected": False,
                    "slack_team_id": None,
                    "slack_team_name": None,
                    "default_channel_id": None,
                    "default_channel_name": None,
                    "is_active": False,
                    **base_payload,
                }
            )

        connection = self.get_active_connection(request, scope)

        if connection:
            serializer = SlackConnectionStatusSerializer(
                connection,
                context=base_payload,
            )
            return Response(serializer.data)

        return Response(
            {
                "is_connected": False,
                "slack_team_id": None,
                "slack_team_name": None,
                "default_channel_id": None,
                "default_channel_name": None,
                "is_active": False,
                **base_payload,
            }
        )

    def post(self, request):
        """
        Disconnect (revoke) the integration.
        """
        scope = self.require_slack_access(request)
        connection = self.get_active_connection(request, scope)
        if connection:
            revoke_slack_connection(connection)
            return Response({"success": True}, status=status.HTTP_200_OK)
        return Response({"error": "No active connection found."}, status=status.HTTP_404_NOT_FOUND)

class SlackChannelListView(SlackManagementAccessMixin, APIView):
    """
    Returns a list of public and private channels from the connected Slack workspace.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = self.require_slack_access(request)

        connection = self.get_active_connection(request, scope)
        
        if not connection:
             return Response({"error": "No active Slack connection found."}, status=status.HTTP_404_NOT_FOUND)

        channels = get_slack_channels(connection)
        return Response(channels)

class NotificationPreferenceViewSet(SlackManagementAccessMixin, viewsets.ModelViewSet):
    """
    CRUD for Notification Preferences.
    """
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.slack_access_scope = self.require_slack_access(request)

    def get_queryset(self):
        manageable_projects = getattr(
            self,
            "slack_access_scope",
            self.get_slack_access_scope(self.request),
        ).manageable_projects

        return (
            NotificationPreference.objects.filter(
                project__in=manageable_projects
            )
            .select_related("project", "connection")
            .order_by("project_id", "event_type", "id")
        )

    def _validate_project_access(self, project):
        manageable_project_ids = set(
            self.slack_access_scope.manageable_projects.values_list("id", flat=True)
        )
        if project.id not in manageable_project_ids:
            raise DRFValidationError(
                {"project": "You do not have permission to manage Slack for this project."}
            )

    def _get_required_connection(self):
        connection = self.get_active_connection(
            self.request,
            getattr(self, "slack_access_scope", None),
        )
        if not connection:
            raise DRFValidationError(
                {"connection": "No active Slack connection found for this organization."}
            )
        return connection

    def perform_create(self, serializer):
        project = serializer.validated_data.get("project")
        if project is None:
            raise DRFValidationError({"project": "This field is required."})

        self._validate_project_access(project)
        serializer.save(connection=self._get_required_connection())

    def perform_update(self, serializer):
        project = serializer.validated_data.get("project", serializer.instance.project)
        self._validate_project_access(project)

        save_kwargs = {}
        if "project" in serializer.validated_data:
            save_kwargs["connection"] = self._get_required_connection()

        serializer.save(**save_kwargs)

class SlackNotificationTestView(SlackManagementAccessMixin, APIView):
    """
    Internal endpoint to trigger a test notification.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        scope = self.require_slack_access(request)

        serializer = SlackTestNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        channel_id = serializer.validated_data['channel_id']
        message = serializer.validated_data['message']
        
        # Determine which connection to use
        # For simple implementations, grab the first active one for the org
        connection = self.get_active_connection(request, scope)
        
        if not connection:
             return Response({"error": "No active Slack connection found."}, status=status.HTTP_404_NOT_FOUND)

        success = send_slack_message(connection, channel_id, message)
        
        if success:
            return Response({"status": "Message sent successfully"}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Failed to send message to Slack"}, status=status.HTTP_502_BAD_GATEWAY)
