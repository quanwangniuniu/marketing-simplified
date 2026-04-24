from rest_framework import serializers

from .models import FacebookConnection, MetaAdAccount


class MetaAdAccountSerializer(serializers.ModelSerializer):
    project_id = serializers.PrimaryKeyRelatedField(
        source="project", read_only=True
    )

    class Meta:
        model = MetaAdAccount
        fields = [
            "id",
            "meta_account_id",
            "name",
            "currency",
            "timezone_name",
            "account_status",
            "business_id",
            "is_owned",
            "project_id",
        ]


class FacebookConnectionStatusSerializer(serializers.Serializer):
    connected = serializers.BooleanField()
    fb_user_name = serializers.CharField(required=False, allow_blank=True)
    fb_email = serializers.EmailField(required=False, allow_null=True)
    business_id = serializers.CharField(required=False, allow_blank=True)
    business_name = serializers.CharField(required=False, allow_blank=True)
    token_expires_at = serializers.DateTimeField(required=False, allow_null=True)
    last_synced_at = serializers.DateTimeField(required=False, allow_null=True)
    ad_accounts = MetaAdAccountSerializer(many=True, required=False)


class ConnectInitSerializer(serializers.Serializer):
    authorize_url = serializers.URLField()
    state = serializers.CharField()


class LinkProjectSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(allow_null=True)
