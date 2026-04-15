from rest_framework import serializers


class GoogleDocsStatusSerializer(serializers.Serializer):
    connected = serializers.BooleanField()
    google_email = serializers.CharField(allow_null=True, required=False)


class GoogleDocsConnectSerializer(serializers.Serializer):
    auth_url = serializers.URLField()
    state = serializers.CharField()


class GoogleDocsImportSerializer(serializers.Serializer):
    document_id = serializers.CharField()
    decision_id = serializers.IntegerField(required=False)


class GoogleDocsExportSerializer(serializers.Serializer):
    decision_id = serializers.IntegerField()
    title = serializers.CharField(required=False, allow_blank=True)


class GoogleDocsRawExportSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    content = serializers.CharField(required=True, allow_blank=True)
