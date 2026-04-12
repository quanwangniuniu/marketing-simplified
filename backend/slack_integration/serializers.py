from rest_framework import serializers
from .models import NotificationPreference, SlackWorkspaceConnection

class SlackOAuthInitSerializer(serializers.Serializer):
    """
    Serializer for the OAuth initialization URL response.
    """
    url = serializers.URLField(help_text="The Slack OAuth authorization URL.")
    state = serializers.CharField(help_text="Signed state used to protect the Slack OAuth flow.")

class SlackOAuthCallbackSerializer(serializers.Serializer):
    """
    Serializer for the OAuth callback.
    """
    code = serializers.CharField(required=True, help_text="The temporary authorization code from Slack.")
    state = serializers.CharField(required=True, help_text="Signed state returned by Slack for verification.")

class SlackConnectionStatusSerializer(serializers.ModelSerializer):
    """
    Serializer for exposing the current connection status.
    """
    is_connected = serializers.SerializerMethodField()
    can_manage_slack = serializers.SerializerMethodField()
    manageable_projects = serializers.SerializerMethodField()
    
    class Meta:
        model = SlackWorkspaceConnection
        fields = [
            'is_connected',
            'slack_team_id', 
            'slack_team_name', 
            'default_channel_id', 
            'default_channel_name', 
            'is_active',
            'can_manage_slack',
            'manageable_projects',
        ]
        read_only_fields = fields

    def get_is_connected(self, obj):
        return obj.is_active

    def get_can_manage_slack(self, obj):
        return bool(self.context.get("can_manage_slack", False))

    def get_manageable_projects(self, obj):
        return self.context.get("manageable_projects", [])

class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """
    Serializer for managing notification preferences.
    """
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    
    class Meta:
        model = NotificationPreference
        fields = [
            'id', 
            'project', 
            'event_type', 
            'event_type_display',
            'task_status', 
            'slack_channel_id', 
            'slack_channel_name', 
            'is_active'
        ]
        read_only_fields = ['id', 'event_type_display']

    def _get_effective_value(self, attrs, field_name):
        """
        Return the incoming value for PATCH requests, falling back to the instance.
        """
        if field_name in attrs:
            return attrs[field_name]
        if self.instance:
            return getattr(self.instance, field_name)
        return None

    def validate(self, data):
        """
        Ensure valid combination of fields (e.g., status only if event_type is STATUS_CHANGE).
        """
        event_type = self._get_effective_value(data, 'event_type')
        task_status = self._get_effective_value(data, 'task_status')

        # task_status is only meaningful for TASK_STATUS_CHANGE preferences.
        if event_type != NotificationPreference.EventType.TASK_STATUS_CHANGE and task_status:
            raise serializers.ValidationError({
                'task_status': 'task_status is only allowed for TASK_STATUS_CHANGE preferences.'
            })

        return data

class SlackTestNotificationSerializer(serializers.Serializer):
    """
    Serializer for triggering a test notification.
    """
    channel_id = serializers.CharField(required=True, help_text="Slack channel ID to send to.")
    message = serializers.CharField(required=True, help_text="Message content to send.")
