from rest_framework import serializers
from task.models import Task
from core.models import CustomUser


class DashboardUserSerializer(serializers.ModelSerializer):
    """Lightweight user serializer for dashboard activity feed"""
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email']


class DashboardTaskSerializer(serializers.ModelSerializer):
    """Lightweight task serializer for dashboard activity feed"""
    key = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = ['id', 'key', 'summary', 'status', 'type', 'priority']

    def get_key(self, obj):
        """Generate a task key using the project's ID as prefix."""
        project = getattr(obj, "project", None)
        if project and getattr(project, "id", None):
            prefix = project.id
        else:
            # Fallback for tasks without an associated project
            prefix = "TASK"
        return f"{prefix}-{obj.id}"


class ActivityEventSerializer(serializers.Serializer):
    """Serializer for unified activity feed events"""
    id = serializers.CharField()
    event_type = serializers.CharField()
    user = DashboardUserSerializer()
    task = DashboardTaskSerializer()
    timestamp = serializers.DateTimeField()
    human_readable = serializers.CharField()
    # Optional fields for specific event types
    field_changed = serializers.CharField(required=False, allow_null=True)
    old_value = serializers.CharField(required=False, allow_null=True)
    new_value = serializers.CharField(required=False, allow_null=True)
    is_approved = serializers.BooleanField(required=False, allow_null=True)
    comment_body = serializers.CharField(required=False, allow_null=True)


class StatusBreakdownSerializer(serializers.Serializer):
    """Serializer for status breakdown data"""
    status = serializers.CharField()
    display_name = serializers.CharField()
    count = serializers.IntegerField()
    color = serializers.CharField(required=False)


class PriorityBreakdownSerializer(serializers.Serializer):
    """Serializer for priority breakdown data"""
    priority = serializers.CharField()
    count = serializers.IntegerField()


class TypeBreakdownSerializer(serializers.Serializer):
    """Serializer for work type breakdown data"""
    type = serializers.CharField()
    display_name = serializers.CharField()
    count = serializers.IntegerField()
    percentage = serializers.FloatField()


class TimeMetricsSerializer(serializers.Serializer):
    """Serializer for time-based metrics"""
    completed_last_7_days = serializers.IntegerField()
    updated_last_7_days = serializers.IntegerField()
    created_last_7_days = serializers.IntegerField()
    due_soon = serializers.IntegerField()


class StatusOverviewSerializer(serializers.Serializer):
    """Serializer for status overview section"""
    total_work_items = serializers.IntegerField()
    breakdown = StatusBreakdownSerializer(many=True)


class DashboardSummarySerializer(serializers.Serializer):
    """Main serializer for dashboard summary endpoint"""
    time_metrics = TimeMetricsSerializer()
    status_overview = StatusOverviewSerializer()
    priority_breakdown = PriorityBreakdownSerializer(many=True)
    types_of_work = TypeBreakdownSerializer(many=True)
    recent_activity = ActivityEventSerializer(many=True)


# ── SMP-472: Project Workspace Dashboard serializers ──────────────────────

from decision.models import Decision
from spreadsheet.models import Spreadsheet, WorkflowPattern


class WorkspaceDecisionSerializer(serializers.ModelSerializer):
    """Decision summary for Project Workspace Dashboard."""
    has_unresolved_tasks = serializers.SerializerMethodField()

    class Meta:
        model = Decision
        fields = ['id', 'title', 'status', 'risk_level', 'updated_at', 'has_unresolved_tasks']

    def get_has_unresolved_tasks(self, obj):
        """Return True if this decision has linked tasks not yet completed."""
        return obj.has_unresolved_tasks_flag


class WorkspaceTaskSerializer(serializers.ModelSerializer):
    """Task summary for Project Workspace Dashboard."""
    is_blocked = serializers.SerializerMethodField()
    is_decision_linked = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'summary', 'status', 'priority', 'type',
            'due_date', 'updated_at', 'is_blocked', 'is_decision_linked'
        ]

    def get_is_blocked(self, obj):
        """Return True if this task is blocked by another task via TaskRelation.BLOCKS."""
        return obj.is_blocked_flag

    def get_is_decision_linked(self, obj):
        """Return True if this task is linked to a Decision via content_type GenericForeignKey."""
        return obj.is_decision_linked_flag


class WorkspaceSpreadsheetSerializer(serializers.ModelSerializer):
    """Spreadsheet summary for Project Workspace Dashboard."""
    has_running_job = serializers.SerializerMethodField()

    class Meta:
        model = Spreadsheet
        fields = ['id', 'name', 'updated_at', 'has_running_job']

    def get_has_running_job(self, obj):
        """Return True if this spreadsheet has a queued or running PatternJob."""
        return obj.has_running_job_flag


class WorkspacePatternSerializer(serializers.ModelSerializer):
    """WorkflowPattern summary for Project Workspace Dashboard."""

    class Meta:
        model = WorkflowPattern
        fields = ['id', 'name', 'description', 'version', 'updated_at']


class ProjectWorkspaceDashboardSerializer(serializers.Serializer):
    """Main serializer for SMP-472 Project Workspace Dashboard endpoint."""
    decisions = WorkspaceDecisionSerializer(many=True)
    tasks = WorkspaceTaskSerializer(many=True)
    spreadsheets = WorkspaceSpreadsheetSerializer(many=True)
    patterns = WorkspacePatternSerializer(many=True)