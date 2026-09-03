from rest_framework import serializers
from .models import AdminAuditEvent

class AdminAuditEventSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AdminAuditEvent
        fields = [
            "id",
            "organization_id",
            "project_id",
            "actor_id",
            "actor_email",
            "actor_name",
            "action",
            "target_type",
            "target_id",
            "target_name",
            "before",
            "after",
            "timestamp"
        ]

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor else None

    def get_actor_name(self, obj):
        if not obj.actor:
            return None
        return obj.actor.get_full_name() or obj.actor.username