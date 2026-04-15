from rest_framework import serializers
from .models import (
    AgentSession, AgentMessage, AgentWorkflowRun, ImportedCSVFile,
    AgentWorkflowDefinition, AgentWorkflowStep, AgentStepExecution,
)


class AgentMessageSerializer(serializers.ModelSerializer):
    data = serializers.JSONField(source='metadata', read_only=True)

    class Meta:
        model = AgentMessage
        fields = ['id', 'role', 'content', 'message_type', 'data', 'created_at']
        read_only_fields = ['id', 'created_at']


class AgentSessionListSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = AgentSession
        fields = ['id', 'title', 'status', 'created_at', 'message_count']
        read_only_fields = ['id', 'created_at']

    def get_message_count(self, obj):
        return obj.messages.count()


class AgentSessionDetailSerializer(serializers.ModelSerializer):
    messages = AgentMessageSerializer(many=True, read_only=True)
    follow_up_available = serializers.SerializerMethodField()
    follow_up_started = serializers.SerializerMethodField()

    class Meta:
        model = AgentSession
        fields = ['id', 'title', 'status', 'created_at', 'updated_at', 'messages', 'follow_up_available', 'follow_up_started']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']

    def get_follow_up_available(self, obj):
        return obj.workflow_runs.filter(
            status='awaiting_confirmation',
            chat_follow_up_started=False,
            chat_followed_up=False,
            is_deleted=False,
        ).exists()

    def get_follow_up_started(self, obj):
        return obj.workflow_runs.filter(
            status='awaiting_confirmation',
            chat_follow_up_started=True,
            chat_followed_up=False,
            is_deleted=False,
        ).exists()


class AgentWorkflowRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentWorkflowRun
        fields = [
            'id', 'session', 'spreadsheet', 'decision',
            'workflow_definition', 'current_step_order', 'status',
            'analysis_result', 'created_tasks', 'error_message',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ImportedCSVFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportedCSVFile
        fields = [
            'id', 'filename', 'original_filename',
            'row_count', 'column_count', 'file_size',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ChatInputSerializer(serializers.Serializer):
    message = serializers.CharField(required=True)
    spreadsheet_id = serializers.IntegerField(required=False, allow_null=True)
    csv_filename = serializers.RegexField(
        r'^[\w\-. ()]+\.(csv|xlsx|xls)$', required=False, allow_null=True,
        error_messages={'invalid': 'Invalid filename format.'}
    )
    file_id = serializers.UUIDField(required=False, allow_null=True)
    action = serializers.ChoiceField(
        choices=[
            'analyze', 'confirm_decision', 'create_tasks', 'generate_miro',
            'distribute_message', 'start_follow_up', 'cancel_follow_up',
            'confirm_columns',
        ],
        required=False,
        allow_null=True,
    )
    calendar_context = serializers.JSONField(required=False, allow_null=True)
    workflow_id = serializers.UUIDField(required=False, allow_null=True)
    # User-approved column mapping for confirm_columns action.
    # Format: {original_header: canonical_name or "unknown"}
    column_mapping = serializers.JSONField(required=False, allow_null=True)


class AgentWorkflowStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentWorkflowStep
        fields = ['id', 'name', 'step_type', 'order', 'config', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class AgentWorkflowDefinitionListSerializer(serializers.ModelSerializer):
    step_count = serializers.SerializerMethodField()

    class Meta:
        model = AgentWorkflowDefinition
        fields = [
            'id', 'name', 'description', 'is_default', 'is_system',
            'status', 'step_count', 'created_at',
        ]
        read_only_fields = ['id', 'is_system', 'created_at']

    def get_step_count(self, obj):
        return obj.steps.filter(is_deleted=False).count()


class AgentWorkflowDefinitionDetailSerializer(serializers.ModelSerializer):
    steps = serializers.SerializerMethodField()

    class Meta:
        model = AgentWorkflowDefinition
        fields = [
            'id', 'name', 'description', 'is_default', 'is_system',
            'status', 'steps', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_system', 'created_at', 'updated_at']

    def get_steps(self, obj):
        active_steps = obj.steps.filter(is_deleted=False).order_by('order')
        return AgentWorkflowStepSerializer(active_steps, many=True).data


class AgentStepExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentStepExecution
        fields = [
            'id', 'step_order', 'step_name', 'status',
            'input_data', 'output_data', 'error_message',
            'started_at', 'completed_at',
        ]
        read_only_fields = ['id', 'started_at', 'completed_at']


class StepReorderSerializer(serializers.Serializer):
    step_ids = serializers.ListField(child=serializers.UUIDField())
