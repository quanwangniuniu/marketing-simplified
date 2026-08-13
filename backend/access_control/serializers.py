from rest_framework import serializers

from .models import AdminOverrideAudit


class AdminOverrideAuditSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = AdminOverrideAudit
        fields = [
            'id', 'user_id', 'username', 'organization_id', 'override_type',
            'module', 'action', 'method', 'path', 'reason', 'ip_address',
            'created_at',
        ]
        read_only_fields = fields
