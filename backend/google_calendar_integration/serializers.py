from rest_framework import serializers


class GoogleCalendarStatusSerializer(serializers.Serializer):
    connected = serializers.BooleanField()
    google_email = serializers.CharField(allow_null=True, required=False)
    needs_reconnect = serializers.BooleanField()
    last_import_at = serializers.DateTimeField(allow_null=True, required=False)
    last_export_at = serializers.DateTimeField(allow_null=True, required=False)
    last_error_message = serializers.CharField(allow_null=True, required=False)


class GoogleCalendarConnectSerializer(serializers.Serializer):
    auth_url = serializers.URLField()
    state = serializers.CharField()
