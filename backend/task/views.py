from rest_framework import viewsets, status, generics, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from datetime import datetime
from django.core.exceptions import ValidationError
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from task.models import Task, ApprovalRecord, TaskComment, TaskAttachment, TaskHierarchy, TaskRelation, ApprovalChain
from task.serializers import TaskSerializer, TaskListSerializer, TaskLinkSerializer, ApprovalRecordSerializer, TaskApprovalSerializer, TaskForwardSerializer, TaskCommentSerializer, TaskAttachmentSerializer, SubtaskAddSerializer, TaskRelationAddSerializer
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from core.models import ProjectMember, Project
from core.utils.project import get_user_active_project
import json
import traceback

# region agent log
def _debug_log(session_id, location, message, data=None, hypothesis_id=None):
    import os
    payload = {"sessionId": session_id, "location": location, "message": message, "timestamp": __import__("time").time() * 1000}
    if data is not None:
        payload["data"] = data
    if hypothesis_id is not None:
        payload["hypothesisId"] = hypothesis_id
    line = json.dumps(payload) + "\n"
    for path in [
        "/Users/huangtaowen/Desktop/Proj/mediaJira/.cursor/debug-70a616.log",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "debug-70a616.log"),
    ]:
        try:
            with open(path, "a") as f:
                f.write(line)
            break
        except Exception:
            continue
# endregion


class TaskViewSet(viewsets.ModelViewSet):
    """ViewSet for Task model"""
    queryset = Task.objects.select_related(
        'project',
        'owner',
        'current_approver',
        'meeting_origin__meeting__type_definition',
    )
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if getattr(self, "action", None) == "list":
            return TaskListSerializer
        return TaskSerializer

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            import logging
            logging.getLogger("task.views").error(
                "TaskViewSet.create exception: %s\n%s", e, traceback.format_exc()
            )
            raise

    def force_create(self, request):
        """
        Fallback task creation endpoint.

        - Require the frontend to pass a valid project_id
        - Ensure the current user is a member of this Project (create ProjectMember if it doesn't exist)
        - Use the normal serializer to create Task
        - Don't automatically create Project (avoid too much magic)
        """
        data = request.data.copy()
        project_id = data.get('project_id')

        if not project_id:
            return Response(
                {'error': 'project_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the project (404 if it doesn't exist)
        project = get_object_or_404(Project, id=project_id)

        # Ensure the current user is a member of this project
        ProjectMember.objects.get_or_create(
            user=request.user,
            project=project,
            defaults={'is_active': True},
        )

        # Use the normal serializer to create the task
        serializer = self.get_serializer(
            data=data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        task = serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def get_queryset(self):
        """Filter queryset based on user permissions and query parameters"""
        # region agent log
        _debug_log("70a616", "task/views.py:get_queryset", "get_queryset_start", {"user_id": getattr(self.request.user, "id", None)}, "H2")
        # endregion
        user = self.request.user
        if not user.is_authenticated:
            return Task.objects.none()

        queryset = Task.objects.select_related(
            'project',
            'owner',
            'current_approver',
            'meeting_origin__meeting__type_definition',
        )
        accessible_project_ids = set(
            ProjectMember.objects.filter(
                user=user,
                is_active=True
            ).values_list('project_id', flat=True)
        )
        
        # Use user.active_project directly to avoid side effects from get_user_active_project
        # which automatically sets active_project if it's None
        active_project = user.active_project
        # Verify that active_project is still accessible (user still has membership)
        if active_project:
            if active_project.id not in accessible_project_ids:
                # Active project is no longer accessible, clear it
                active_project = None
                user.active_project = None
                user.save(update_fields=['active_project'])

        # Get all_projects parameter to allow fetching tasks from all accessible projects
        all_projects_param = self.request.query_params.get('all_projects', 'false')
        all_projects = all_projects_param.lower() == 'true'

        # Treat blank project_id as absent (?project_id= should not force strict empty scope)
        requested_project_id_raw = self.request.query_params.get('project_id')
        if requested_project_id_raw is not None:
            requested_project_id_raw = str(requested_project_id_raw).strip()
            if requested_project_id_raw == '':
                requested_project_id_raw = None

        has_explicit_project_id = requested_project_id_raw is not None
        requested_project_id = None
        if has_explicit_project_id:
            try:
                requested_project_id = int(requested_project_id_raw)
            except (TypeError, ValueError):
                raise DRFValidationError({'project_id': 'project_id must be an integer'})

            if requested_project_id not in accessible_project_ids:
                raise PermissionDenied('You do not have access to this project.')

            project_filter = Q(project_id=requested_project_id)
        else:
            # New logic: support all_projects parameter
            if all_projects and accessible_project_ids:
                project_filter = Q(project_id__in=accessible_project_ids)
            elif active_project:
                project_filter = Q(project_id=active_project.id)
            elif accessible_project_ids:
                project_filter = Q(project_id__in=accessible_project_ids)
            else:
                project_filter = Q(pk__in=[])

        include_cross_project_param = self.request.query_params.get(
            'include_cross_project_approvals', 'false'
        )
        include_cross_project_approvals = include_cross_project_param.lower() == 'true'

        # Explicit project_id => default strict scope (only that project). Optional
        # include_cross_project_approvals=true restores union with approver inbox tasks.
        if has_explicit_project_id:
            if include_cross_project_approvals:
                queryset = queryset.filter(project_filter | Q(current_approver=user))
            else:
                queryset = queryset.filter(project_filter)
        else:
            queryset = queryset.filter(project_filter | Q(current_approver=user))

        def _get_multi_values(param_name: str):
            """
            Accept multi-values in either:
            - repeated query params: ?status=A&status=B
            - comma-separated: ?status=A,B
            Returns list[str] (possibly empty).
            """
            values = list(self.request.query_params.getlist(param_name))
            values.extend(self.request.query_params.getlist(param_name + '[]'))
            if not values:
                raw = self.request.query_params.get(param_name)
                if raw:
                    values = [raw]
            expanded = []
            for v in values:
                if v is None:
                    continue
                parts = [p.strip() for p in str(v).split(",")]
                expanded.extend([p for p in parts if p])
            return expanded

        def _parse_int_list(param_name: str):
            raw_values = _get_multi_values(param_name)
            if not raw_values:
                return []
            parsed = []
            for v in raw_values:
                try:
                    iv = int(v)
                except (TypeError, ValueError):
                    raise DRFValidationError({param_name: f"{param_name} must be an integer"})
                if iv < 1:
                    raise DRFValidationError({param_name: f"{param_name} must be a positive integer"})
                parsed.append(iv)
            return parsed

        # Apply filters
        task_types = _get_multi_values("type")
        if task_types:
            valid_types = {c[0] for c in Task._meta.get_field("type").choices}
            invalid = [t for t in task_types if t not in valid_types]
            if invalid:
                raise DRFValidationError({"type": "Invalid type value"})
            queryset = queryset.filter(type__in=task_types)

        owner_ids = _parse_int_list("owner_id")
        if owner_ids:
            queryset = queryset.filter(owner_id__in=owner_ids)

        statuses = _get_multi_values("status")
        if statuses:
            valid_statuses = {c[0] for c in Task.Status.choices}
            invalid = [s for s in statuses if s not in valid_statuses]
            if invalid:
                raise DRFValidationError({"status": "Invalid status value"})
            queryset = queryset.filter(status__in=statuses)

        # Priority filter (multi-select)
        priorities = _get_multi_values("priority")
        if priorities:
            valid_priorities = {c[0] for c in Task.Priority.choices}
            invalid = [p for p in priorities if p not in valid_priorities]
            if invalid:
                raise DRFValidationError({"priority": "Invalid priority value"})
            queryset = queryset.filter(priority__in=priorities)

        # Current approver (assignee) filter (multi-select)
        approver_ids = _parse_int_list("current_approver_id")
        if approver_ids:
            queryset = queryset.filter(current_approver_id__in=approver_ids)

        # Due date range filters
        due_date_after = self.request.query_params.get('due_date_after')
        if due_date_after:
            try:
                d = datetime.strptime(due_date_after, '%Y-%m-%d').date()
                queryset = queryset.filter(due_date__gte=d)
            except (ValueError, TypeError):
                raise DRFValidationError({'due_date_after': 'due_date_after must be YYYY-MM-DD'})
        due_date_before = self.request.query_params.get('due_date_before')
        if due_date_before:
            try:
                d = datetime.strptime(due_date_before, '%Y-%m-%d').date()
                queryset = queryset.filter(due_date__lte=d)
            except (ValueError, TypeError):
                raise DRFValidationError({'due_date_before': 'due_date_before must be YYYY-MM-DD'})

        # Created date range filters (compare date part of created_at)
        created_after = self.request.query_params.get('created_after')
        if created_after:
            try:
                if 'T' in created_after or ' ' in created_after:
                    d = datetime.fromisoformat(created_after.replace('Z', '+00:00')).date()
                else:
                    d = datetime.strptime(created_after, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__date__gte=d)
            except (ValueError, TypeError):
                raise DRFValidationError({'created_after': 'created_after must be YYYY-MM-DD or ISO datetime'})
        created_before = self.request.query_params.get('created_before')
        if created_before:
            try:
                if 'T' in created_before or ' ' in created_before:
                    d = datetime.fromisoformat(created_before.replace('Z', '+00:00')).date()
                else:
                    d = datetime.strptime(created_before, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__date__lte=d)
            except (ValueError, TypeError):
                raise DRFValidationError({'created_before': 'created_before must be YYYY-MM-DD or ISO datetime'})

        # Filter by content_type
        content_type = self.request.query_params.get('content_type')
        if content_type:
            try:
                ct = ContentType.objects.get(model=content_type)
                queryset = queryset.filter(content_type=ct)
            except ContentType.DoesNotExist:
                # If content_type doesn't exist, return empty queryset
                return Task.objects.none()
        
        # Filter by object_id
        object_id = self.request.query_params.get('object_id')
        if object_id:
            queryset = queryset.filter(object_id=object_id)
        
        # Exclude subtasks - only show parent tasks in the listing
        # A task is a subtask if its is_subtask field is True (persistent even after parent deletion)
        # Allow including subtasks if explicitly requested (e.g., for subtask selection)
        include_subtasks_param = self.request.query_params.get('include_subtasks', 'false')
        include_subtasks = include_subtasks_param.lower() == 'true'

        if not include_subtasks:
            # Exclude all tasks that have is_subtask=True
            queryset = queryset.filter(is_subtask=False)

        # Parent filter: show only subtasks or only top-level tasks
        has_parent_param = self.request.query_params.get('has_parent')
        if has_parent_param is not None:
            if has_parent_param.lower() == 'true':
                queryset = queryset.filter(is_subtask=True)
            elif has_parent_param.lower() == 'false':
                queryset = queryset.filter(is_subtask=False)
            else:
                raise DRFValidationError({'has_parent': 'has_parent must be true or false'})

        # Order by order_in_project, then by creation date (newest first)
        queryset = queryset.order_by('order_in_project', '-id')
        # List response does not include draft_payload; defer it so list works if migration adding the column is not yet applied.
        if getattr(self, 'action', None) == 'list':
            queryset = queryset.defer('draft_payload')
        # region agent log
        _debug_log("70a616", "task/views.py:get_queryset", "get_queryset_end", None, "H2")
        # endregion
        return queryset

    def list(self, request, *args, **kwargs):
        # region agent log
        _debug_log("70a616", "task/views.py:list", "list_start", {"query": dict(request.query_params)}, "H5")
        # endregion
        try:
            response = super().list(request, *args, **kwargs)
            # region agent log
            _debug_log("70a616", "task/views.py:list", "list_end", None, "H5")
            # endregion
            return response
        except Exception as e:
            # region agent log
            _debug_log("70a616", "task/views.py:list", "list_failed", {
                "exc_type": type(e).__name__,
                "exc_message": str(e),
                "traceback": traceback.format_exc(),
            }, "H2_H3_H5")
            # endregion
            raise

    def get_object(self):
        """
        Retrieve a single task object.

        Unlike list(), this should not depend on the user's active_project.
        Instead, we:
        - fetch the task by primary key
        - verify the authenticated user has membership in the task's project
        """
        from rest_framework.exceptions import PermissionDenied  # local import to avoid circulars

        # Base queryset without project filtering so we can locate the task by ID
        base_qs = Task.objects.select_related(
            'project',
            'owner',
            'current_approver',
            'meeting_origin__meeting__type_definition',
        )
        task = get_object_or_404(base_qs, pk=self.kwargs.get('pk'))

        user = self.request.user
        if not user.is_authenticated:
            raise PermissionDenied('Authentication credentials were not provided.')

        # Ensure the user is an active member of the task's project,
        # OR is the current designated approver (cross-project approval chain).
        has_membership = ProjectMember.objects.filter(
            user=user,
            project=task.project,
            is_active=True,
        ).exists()
        is_current_approver = (
            task.current_approver_id is not None and
            task.current_approver_id == user.id
        )

        if not has_membership and not is_current_approver:
            raise PermissionDenied('You do not have access to this task.')

        self.check_object_permissions(self.request, task)
        return task
    
    def perform_create(self, serializer):
        """Create a new task"""
        return serializer.save()
    
    def perform_update(self, serializer):
        """Update a task"""
        serializer.save()
    
    def perform_destroy(self, instance):
        """
        Delete task and its linked retrospective object if it's a retrospective task
        """
        # If this is a retrospective task, delete the linked RetrospectiveTask first
        if instance.type == 'retrospective' and instance.content_type and instance.object_id:
            try:
                # Get the ContentType for RetrospectiveTask
                from retrospective.models import RetrospectiveTask
                retrospective_content_type = ContentType.objects.get_for_model(RetrospectiveTask)
                
                # Check if the task is linked to a RetrospectiveTask
                if instance.content_type == retrospective_content_type:
                    try:
                        # Get and delete the RetrospectiveTask
                        retrospective = RetrospectiveTask.objects.get(id=instance.object_id)
                        retrospective.delete()
                        print(f"Deleted RetrospectiveTask {instance.object_id} linked to Task {instance.id}")
                    except RetrospectiveTask.DoesNotExist:
                        print(f"RetrospectiveTask {instance.object_id} not found, skipping deletion")
                    except Exception as e:
                        print(f"Error deleting RetrospectiveTask {instance.object_id}: {e}")
            except Exception as e:
                print(f"Error checking RetrospectiveTask for deletion: {e}")
        
        # Delete the task itself
        instance.delete()
    
    @action(detail=True, methods=['post'])
    def link(self, request, pk=None):
        """Link task to an existing object"""
        task = self.get_object()
        
        # Validate link data
        serializer = TaskLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Get the linked object from validated data
        linked_object = serializer.validated_data['linked_object']

        # Check if task is already linked
        if task.is_linked:
            # Idempotent: if already linked to the same object, return success
            ct = ContentType.objects.get_for_model(linked_object.__class__)
            if task.content_type_id == ct.id and task.object_id == str(linked_object.id):
                task_serializer = TaskSerializer(task, context={'request': request})
                return Response(task_serializer.data, status=status.HTTP_200_OK)
            return Response(
                {'error': 'Task is already linked to a different object'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Link the task to the object
        task.link_to_object(linked_object)
        
        # Save the task to persist the link
        task.save()
        
        # Task is already in SUBMITTED status from creation
        # No need to call submit() again
        
        # Return the updated task
        task_serializer = TaskSerializer(task, context={'request': request})
        return Response(task_serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def make_approval(self, request, pk=None):
        """Make approval decision (approve or reject) for a task"""
        task = self.get_object()
        
        # Validate task can be approved/rejected
        if task.status != Task.Status.UNDER_REVIEW:
            return Response(
                {'error': 'Task must be in UNDER_REVIEW status to be approved or rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify the requesting user is the designated approver for this step
        if task.current_approver_id and request.user.id != task.current_approver_id:
            return Response(
                {'error': 'Only the designated approver for this step can approve or reject.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Validate request data
        serializer = TaskApprovalSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        action = serializer.validated_data['action']
        comment = serializer.validated_data.get('comment', '')
        
        try:
            # Execute the action
            if action == 'approve':
                task.approve()   # UNDER_REVIEW → APPROVED
                is_approved = True
            else:  # action == 'reject'
                task.reject()    # UNDER_REVIEW → REJECTED
                is_approved = False

            # Record the decision for the current step
            step_number = (
                task.current_approval_step
                if task.current_approval_step
                else task.approval_records.count() + 1
            )
            # Update revision round so next submission is tracked as a new round
            ApprovalRecord.objects.create(
                task=task,
                approved_by=task.current_approver or request.user,
                is_approved=is_approved,
                comment=comment,
                step_number=step_number,
                revision_round=task.revision_round,
                resubmitted_after_reject=task.revision_round > 0,
                has_rejection_history=task.approval_records.filter(is_approved=False).exists()
            )

            # If approved and a chain is active, auto-advance to the next step
            if is_approved and task.approval_chain and task.current_approval_step:
                next_step_num = task.current_approval_step + 1
                next_step = task.approval_chain.get_step(next_step_num)
                if next_step:
                    # More steps remain: APPROVED → UNDER_REVIEW with next approver
                    task.forward_to_next()
                    task.current_approver = next_step.approver
                    task.current_approval_step = next_step_num
                # else: chain is complete — task stays APPROVED, ready to be locked

            # Save all changes
            task.save()

            # Return both the approval record and updated task data
            approval_serializer = ApprovalRecordSerializer(
                task.approval_records.latest('step_number')
            )
            task_serializer = TaskSerializer(task, context={'request': request})

            return Response({
                'approval_record': approval_serializer.data,
                'task': task_serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a task"""
        task = self.get_object()
        
        # Validate task can be cancelled
        cancellable_statuses = [
            Task.Status.SUBMITTED,
            Task.Status.UNDER_REVIEW,
            Task.Status.APPROVED,
            Task.Status.REJECTED
        ]
        if task.status not in cancellable_statuses:
            return Response(
                {'error': 'Task cannot be cancelled in current status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Cancel the task
            task.cancel()
            task.save()

            # Delete all approval records
            task.approval_records.all().delete()
            
            # Return task
            task_serializer = TaskSerializer(task, context={'request': request})
            return Response({
                'task': task_serializer.data,
                'approval_record': None
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def approval_history(self, request, pk=None):
        """Get approval history for a task"""
        task = self.get_object()

        # Get approval records ordered by step_number
        approval_records = task.approval_records.all().order_by('step_number')

        # Build role_name lookup from chain name (e.g. "Buyer → Lead → Client")
        role_labels = {}
        if task.approval_chain:
            parts = [p.strip() for p in task.approval_chain.name.split('→')]
            role_labels = {i + 1: label for i, label in enumerate(parts)}

        # Serialize and annotate each record with its role_name
        approval_serializer = ApprovalRecordSerializer(approval_records, many=True)
        history = []
        for record_data in approval_serializer.data:
            step_num = record_data.get('step_number')
            entry = dict(record_data)
            entry['role_name'] = role_labels.get(step_num)
            history.append(entry)

        return Response({
            'history': history
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='origins')
    def meeting_origins(self, request, pk=None):
        """Return immutable meeting/action-item lineage snapshots (SMP-489)."""
        task = self.get_object()
        return Response(
            {
                'origin_meeting_id': task.origin_meeting_id,
                'origin_meeting_title': task.origin_meeting_title,
                'origin_action_item_id': task.origin_action_item_id,
                'origin_action_item_title': task.origin_action_item_title,
            },
            status=status.HTTP_200_OK,
        )
    
    @action(detail=True, methods=['post'])
    def revise(self, request, pk=None):
        """Revise a task (change status to DRAFT)"""
        task = self.get_object()
        
        # Validate task can be revised
        revisable_statuses = [Task.Status.REJECTED, Task.Status.CANCELLED]
        if task.status not in revisable_statuses:
            return Response(
                {'error': 'Task must be in REJECTED or CANCELLED status to be revised'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Revise the task (just change status to DRAFT)
            task.revise()

            # Increment revision round so next submission is tracked as a new round
            task.revision_round += 1

            # Save the task to persist the state change
            task.save()
            
            # Return updated task
            task_serializer = TaskSerializer(task, context={'request': request})
            return Response({
                'task': task_serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def forward(self, request, pk=None):
        """Forward a task to next approver (update current_approver)"""
        task = self.get_object()
        
        # Validate task can be forwarded
        forwardable_statuses = [Task.Status.APPROVED]
        if task.status not in forwardable_statuses:
            return Response(
                {'error': 'Task must be in APPROVED status to be forwarded'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate request data
        serializer = TaskForwardSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        next_approver_id = serializer.validated_data['next_approver_id']
        comment = serializer.validated_data.get('comment', '')
        
        try:
            # Get the new approver
            User = get_user_model()
            new_approver = User.objects.get(id=next_approver_id)
            
            # Forward the task
            task.forward_to_next()
            
            # Update current_approver
            task.current_approver = new_approver
            task.save()
            
            # Return updated task
            task_serializer = TaskSerializer(task, context={'request': request})
            return Response({
                'task': task_serializer.data
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response(
                {'error': 'User with this ID does not exist'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def submit_task(self, request, pk=None):
        """Submit a task (change status from DRAFT to SUBMITTED)"""
        task = self.get_object()
        if task.status != Task.Status.DRAFT:
            return Response(
                {'error': 'Task must be in DRAFT status to submit'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            task.submit()
            task.save()
            task_serializer = TaskSerializer(task, context={'request': request})
            return Response({'task': task_serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def start_review(self, request, pk=None):
        """Start review for a task (change status to UNDER_REVIEW).

        If a predefined ApprovalChain exists for this task's project + type,
        it is automatically assigned and the first step's approver becomes
        current_approver. Otherwise the task falls back to legacy single-approver mode.
        """
        task = self.get_object()

        # Validate task can start review
        if task.status != Task.Status.SUBMITTED:
            return Response(
                {'error': 'Task must be in SUBMITTED status to start review'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Transition status: SUBMITTED → UNDER_REVIEW
            task.start_review()

            # Auto-assign approval chain if one is configured and not already set
            if not task.approval_chain:
                chain = Task.find_approval_chain(task.project, task.type)
                if chain and chain.total_steps > 0:
                    first_step = chain.get_step(1)
                    if first_step:
                        task.approval_chain = chain
                        task.current_approval_step = 1
                        task.current_approver = first_step.approver

            task.save()

            # Return updated task
            task_serializer = TaskSerializer(task, context={'request': request})
            return Response({
                'task': task_serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        """Lock a task (change status to LOCKED)"""
        task = self.get_object()

        # Validate task can be locked
        lockable_statuses = [Task.Status.APPROVED]
        if task.status not in lockable_statuses:
            return Response(
                {'error': 'Task must be in APPROVED status to be locked'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce minimum approval count when an approval chain is assigned
        if task.approval_chain:
            approved_count = task.approval_records.filter(is_approved=True).count()
            required = task.approval_chain.effective_required_approvals
            if approved_count < required:
                return Response(
                    {
                        'error': (
                            f'Task requires {required} approval(s) before it can be locked. '
                            f'{approved_count} of {required} approvals completed.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            # Lock the task
            task.lock()
            task.save()  # Save the state change
            
            # Return updated task
            task_serializer = TaskSerializer(task, context={'request': request})
            return Response({
                'task': task_serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], url_path='unlock')
    def unlock(self, request, pk=None):
        task = self.get_object()
        try:
            task.unlock()
            task.save()
            return Response(
                {'task': TaskSerializer(task).data},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'post'])
    def subtasks(self, request, pk=None):
        """List subtasks or add a subtask to a parent task"""
        parent_task = self.get_object()
        
        if request.method == 'GET':
            # List all subtasks
            subtasks = parent_task.get_subtasks()
            serializer = TaskSerializer(subtasks, many=True, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Add a subtask
            # Check if parent task is itself a subtask - subtasks cannot have subtasks
            if parent_task.is_subtask:
                return Response(
                    {'error': 'A subtask cannot have subtasks. Only 1 level of nesting is allowed.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer = SubtaskAddSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            child_task_id = serializer.validated_data['child_task_id']
            child_task = get_object_or_404(Task, id=child_task_id)
            
            # Ensure user has access to child task's project
            has_membership = ProjectMember.objects.filter(
                user=request.user,
                project=child_task.project,
                is_active=True,
            ).exists()
            if not has_membership:
                raise PermissionDenied('You do not have access to this task.')
            
            try:
                parent_task.add_subtask(child_task)
                child_serializer = TaskSerializer(child_task, context={'request': request})
                return Response(child_serializer.data, status=status.HTTP_201_CREATED)
            except ValidationError as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
    
    @action(detail=True, methods=['delete'], url_path='subtasks/(?P<subtask_id>[^/.]+)')
    def subtask_detail(self, request, pk=None, subtask_id=None):
        """Remove a subtask relationship - DISABLED: Subtask relationships cannot be removed"""
        return Response(
            {'error': 'Subtask relationships cannot be removed. Subtasks are automatically deleted when all parent tasks are deleted.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    @action(detail=True, methods=['post'], url_path='subtasks/(?P<subtask_id>[^/.]+)/move')
    def move_subtask(self, request, pk=None, subtask_id=None):
        """
        Move subtask from old parent to new parent (pk).
        payload: { "old_parent_id": <id> }
        """
        new_parent = self.get_object()
        old_parent_id = request.data.get('old_parent_id')
        if not old_parent_id:
            return Response({'error': 'old_parent_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        old_parent = get_object_or_404(Task, pk=old_parent_id)
        child_task = get_object_or_404(Task, pk=subtask_id)

        # remove old relationship
        TaskHierarchy.objects.filter(parent_task=old_parent, child_task=child_task).delete()

        # add new relationship (uses model validation)
        new_parent.add_subtask(child_task)

        return Response({'success': True}, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get', 'post'])
    def relations(self, request, pk=None):
        """List relations or add a relation to a task"""
        task = self.get_object()
        
        if request.method == 'GET':
            # List all relations grouped by type, including relation_id
            
            # Helper function to build relation data
            def build_relation_data(relation, related_task):
                return {
                    'relation_id': relation.id,
                    'task': TaskSerializer(related_task, context={'request': request}).data
                }
            
            # Outgoing relations (causes, blocks, clones)
            causes_relations = task.outgoing_relationships.filter(relationship_type=TaskRelation.CAUSES)
            causes_data = [build_relation_data(rel, rel.target_task) for rel in causes_relations]
            
            blocks_relations = task.outgoing_relationships.filter(relationship_type=TaskRelation.BLOCKS)
            blocks_data = [build_relation_data(rel, rel.target_task) for rel in blocks_relations]
            
            clones_relations = task.outgoing_relationships.filter(relationship_type=TaskRelation.CLONES)
            clones_data = [build_relation_data(rel, rel.target_task) for rel in clones_relations]
            
            # Incoming relations (is_caused_by, is_blocked_by, is_cloned_by)
            is_caused_by_relations = task.incoming_relationships.filter(relationship_type=TaskRelation.CAUSES)
            is_caused_by_data = [build_relation_data(rel, rel.source_task) for rel in is_caused_by_relations]
            
            is_blocked_by_relations = task.incoming_relationships.filter(relationship_type=TaskRelation.BLOCKS)
            is_blocked_by_data = [build_relation_data(rel, rel.source_task) for rel in is_blocked_by_relations]
            
            is_cloned_by_relations = task.incoming_relationships.filter(relationship_type=TaskRelation.CLONES)
            is_cloned_by_data = [build_relation_data(rel, rel.source_task) for rel in is_cloned_by_relations]
            
            # Bidirectional relation (relates_to) - merge both directions and deduplicate
            relates_to_outgoing = task.outgoing_relationships.filter(relationship_type=TaskRelation.RELATES_TO)
            relates_to_incoming = task.incoming_relationships.filter(relationship_type=TaskRelation.RELATES_TO)
            
            # Combine and deduplicate by relation_id
            relates_to_dict = {}
            for rel in relates_to_outgoing:
                relates_to_dict[rel.id] = build_relation_data(rel, rel.target_task)
            for rel in relates_to_incoming:
                relates_to_dict[rel.id] = build_relation_data(rel, rel.source_task)
            relates_to_data = list(relates_to_dict.values())
            
            relations_data = {
                'causes': causes_data,
                'is_caused_by': is_caused_by_data,
                'blocks': blocks_data,
                'is_blocked_by': is_blocked_by_data,
                'clones': clones_data,
                'is_cloned_by': is_cloned_by_data,
                'relates_to': relates_to_data,
            }
            return Response(relations_data, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Add a relation
            serializer = TaskRelationAddSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            target_task_id = serializer.validated_data['target_task_id']
            relationship_type = serializer.validated_data['relationship_type']
            target_task = get_object_or_404(Task, id=target_task_id)
            
            # Ensure user has access to target task's project
            has_membership = ProjectMember.objects.filter(
                user=request.user,
                project=target_task.project,
                is_active=True,
            ).exists()
            if not has_membership:
                raise PermissionDenied('You do not have access to this task.')
            
            try:
                task.add_relationship(target_task, relationship_type)
                return Response({
                    'message': f'Relation {relationship_type} added successfully',
                    'source_task_id': task.id,
                    'target_task_id': target_task_id,
                    'relationship_type': relationship_type
                }, status=status.HTTP_201_CREATED)
            except ValidationError as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
    
    @action(detail=True, methods=['delete'], url_path='relations/(?P<relation_id>[^/.]+)')
    def relation_detail(self, request, pk=None, relation_id=None):
        """Delete a specific relation"""
        task = self.get_object()
        
        # Get the relation
        relation = get_object_or_404(TaskRelation, id=relation_id)
        
        # Ensure the relation involves the current task
        if relation.source_task_id != task.id and relation.target_task_id != task.id:
            return Response(
                {'error': 'This relation does not belong to this task'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Ensure user has access to the other task's project
        other_task_id = relation.target_task_id if relation.source_task_id == task.id else relation.source_task_id
        other_task = get_object_or_404(Task, id=other_task_id)
        has_membership = ProjectMember.objects.filter(
            user=request.user,
            project=other_task.project,
            is_active=True,
        ).exists()
        if not has_membership:
            raise PermissionDenied('You do not have access to this task.')
        
        # Delete the relation
        relation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _user_can_access_task(user, task):
    """Return True if user is an active project member or the current designated approver.

    Mirrors the same permission check used in TaskViewSet.get_object().
    """
    if ProjectMember.objects.filter(user=user, project=task.project, is_active=True).exists():
        return True
    return task.current_approver_id is not None and task.current_approver_id == user.id


class TaskCommentListView(generics.ListCreateAPIView):
    """
    List comments for a task or create a new task-level comment.
    Comments are attached directly to the Task, regardless of type.
    """
    serializer_class = TaskCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        task_id = self.kwargs.get('task_id')
        task = get_object_or_404(Task, pk=task_id)

        if not _user_can_access_task(self.request.user, task):
            raise PermissionDenied('You do not have access to this task.')

        return TaskComment.objects.filter(task_id=task_id)

    def perform_create(self, serializer):
        task_id = self.kwargs.get('task_id')
        task = get_object_or_404(Task, pk=task_id)

        if not _user_can_access_task(self.request.user, task):
            raise PermissionDenied('You do not have access to comment on this task.')

        serializer.save(task=task, user=self.request.user)


class TaskAttachmentListView(generics.ListCreateAPIView):
    """
    List attachments for a task or create a new task attachment.
    Attachments are attached directly to the Task, regardless of type.
    """
    serializer_class = TaskAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        task_id = self.kwargs.get('task_id')
        task = get_object_or_404(Task, pk=task_id)

        if not _user_can_access_task(self.request.user, task):
            raise PermissionDenied('You do not have access to this task.')

        return TaskAttachment.objects.filter(task_id=task_id)

    def perform_create(self, serializer):
        task_id = self.kwargs.get('task_id')
        task = get_object_or_404(Task, pk=task_id)

        if not _user_can_access_task(self.request.user, task):
            raise PermissionDenied('You do not have access to upload attachments to this task.')

        serializer.save(task=task, uploaded_by=self.request.user)


class TaskAttachmentDetailView(generics.RetrieveDestroyAPIView):
    """
    Retrieve or delete a specific task attachment.
    """
    serializer_class = TaskAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        task_id = self.kwargs.get('task_id')
        task = get_object_or_404(Task, pk=task_id)

        if not _user_can_access_task(self.request.user, task):
            raise PermissionDenied('You do not have access to this task.')

        return TaskAttachment.objects.filter(task_id=task_id)

    def get_object(self):
        # Use get_queryset() to ensure permission checks are applied
        queryset = self.get_queryset()
        attachment_id = self.kwargs.get('pk')
        return get_object_or_404(queryset, pk=attachment_id)


class TaskAttachmentDownloadView(APIView):
    """Download a specific task attachment"""
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get']
    
    def get(self, request, *args, **kwargs):
        task_id = self.kwargs.get('task_id')
        attachment_id = self.kwargs.get('pk')
        
        # Get the specific attachment
        attachment = get_object_or_404(TaskAttachment, pk=attachment_id, task_id=task_id)
        
        if not _user_can_access_task(request.user, attachment.task):
            raise PermissionDenied('You do not have access to this task.')
        
        # Check if the attachment has a file
        if not attachment.file:
            return Response(
                {'detail': 'No file available for download.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Return download URL
        download_data = {
            'task_id': attachment.task.id,
            'task_summary': attachment.task.summary,
            'attachment_id': attachment.id,
            'file_name': attachment.original_filename,
            'file_size': attachment.file_size,
            'content_type': attachment.content_type,
            'checksum': attachment.checksum,
            'scan_status': attachment.scan_status,
            'uploaded_at': attachment.created_at,
            'uploaded_by': attachment.uploaded_by.username,
            'download_url': request.build_absolute_uri(attachment.file.url)
        }
        
        return Response(download_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_task_types(request):
    """
    Get available task types with their labels.
    Returns all task types defined in the Task model.
    """
    # Get task type choices from the Task model
    task_type_choices = Task._meta.get_field('type').choices
    
    # Format as a list of objects with value and label
    # Include all model types so meeting → task conversion and task board stay in sync.
    task_types = [
        {'value': choice[0], 'label': choice[1]}
        for choice in task_type_choices
    ]
    
    return Response({'task_types': task_types}, status=status.HTTP_200_OK)
