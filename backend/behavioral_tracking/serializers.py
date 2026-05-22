from rest_framework import serializers


class TaskEngagementSummarySerializer(serializers.Serializer):
    """Output for GET /tasks/<task_id>/engagement-summary/ (Focus insights)."""

    visits = serializers.IntegerField()
    estimated_active_ms = serializers.IntegerField()
    last_operated_at = serializers.DateTimeField(allow_null=True)
    write_operations_count = serializers.IntegerField()
