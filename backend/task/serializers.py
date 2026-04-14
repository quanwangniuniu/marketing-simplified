from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from rest_framework import serializers

from meetings.knowledge_links import serialize_origin_meeting, serialize_origin_action_item
from meetings.models import MeetingTaskOrigin
from meetings.services import validate_meeting_for_origin_link
from task.models import Task, ApprovalRecord, TaskComment, TaskAttachment, TaskHierarchy, TaskRelation
from core.models import Project, ProjectMember
from core.utils.project import get_user_active_project
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db.utils import OperationalError, ProgrammingError
import logging
import mimetypes
import traceback

logger = logging.getLogger(__name__)

User = get_user_model()


class UserSummarySerializer(serializers.ModelSerializer):
    """Serializer for user summary information"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class ProjectSummarySerializer(serializers.ModelSerializer):
    """Serializer for project summary information"""
    class Meta:
        model = Project
        fields = ['id', 'name']


class TaskSerializer(serializers.ModelSerializer):
    """Serializer for Task model"""
    owner = UserSummarySerializer(read_only=True)
    owner_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    project = ProjectSummarySerializer(read_only=True)
    project_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    current_approver = UserSummarySerializer(read_only=True)
    current_approver_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    create_as_draft = serializers.BooleanField(write_only=True, required=False, default=False)
    draft_payload = serializers.JSONField(required=False, allow_null=True)
    is_subtask = serializers.BooleanField(read_only=True)
    parent_relationship = serializers.SerializerMethodField()
    order_in_project = serializers.IntegerField(required=False)
    approval_chain_progress = serializers.SerializerMethodField()
    can_lock = serializers.SerializerMethodField()
    approvals_summary = serializers.SerializerMethodField()
    content_type = serializers.SerializerMethodField()
    # Revision tracking fields for SMP-501
    revision_round = serializers.IntegerField(read_only=True)
    revision_label = serializers.SerializerMethodField()
    origin_meeting = serializers.SerializerMethodField()
    origin_meeting_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
    )
    origin_action_item = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'summary', 'description', 'status', 'type',
            'owner', 'owner_id', 'project', 'project_id',
            'current_approver', 'current_approver_id',
            'content_type', 'object_id', 'start_date', 'due_date', 'planned_start_date',
            'is_subtask', 'parent_relationship', 'order_in_project',
            'anomaly_status', 'approval_chain_progress',
            # Revision tracking fields for SMP-501
            'revision_round', 'revision_label',
            'can_lock', 'approvals_summary',
            'create_as_draft', 'draft_payload',
            'origin_meeting',
            'origin_meeting_id',
            'origin_action_item',
        ]
        read_only_fields = [
            'id', 'status', 'owner', 'content_type', 'object_id',
            'is_subtask', 'parent_relationship', 'anomaly_status',
            'approval_chain_progress', 'can_lock', 'approvals_summary',
            'revision_round', 'revision_label', # SMP-501
            'origin_meeting',
            'origin_action_item',
        ]

    def get_content_type(self, obj):
        """
        Represent the linked object's content type as its model name string.

        For example, a BudgetRequest link should return "budgetrequest"
        instead of the internal ContentType primary key.
        """
        if not obj.content_type:
            return None
        return obj.content_type.model

    def get_origin_meeting(self, obj):
        try:
            origin = obj.meeting_origin
        except ObjectDoesNotExist:
            return None
        meeting = origin.meeting
        if meeting is None:
            return None
        return serialize_origin_meeting(meeting)

    def get_origin_action_item(self, obj):
        if getattr(obj, "origin_action_item_id", None) is None:
            return None
        from meetings.models import MeetingActionItem

        try:
            ai = MeetingActionItem.objects.select_related("meeting").get(
                pk=obj.origin_action_item_id,
            )
        except MeetingActionItem.DoesNotExist:
            return None
        return serialize_origin_action_item(ai)

    def get_approval_chain_progress(self, obj):
        """
        Return approval chain progress info for the frontend.

        Returns None if no chain is assigned (legacy single-approver mode).
        Otherwise returns:
          {
            "current_step": 2,
            "total_steps": 3,
            "step_display": "Step 2 of 3",
            "chain_name": "Buyer → Lead → Client",
            "next_approver": { "id": ..., "username": ..., "email": ... } | null,
            "steps": [
              {
                "step_number": 1,
                "status": "approved",
                "approver": { "id": ..., "username": ..., "email": ... },
                "record": { "approved_by": {...}, "is_approved": true, "decided_time": "...", "comment": "..." }
              },
              {
                "step_number": 2,
                "status": "current",
                "approver": { ... },
                "record": null
              },
              ...
            ]
          }
        """
        if not obj.approval_chain or not obj.current_approval_step:
            return None

        chain = obj.approval_chain
        total = chain.total_steps
        current = obj.current_approval_step

        # Build a lookup of existing approval records: step_number -> record
        records = {r.step_number: r for r in obj.approval_records.all()}

        # Extract per-step role labels from chain name (e.g. "Buyer → Lead → Client")
        role_labels = [part.strip() for part in chain.name.split('→')]

        steps = []
        for step_num in range(1, total + 1):
            chain_step = chain.get_step(step_num)
            if not chain_step:
                continue

            if step_num < current:
                status = 'approved'
            elif step_num == current:
                status = 'current'
            else:
                status = 'pending'

            record = records.get(step_num)
            record_data = None
            if record:
                record_data = {
                    'approved_by': UserSummarySerializer(record.approved_by).data,
                    'is_approved': record.is_approved,
                    'decided_time': record.decided_time.isoformat(),
                    'comment': record.comment,
                }

            # Use the role label from chain name if available, otherwise fall back to "Step N"
            role_name = role_labels[step_num - 1] if step_num - 1 < len(role_labels) else f'Step {step_num}'

            steps.append({
                'step_number': step_num,
                'role_name': role_name,
                'status': status,
                'approver': UserSummarySerializer(chain_step.approver).data,
                'record': record_data,
            })

        next_step = chain.get_step(current + 1)
        return {
            'current_step': current,
            'total_steps': total,
            'step_display': f'Step {current} of {total}',
            'chain_name': chain.name,
            'next_approver': UserSummarySerializer(next_step.approver).data if next_step else None,
            'steps': steps,
        }

    def get_revision_label(self, obj):
        """Return human-readable revision label for the task"""
        if obj.revision_round == 0:
            return "Initial Submission"
        return f"Revision {obj.revision_round}"

    def get_can_lock(self, obj):
        """
        Returns True if the task is allowed to be locked right now.

        Rules:
        - Task must be in APPROVED status.
        - If an approval chain is assigned, the number of approved records
          must meet the chain's effective_required_approvals threshold.
        - Legacy tasks (no chain) can always be locked once APPROVED.
        """
        if obj.status != 'APPROVED':
            return False
        if not obj.approval_chain:
            return True  # Legacy mode: no minimum required
        approved_count = obj.approval_records.filter(is_approved=True).count()
        return approved_count >= obj.approval_chain.effective_required_approvals

    def get_approvals_summary(self, obj):
        """
        Returns a human-readable approval progress summary for chain-mode tasks.

        Example: { "approved_count": 1, "required_count": 2, "display": "1 of 2 approvals" }
        Returns None for legacy tasks (no chain assigned).
        """
        if not obj.approval_chain:
            return None
        approved_count = obj.approval_records.filter(is_approved=True).count()
        required = obj.approval_chain.effective_required_approvals
        return {
            'approved_count': approved_count,
            'required_count': required,
            'display': f'{approved_count} of {required} approvals',
        }

    def get_parent_relationship(self, obj):
        """Get parent relationship information for subtasks"""
        if not obj.is_subtask:
            return None
        hierarchy = obj.parent_relationship.first()
        if hierarchy:
            return [{
                'parent_task_id': hierarchy.parent_task_id,
            }]
        return None

    def _resolve_project(self, user, project_id):
        """Return project from id or from user's active project."""
        if project_id is not None:
            try:
                return Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                raise serializers.ValidationError({'project_id': 'Project not found'})

        project = get_user_active_project(user)
        if not project:
            raise serializers.ValidationError({
                'project_id': 'Active project is required. Set an active project or provide project_id.'
            })
        return project

    def _ensure_project_membership(self, user, project):
        """Ensure the user can access the project."""
        has_membership = ProjectMember.objects.filter(
            user=user,
            project=project,
            is_active=True,
        ).exists()
        if not has_membership:
            raise serializers.ValidationError({
                'project_id': 'You do not have access to this project.'
            })

    def create(self, validated_data):
        """Create a new task"""
        create_as_draft = validated_data.pop('create_as_draft', False)
        origin_meeting_id = validated_data.pop('origin_meeting_id', None)
        # Never persist draft payload on non-draft creates.
        if not create_as_draft:
            validated_data.pop('draft_payload', None)

        try:
            user = self.context['request'].user
            validated_data['owner'] = user

            project = self._resolve_project(user, validated_data.pop('project_id', None))
            self._ensure_project_membership(user, project)
            validated_data['project'] = project

            # Get current_approver from current_approver_id
            current_approver_id = validated_data.pop('current_approver_id', None)
            logger.debug(f"DEBUG: current_approver_id from pop: {current_approver_id}")
            logger.debug(f"DEBUG: current_approver_id type: {type(current_approver_id)}")

            if current_approver_id is not None:
                try:
                    current_approver = User.objects.get(id=current_approver_id)
                except User.DoesNotExist:
                    raise serializers.ValidationError({'current_approver_id': 'User not found'})

                # Ensure approver is a member of the same project
                has_membership = ProjectMember.objects.filter(
                    user=current_approver,
                    project=project,
                    is_active=True,
                ).exists()
                if not has_membership:
                    raise serializers.ValidationError({
                        'current_approver_id': 'Approver must be a member of the project.'
                    })

                validated_data['current_approver'] = current_approver
                logger.debug(f"DEBUG: Set current_approver to: {current_approver}")
            else:
                logger.debug("current_approver_id is None, not setting current_approver")

            # Create the task (catch missing draft_payload column so we return 400 + clear message)
            try:
                with transaction.atomic():
                    task = super().create(validated_data)
                    if origin_meeting_id is not None:
                        MeetingTaskOrigin.objects.create(
                            meeting_id=origin_meeting_id,
                            task=task,
                        )
            except (OperationalError, ProgrammingError) as db_err:
                err_msg = str(db_err).lower()
                if "draft_payload" in err_msg or "no such column" in err_msg or ("column" in err_msg and "does not exist" in err_msg):
                    raise serializers.ValidationError({
                        "draft_payload": "Database migration required for draft support. Run: python manage.py migrate task"
                    }) from db_err
                raise

            # Default behavior: auto-submit newly created tasks (DRAFT -> SUBMITTED).
            # Draft creation explicitly opts out and keeps status=DRAFT.
            if not create_as_draft:
                try:
                    task.submit()
                    task.save()
                    logger.debug(
                        f"DEBUG: Task {task.id} status changed from DRAFT to SUBMITTED"
                    )
                except Exception as e:
                    logger.error(f"ERROR: Failed to submit task {task.id}: {e}")
                    # Don't fail the creation, but log the error

            return task
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("TaskSerializer.create exception: %s\n%s", e, tb)
            raise
    
    def update(self, instance, validated_data):
        """Update a task"""
        if 'project_id' in validated_data:
            project_id = validated_data.pop('project_id')
            if project_id is not None:
                project = self._resolve_project(
                    self.context['request'].user,
                    project_id
                )
                self._ensure_project_membership(self.context['request'].user, project)
                validated_data['project'] = project
        
        # Determine project for owner and approver validation (updated or existing)
        project = validated_data.get('project', getattr(self.instance, 'project', None))

        # Handle owner_id if provided
        if 'owner_id' in validated_data:
            owner_id = validated_data.pop('owner_id')
            if owner_id is not None:
                try:
                    owner = User.objects.get(id=owner_id)
                except User.DoesNotExist:
                    raise serializers.ValidationError({'owner_id': 'User not found'})

                if project is None:
                    raise serializers.ValidationError({
                        'project_id': 'Project is required to validate owner.'
                    })

                has_membership = ProjectMember.objects.filter(
                    user=owner,
                    project=project,
                    is_active=True,
                ).exists()
                if not has_membership:
                    raise serializers.ValidationError({
                        'owner_id': 'Owner must be a member of the project.'
                    })

                validated_data['owner'] = owner
            else:
                validated_data['owner'] = None
        
        # Handle current_approver_id if provided
        if 'current_approver_id' in validated_data:
            current_approver_id = validated_data.pop('current_approver_id')
            if current_approver_id is not None:
                try:
                    current_approver = User.objects.get(id=current_approver_id)
                except User.DoesNotExist:
                    raise serializers.ValidationError({'current_approver_id': 'User not found'})

                # Ensure approver is a member of the task's project
                if project is None:
                    raise serializers.ValidationError({
                        'project_id': 'Project is required to validate approver.'
                    })

                has_membership = ProjectMember.objects.filter(
                    user=current_approver,
                    project=project,
                    is_active=True,
                ).exists()
                if not has_membership:
                    raise serializers.ValidationError({
                        'current_approver_id': 'Approver must be a member of the project.'
                    })

                validated_data['current_approver'] = current_approver
            else:
                validated_data['current_approver'] = None
        
        return super().update(instance, validated_data)
    
    def validate(self, attrs):
        """Validate the data"""
        if self.instance is not None and attrs.get('origin_meeting_id') is not None:
            try:
                self.instance.meeting_origin
            except ObjectDoesNotExist:
                raise serializers.ValidationError({
                    'origin_meeting_id': 'Meeting origin can only be set when creating a task.',
                })
            raise serializers.ValidationError({
                'origin_meeting_id': 'Task already has a meeting origin.',
            })

        origin_meeting_id = attrs.get('origin_meeting_id')
        if self.instance is None and origin_meeting_id is not None:
            user = self.context['request'].user
            project = self._resolve_project(user, attrs.get('project_id'))
            self._ensure_project_membership(user, project)
            validate_meeting_for_origin_link(
                meeting_id=origin_meeting_id,
                project=project,
                user=user,
            )

        # Only allow updating draft_payload while task is in DRAFT.
        if self.instance and 'draft_payload' in attrs:
            # Allow clearing draft_payload (null) at any status for cleanup.
            if attrs.get('draft_payload') is not None and self.instance.status != Task.Status.DRAFT:
                raise serializers.ValidationError({
                    'draft_payload': 'draft_payload can only be updated while task is in DRAFT status.'
                })

        # For updates, reject type field if provided
        if self.instance and 'type' in attrs:
            raise serializers.ValidationError({
                'type': 'Task type cannot be modified after creation.'
            })
        return attrs


class TaskListSerializer(TaskSerializer):
    """List serializer omitting large draft payloads."""

    class Meta(TaskSerializer.Meta):
        fields = [
            f
            for f in TaskSerializer.Meta.fields
            if f not in (
                'draft_payload',
                'origin_meeting',
                'origin_meeting_id',
                'origin_action_item',
            )
        ]
    
    def validate_type(self, value):
        """Validate task type against Task model choices."""
        valid_types = [choice[0] for choice in Task._meta.get_field('type').choices]
        if value not in valid_types:
            raise serializers.ValidationError(
                f"Invalid task type. Must be one of: {valid_types}"
            )
        return value
    
    content_type = serializers.SerializerMethodField()
    object_id = serializers.SerializerMethodField()
    
    def get_content_type(self, obj):
        """Get content type as string"""
        return obj.task_type
    
    def get_object_id(self, obj):
        """Get object id as string"""
        return obj.object_id


class TaskLinkSerializer(serializers.Serializer):
    """Serializer for linking task to an object"""
    content_type = serializers.CharField()
    object_id = serializers.CharField()

    def validate(self, data):
        """Validate the link data: normalize content_type, resolve ContentType once, then fetch object."""
        content_type = (data['content_type'] or '').strip().lower()
        object_id = (data['object_id'] or '').strip()
        data['content_type'] = content_type
        data['object_id'] = object_id

        try:
            ct = ContentType.objects.get(model=content_type)
        except ContentType.DoesNotExist:
            raise serializers.ValidationError({
                'content_type': f"Content type '{content_type}' not found."
            })

        model_class = ct.model_class()
        if model_class is None:
            raise serializers.ValidationError({
                'content_type': f"Content type '{content_type}' has no model class."
            })

        # For UUID fields (e.g. RetrospectiveTask), convert string to UUID
        if content_type == 'retrospectivetask':
            import uuid
            try:
                object_uuid = uuid.UUID(object_id)
                obj = model_class.objects.get(id=object_uuid)
            except (ValueError, model_class.DoesNotExist):
                raise serializers.ValidationError({
                    'object_id': f"Object with id '{object_id}' not found."
                })
        else:
            try:
                obj = model_class.objects.get(id=object_id)
            except (ValueError, model_class.DoesNotExist):
                raise serializers.ValidationError({
                    'object_id': f"Object with id '{object_id}' not found."
                })

        data['linked_object'] = obj
        return data


class TaskApprovalSerializer(serializers.Serializer):
    """Serializer for task approval/rejection requests"""
    action = serializers.ChoiceField(choices=['approve', 'reject'], required=True)
    comment = serializers.CharField(required=False, allow_blank=True)
    
    def validate_action(self, value):
        """Validate action value"""
        if value not in ['approve', 'reject']:
            raise serializers.ValidationError("Action must be either 'approve' or 'reject'")
        return value

    def validate(self, attrs):
        """Require a non-empty comment when rejecting a task."""
        action = attrs.get('action')
        comment = attrs.get('comment', '')

        if isinstance(comment, str):
            comment = comment.strip()
            attrs['comment'] = comment

        if action == 'reject' and not comment:
            raise serializers.ValidationError({
                'comment': 'Comment is required when rejecting a task'
            })

        return attrs


class TaskForwardSerializer(serializers.Serializer):
    """Serializer for task forward requests"""
    next_approver_id = serializers.IntegerField(required=True)
    comment = serializers.CharField(required=False, allow_blank=True)
    
    def validate_next_approver_id(self, value):
        """Validate next_approver_id exists"""
        try:
            User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User with this ID does not exist")
        return value


class ApprovalRecordSerializer(serializers.ModelSerializer):
    """Serializer for ApprovalRecord model"""
    approved_by = UserSummarySerializer(read_only=True)
    # Computed field: converts revision_round integer to human-readable label
    revision_label = serializers.SerializerMethodField()
    
    class Meta:
        model = ApprovalRecord
        fields = [
            'id', 'approved_by', 'is_approved', 'comment',
            'decided_time', 'step_number',
            # Revision tracking fields added for SMP-501
            'revision_round', 'revision_label',
            'resubmitted_after_reject', 'has_rejection_history'
        ]
        read_only_fields = ['id', 'approved_by', 'step_number', 'decided_time']

    def get_revision_label(self, obj):
        """Return human-readable revision label, e.g. 'Revision 2' or 'Initial Submission'"""
        if obj.revision_round == 0:
            return "Initial Submission"
        return f"Revision {obj.revision_round}"
            


class TaskCommentSerializer(serializers.ModelSerializer):
    """Serializer for TaskComment model."""
    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = TaskComment
        fields = ['id', 'task', 'user', 'body', 'created_at']
        read_only_fields = ['id', 'task', 'user', 'created_at']


class TaskAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for TaskAttachment model"""
    uploaded_by = UserSummarySerializer(read_only=True)
    original_filename = serializers.CharField(required=False)
    file_size = serializers.IntegerField(required=False)
    
    class Meta:
        model = TaskAttachment
        fields = [
            'id', 'task', 'file', 'original_filename', 'file_size',
            'content_type', 'checksum', 'scan_status', 'uploaded_by', 'created_at'
        ]
        read_only_fields = ['id', 'task', 'uploaded_by', 'created_at', 'checksum', 'scan_status']
    
    def validate(self, attrs):
        """Validate file is required for creation"""
        file_obj = attrs.get('file')
        if self.instance is None and file_obj is None:
            raise serializers.ValidationError("File is required for attachment creation.")
        return attrs
    
    def create(self, validated_data):
        """Create attachment and set metadata"""
        file_obj = validated_data.get('file')
        if file_obj:
            # Set metadata from file
            validated_data['original_filename'] = file_obj.name
            validated_data['file_size'] = file_obj.size
            validated_data['content_type'] = file_obj.content_type or mimetypes.guess_type(file_obj.name)[0] or 'application/octet-stream'
        
        return super().create(validated_data)


class SubtaskAddSerializer(serializers.Serializer):
    """Serializer for adding a subtask to a parent task"""
    child_task_id = serializers.IntegerField(required=True)


class TaskRelationAddSerializer(serializers.Serializer):
    """Serializer for adding a task relation"""
    target_task_id = serializers.IntegerField(required=True)
    relationship_type = serializers.ChoiceField(
        choices=['causes', 'blocks', 'clones', 'relates_to'],
        required=True
    )
