from rest_framework import viewsets, status, generics, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from django.core.cache import cache
from datetime import datetime
from django.core.exceptions import ValidationError
from django.db import DatabaseError
from django.db.models import Q, Case, When, Value, IntegerField, Avg, Max, Count
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from task.models import (
    Task,
    CollaborationEvent,
    ApprovalRecord,
    TaskComment,
    TaskAttachment,
    TaskHierarchy,
    TaskRelation,
    ApprovalChain,
)
from task.serializers import (
    CollaborationEventSerializer,
    TaskSerializer,
    TaskListSerializer,
    TaskLinkSerializer,
    ApprovalRecordSerializer,
    TaskApprovalSerializer,
    TaskForwardSerializer,
    TaskCommentSerializer,
    TaskAttachmentSerializer,
    SubtaskAddSerializer,
    TaskRelationAddSerializer,
    TaskBulkActionSerializer,
    MentionUserSerializer,
)
from task.services import bulk_update_tasks
from task.gantt_service import build_gantt_payload, resolve_sprint_label_from_tasks
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from core.models import ProjectMember, Project, TeamMember
from core.utils.project import get_user_active_project
import json
import traceback


# region agent log
def _debug_log(session_id, location, message, data=None, hypothesis_id=None):
    import os

    payload = {
        "sessionId": session_id,
        "location": location,
        "message": message,
        "timestamp": __import__("time").time() * 1000,
    }

    if data is not None:
        payload["data"] = data

    if hypothesis_id is not None:
        payload["hypothesisId"] = hypothesis_id

    line = json.dumps(payload) + "\n"

    for path in [
        "/Users/huangtaowen/Desktop/Proj/mediaJira/.cursor/debug-70a616.log",
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "debug-70a616.log",
        ),
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
        "project",
        "owner",
        "current_approver",
        "meeting_origin__meeting__type_definition",
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
                "TaskViewSet.create exception: %s\n%s",
                e,
                traceback.format_exc(),
            )
            raise

    def force_create(self, request):
        """
        Fallback task creation endpoint.

        - Require the frontend to pass a valid project_id
        - Ensure the current user is a member of this Project
        - Use the normal serializer to create Task
        - Don't automatically create Project
        """
        data = request.data.copy()
        project_id = data.get("project_id")

        if not project_id:
            return Response(
                {"error": "project_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = get_object_or_404(Project, id=project_id)

        ProjectMember.objects.get_or_create(
            user=request.user,
            project=project,
            defaults={"is_active": True},
        )

        serializer = self.get_serializer(
            data=data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        task = serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        """Filter queryset based on user permissions and query parameters"""
        _debug_log(
            "70a616",
            "task/views.py:get_queryset",
            "get_queryset_start",
            {"user_id": getattr(self.request.user, "id", None)},
            "H2",
        )

        user = self.request.user

        if not user.is_authenticated:
            return Task.objects.none()

        queryset = Task.objects.select_related(
            "project",
            "owner",
            "current_approver",
            "meeting_origin__meeting__type_definition",
        )

        accessible_project_ids = set(
            ProjectMember.objects.filter(
                user=user,
                is_active=True,
            ).values_list("project_id", flat=True)
        )

        active_project = user.active_project

        if active_project:
            if active_project.id not in accessible_project_ids:
                active_project = None
                user.active_project = None
                user.save(update_fields=["active_project"])

        all_projects_param = self.request.query_params.get("all_projects", "false")
        all_projects = all_projects_param.lower() == "true"

        requested_project_id_raw = self.request.query_params.get("project_id")

        if requested_project_id_raw is not None:
            requested_project_id_raw = str(requested_project_id_raw).strip()

            if requested_project_id_raw == "":
                requested_project_id_raw = None

        has_explicit_project_id = requested_project_id_raw is not None
        requested_project_id = None

        if has_explicit_project_id:
            try:
                requested_project_id = int(requested_project_id_raw)
            except (TypeError, ValueError):
                raise DRFValidationError(
                    {"project_id": "project_id must be an integer"}
                )

            if requested_project_id not in accessible_project_ids:
                raise PermissionDenied("You do not have access to this project.")

            project_filter = Q(project_id=requested_project_id)
        else:
            if all_projects and accessible_project_ids:
                project_filter = Q(project_id__in=accessible_project_ids)
            elif active_project:
                project_filter = Q(project_id=active_project.id)
            elif accessible_project_ids:
                project_filter = Q(project_id__in=accessible_project_ids)
            else:
                project_filter = Q(pk__in=[])

        include_cross_project_param = self.request.query_params.get(
            "include_cross_project_approvals",
            "false",
        )
        include_cross_project_approvals = (
            include_cross_project_param.lower() == "true"
        )

        if has_explicit_project_id:
            if include_cross_project_approvals:
                queryset = queryset.filter(project_filter | Q(current_approver=user))
            else:
                queryset = queryset.filter(project_filter)
        else:
            queryset = queryset.filter(project_filter | Q(current_approver=user))

        def _get_multi_values(param_name: str):
            values = list(self.request.query_params.getlist(param_name))
            values.extend(self.request.query_params.getlist(param_name + "[]"))

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
                    raise DRFValidationError(
                        {param_name: f"{param_name} must be an integer"}
                    )

                if iv < 1:
                    raise DRFValidationError(
                        {param_name: f"{param_name} must be a positive integer"}
                    )

                parsed.append(iv)

            return parsed

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

        priorities = _get_multi_values("priority")

        if priorities:
            valid_priorities = {c[0] for c in Task.Priority.choices}
            invalid = [p for p in priorities if p not in valid_priorities]

            if invalid:
                raise DRFValidationError({"priority": "Invalid priority value"})

            queryset = queryset.filter(priority__in=priorities)

        approver_ids = _parse_int_list("current_approver_id")

        if approver_ids:
            queryset = queryset.filter(current_approver_id__in=approver_ids)

        due_date_after = self.request.query_params.get("due_date_after")

        if due_date_after:
            try:
                d = datetime.strptime(due_date_after, "%Y-%m-%d").date()
                queryset = queryset.filter(due_date__gte=d)
            except (ValueError, TypeError):
                raise DRFValidationError(
                    {"due_date_after": "due_date_after must be YYYY-MM-DD"}
                )

        due_date_before = self.request.query_params.get("due_date_before")

        if due_date_before:
            try:
                d = datetime.strptime(due_date_before, "%Y-%m-%d").date()
                queryset = queryset.filter(due_date__lte=d)
            except (ValueError, TypeError):
                raise DRFValidationError(
                    {"due_date_before": "due_date_before must be YYYY-MM-DD"}
                )

        created_after = self.request.query_params.get("created_after")

        if created_after:
            try:
                if "T" in created_after or " " in created_after:
                    d = datetime.fromisoformat(
                        created_after.replace("Z", "+00:00")
                    ).date()
                else:
                    d = datetime.strptime(created_after, "%Y-%m-%d").date()

                queryset = queryset.filter(created_at__date__gte=d)
            except (ValueError, TypeError):
                raise DRFValidationError(
                    {
                        "created_after": (
                            "created_after must be YYYY-MM-DD or ISO datetime"
                        )
                    }
                )

        created_before = self.request.query_params.get("created_before")

        if created_before:
            try:
                if "T" in created_before or " " in created_before:
                    d = datetime.fromisoformat(
                        created_before.replace("Z", "+00:00")
                    ).date()
                else:
                    d = datetime.strptime(created_before, "%Y-%m-%d").date()

                queryset = queryset.filter(created_at__date__lte=d)
            except (ValueError, TypeError):
                raise DRFValidationError(
                    {
                        "created_before": (
                            "created_before must be YYYY-MM-DD or ISO datetime"
                        )
                    }
                )

        content_type = self.request.query_params.get("content_type")

        if content_type:
            try:
                ct = ContentType.objects.get(model=content_type)
                queryset = queryset.filter(content_type=ct)
            except ContentType.DoesNotExist:
                return Task.objects.none()

        object_id = self.request.query_params.get("object_id")

        if object_id:
            queryset = queryset.filter(object_id=object_id)

        include_subtasks_param = self.request.query_params.get(
            "include_subtasks",
            "false",
        )
        include_subtasks = include_subtasks_param.lower() == "true"

        if not include_subtasks:
            queryset = queryset.filter(is_subtask=False)

        has_parent_param = self.request.query_params.get("has_parent")

        if has_parent_param is not None:
            if has_parent_param.lower() == "true":
                queryset = queryset.filter(is_subtask=True)
            elif has_parent_param.lower() == "false":
                queryset = queryset.filter(is_subtask=False)
            else:
                raise DRFValidationError(
                    {"has_parent": "has_parent must be true or false"}
                )

        queryset = queryset.order_by("order_in_project", "-id")

        if getattr(self, "action", None) in ("list", "gantt"):
            queryset = queryset.defer("draft_payload")

        _debug_log(
            "70a616",
            "task/views.py:get_queryset",
            "get_queryset_end",
            None,
            "H2",
        )

        return queryset

    def list(self, request, *args, **kwargs):
        _debug_log(
            "70a616",
            "task/views.py:list",
            "list_start",
            {"query": dict(request.query_params)},
            "H5",
        )

        try:
            response = super().list(request, *args, **kwargs)

            _debug_log(
                "70a616",
                "task/views.py:list",
                "list_end",
                None,
                "H5",
            )

            return response
        except Exception as e:
            _debug_log(
                "70a616",
                "task/views.py:list",
                "list_failed",
                {
                    "exc_type": type(e).__name__,
                    "exc_message": str(e),
                    "traceback": traceback.format_exc(),
                },
                "H2_H3_H5",
            )
            raise

    def gantt(self, request, *args, **kwargs):
        """
        Return chart-ready task rows for the Gantt view.

        GET /api/tasks/gantt/?project_id=...
        """
        queryset = self.filter_queryset(self.get_queryset())
        tasks = list(queryset)
        today = timezone.now().date()
        label = resolve_sprint_label_from_tasks(tasks)
        data = build_gantt_payload(tasks, today=today, sprint_label=label)
        return Response(data)

    def get_object(self):
        """
        Retrieve a single task object.

        Unlike list(), this should not depend on the user's active_project.
        """
        base_qs = Task.objects.select_related(
            "project",
            "owner",
            "current_approver",
            "meeting_origin__meeting__type_definition",
        )
        task = get_object_or_404(base_qs, pk=self.kwargs.get("pk"))

        user = self.request.user

        if not user.is_authenticated:
            raise PermissionDenied("Authentication credentials were not provided.")

        has_membership = ProjectMember.objects.filter(
            user=user,
            project=task.project,
            is_active=True,
        ).exists()

        is_current_approver = (
            task.current_approver_id is not None
            and task.current_approver_id == user.id
        )

        if not has_membership and not is_current_approver:
            raise PermissionDenied("You do not have access to this task.")

        self.check_object_permissions(self.request, task)

        return task

    def retrieve(self, request, *args, **kwargs):
        """Retrieve a task and persist shared access history."""
        task = self.get_object()

        _create_shared_task_access_event(
            task=task,
            actor=request.user,
            source="task_retrieve",
        )

        serializer = self.get_serializer(task)
        return Response(serializer.data)

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
        if instance.type == "retrospective" and instance.content_type and instance.object_id:
            try:
                from retrospective.models import RetrospectiveTask

                retrospective_content_type = ContentType.objects.get_for_model(
                    RetrospectiveTask
                )

                if instance.content_type == retrospective_content_type:
                    try:
                        retrospective = RetrospectiveTask.objects.get(
                            id=instance.object_id
                        )
                        retrospective.delete()
                        print(
                            f"Deleted RetrospectiveTask {instance.object_id} "
                            f"linked to Task {instance.id}"
                        )
                    except RetrospectiveTask.DoesNotExist:
                        print(
                            f"RetrospectiveTask {instance.object_id} not found, "
                            "skipping deletion"
                        )
                    except Exception as e:
                        print(
                            f"Error deleting RetrospectiveTask "
                            f"{instance.object_id}: {e}"
                        )
            except Exception as e:
                print(f"Error checking RetrospectiveTask for deletion: {e}")

        try:
            from linear_integration.models import LinearTaskLink

            LinearTaskLink.objects.filter(task_id=instance.pk).delete()
        except (ImportError, DatabaseError):
            pass

        instance.delete()

    @action(detail=False, methods=["post"], url_path="bulk_action")
    def bulk_action(self, request):
        """Apply bulk task updates in one atomic operation."""
        serializer = TaskBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        task_ids = data.pop("task_ids")

        result = bulk_update_tasks(
            user=request.user,
            task_ids=task_ids,
            updates=data,
        )

        if result["failed"]:
            return Response(
                {
                    "detail": "Bulk action failed. No tasks were updated.",
                    "result": result,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "detail": (
                    f"Bulk action completed successfully. "
                    f"Updated {result['updated_count']} task(s)."
                ),
                "result": result,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def link(self, request, pk=None):
        """Link task to an existing object"""
        task = self.get_object()

        serializer = TaskLinkSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        linked_object = serializer.validated_data["linked_object"]

        if task.is_linked:
            ct = ContentType.objects.get_for_model(linked_object.__class__)

            if task.content_type_id == ct.id and task.object_id == str(linked_object.id):
                task_serializer = TaskSerializer(task, context={"request": request})
                return Response(task_serializer.data, status=status.HTTP_200_OK)

            return Response(
                {"error": "Task is already linked to a different object"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task.link_to_object(linked_object)
        task.save()

        task_serializer = TaskSerializer(task, context={"request": request})
        return Response(task_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def make_approval(self, request, pk=None):
        """Make approval decision for a task"""
        task = self.get_object()

        if task.status != Task.Status.UNDER_REVIEW:
            return Response(
                {"error": "Task must be in UNDER_REVIEW status to be approved or rejected"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if task.current_approver_id and request.user.id != task.current_approver_id:
            return Response(
                {"error": "Only the designated approver for this step can approve or reject."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TaskApprovalSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action_value = serializer.validated_data["action"]
        comment = serializer.validated_data.get("comment", "")

        try:
            if action_value == "approve":
                task.approve()
                is_approved = True
            else:
                task.reject()
                is_approved = False

            step_number = (
                task.current_approval_step
                if task.current_approval_step
                else task.approval_records.count() + 1
            )

            approval_record = ApprovalRecord.objects.create(
                task=task,
                approved_by=task.current_approver or request.user,
                is_approved=is_approved,
                comment=comment,
                step_number=step_number,
                revision_round=task.revision_round,
                resubmitted_after_reject=task.revision_round > 0,
                has_rejection_history=task.approval_records.filter(
                    is_approved=False
                ).exists(),
            )

            _create_approval_delay_event(
                task=task,
                actor=request.user,
                approval_record=approval_record,
                action_value=action_value,
            )

            started_next_review = False

            if is_approved and task.approval_chain and task.current_approval_step:
                next_step_num = task.current_approval_step + 1
                next_step = task.approval_chain.get_step(next_step_num)

                if next_step:
                    task.forward_to_next()
                    task.current_approver = next_step.approver
                    task.current_approval_step = next_step_num
                    started_next_review = True

            task.save()

            if started_next_review:
                _create_approval_review_started_event(
                    task=task,
                    actor=request.user,
                    source="forward_to_next_approver",
                )
                        
            approval_serializer = ApprovalRecordSerializer(
                task.approval_records.latest("step_number")
            )
            task_serializer = TaskSerializer(task, context={"request": request})

            return Response(
                {
                    "approval_record": approval_serializer.data,
                    "task": task_serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a task"""
        task = self.get_object()

        cancellable_statuses = [
            Task.Status.SUBMITTED,
            Task.Status.UNDER_REVIEW,
            Task.Status.APPROVED,
            Task.Status.REJECTED,
        ]

        if task.status not in cancellable_statuses:
            return Response(
                {"error": "Task cannot be cancelled in current status"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            task.cancel()
            task.save()
            task.approval_records.all().delete()

            task_serializer = TaskSerializer(task, context={"request": request})

            return Response(
                {
                    "task": task_serializer.data,
                    "approval_record": None,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["get"])
    def approval_history(self, request, pk=None):
        """Get approval history for a task"""
        task = self.get_object()

        approval_records = task.approval_records.all().order_by("step_number")

        role_labels = {}

        if task.approval_chain:
            parts = [p.strip() for p in task.approval_chain.name.split("→")]
            role_labels = {i + 1: label for i, label in enumerate(parts)}

        approval_serializer = ApprovalRecordSerializer(approval_records, many=True)
        history = []

        for record_data in approval_serializer.data:
            step_num = record_data.get("step_number")
            entry = dict(record_data)
            entry["role_name"] = role_labels.get(step_num)
            history.append(entry)

        return Response(
            {
                "history": history,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="mention-users")
    def mention_users(self, request, pk=None):
        """
        Return users that can be mentioned from a task comment/reply.

        GET /api/tasks/<task_id>/mention-users/?q=cel
        """
        task = self.get_object()
        query = request.query_params.get("q", "").strip()

        if len(query) < 1:
            return Response([], status=status.HTTP_200_OK)

        User = get_user_model()

        project_user_ids = ProjectMember.objects.filter(
            project=task.project,
            is_active=True,
        ).values_list("user_id", flat=True)

        base_users = User.objects.filter(
            id__in=project_user_ids,
            is_active=True,
        )

        if len(query) == 1:
            users = base_users.filter(
                Q(username__istartswith=query)
                | Q(first_name__istartswith=query)
                | Q(last_name__istartswith=query)
            )
        else:
            users = base_users.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            )

        users = users.annotate(
            mention_rank=Case(
                When(username__iexact=query, then=Value(0)),
                When(email__iexact=query, then=Value(1)),
                When(username__istartswith=query, then=Value(2)),
                When(email__istartswith=query, then=Value(3)),
                When(first_name__istartswith=query, then=Value(4)),
                When(last_name__istartswith=query, then=Value(5)),
                When(username__icontains=query, then=Value(6)),
                When(email__icontains=query, then=Value(7)),
                When(first_name__icontains=query, then=Value(8)),
                When(last_name__icontains=query, then=Value(9)),
                default=Value(10),
                output_field=IntegerField(),
            )
        ).order_by("mention_rank", "username")[:20]

        serializer = MentionUserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
        

    @action(detail=True, methods=["get"], url_path="origins")
    def meeting_origins(self, request, pk=None):
        """Return immutable meeting/action-item lineage snapshots."""
        task = self.get_object()

        return Response(
            {
                "origin_meeting_id": task.origin_meeting_id,
                "origin_meeting_title": task.origin_meeting_title,
                "origin_action_item_id": task.origin_action_item_id,
                "origin_action_item_title": task.origin_action_item_title,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def revise(self, request, pk=None):
        """Revise a task"""
        task = self.get_object()

        revisable_statuses = [
            Task.Status.REJECTED,
            Task.Status.CANCELLED,
        ]

        if task.status not in revisable_statuses:
            return Response(
                {"error": "Task must be in REJECTED or CANCELLED status to be revised"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            task.revise()
            task.revision_round += 1
            task.save()

            task_serializer = TaskSerializer(task, context={"request": request})

            return Response(
                {
                    "task": task_serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    def forward(self, request, pk=None):
        """Forward a task to next approver"""
        task = self.get_object()

        forwardable_statuses = [Task.Status.APPROVED]

        if task.status not in forwardable_statuses:
            return Response(
                {"error": "Task must be in APPROVED status to be forwarded"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TaskForwardSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        next_approver_id = serializer.validated_data["next_approver_id"]

        try:
            User = get_user_model()
            new_approver = User.objects.get(id=next_approver_id)

            task.forward_to_next()
            task.current_approver = new_approver
            task.save()

            _create_approval_review_started_event(
                task=task,
                actor=request.user,
                source="manual_forward",
            )

            task_serializer = TaskSerializer(task, context={"request": request})

            return Response(
                {
                    "task": task_serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        except User.DoesNotExist:
            return Response(
                {"error": "User with this ID does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    def submit_task(self, request, pk=None):
        """Submit a task"""
        task = self.get_object()

        if task.status != Task.Status.DRAFT:
            return Response(
                {"error": "Task must be in DRAFT status to submit"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            task.submit()
            task.save()

            task_serializer = TaskSerializer(task, context={"request": request})

            return Response(
                {
                    "task": task_serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    def start_review(self, request, pk=None):
        """Start review for a task"""
        task = self.get_object()

        if task.status != Task.Status.SUBMITTED:
            return Response(
                {"error": "Task must be in SUBMITTED status to start review"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            task.start_review()

            if not task.approval_chain:
                chain = Task.find_approval_chain(task.project, task.type)

                if chain and chain.total_steps > 0:
                    first_step = chain.get_step(1)

                    if first_step:
                        task.approval_chain = chain
                        task.current_approval_step = 1
                        task.current_approver = first_step.approver

            task.save()
            
            _create_approval_review_started_event(
                task=task,
                actor=request.user,
                source="start_review",
            )

            task_serializer = TaskSerializer(task, context={"request": request})

            return Response(
                {
                    "task": task_serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        """Lock a task"""
        task = self.get_object()

        lockable_statuses = [Task.Status.APPROVED]

        if task.status not in lockable_statuses:
            return Response(
                {"error": "Task must be in APPROVED status to be locked"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if task.approval_chain:
            approved_count = task.approval_records.filter(is_approved=True).count()
            required = task.approval_chain.effective_required_approvals

            if approved_count < required:
                return Response(
                    {
                        "error": (
                            f"Task requires {required} approval(s) before it can be locked. "
                            f"{approved_count} of {required} approvals completed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            task.lock()
            task.save()

            task_serializer = TaskSerializer(task, context={"request": request})

            return Response(
                {
                    "task": task_serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock(self, request, pk=None):
        task = self.get_object()

        try:
            task.unlock()
            task.save()

            return Response(
                {
                    "task": TaskSerializer(task).data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["get", "post"])
    def subtasks(self, request, pk=None):
        """List subtasks or add a subtask to a parent task"""
        parent_task = self.get_object()

        if request.method == "GET":
            subtasks = parent_task.get_subtasks()
            serializer = TaskSerializer(
                subtasks,
                many=True,
                context={"request": request},
            )

            return Response(serializer.data, status=status.HTTP_200_OK)

        if request.method == "POST":
            if parent_task.is_subtask:
                return Response(
                    {
                        "error": (
                            "A subtask cannot have subtasks. "
                            "Only 1 level of nesting is allowed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            serializer = SubtaskAddSerializer(data=request.data)

            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            child_task_id = serializer.validated_data["child_task_id"]
            child_task = get_object_or_404(Task, id=child_task_id)

            has_membership = ProjectMember.objects.filter(
                user=request.user,
                project=child_task.project,
                is_active=True,
            ).exists()

            if not has_membership:
                raise PermissionDenied("You do not have access to this task.")

            try:
                parent_task.add_subtask(child_task)
                child_serializer = TaskSerializer(
                    child_task,
                    context={"request": request},
                )

                return Response(child_serializer.data, status=status.HTTP_201_CREATED)
            except ValidationError as e:
                return Response(
                    {
                        "error": str(e),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=True, methods=["delete"], url_path="subtasks/(?P<subtask_id>[^/.]+)")
    def subtask_detail(self, request, pk=None, subtask_id=None):
        """Remove a subtask relationship - disabled"""
        return Response(
            {
                "error": (
                    "Subtask relationships cannot be removed. "
                    "Subtasks are automatically deleted when all parent tasks are deleted."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="subtasks/(?P<subtask_id>[^/.]+)/move",
    )
    def move_subtask(self, request, pk=None, subtask_id=None):
        """
        Move subtask from old parent to new parent.

        Payload: { "old_parent_id": <id> }
        """
        new_parent = self.get_object()
        old_parent_id = request.data.get("old_parent_id")

        if not old_parent_id:
            return Response(
                {
                    "error": "old_parent_id is required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_parent = get_object_or_404(Task, pk=old_parent_id)
        child_task = get_object_or_404(Task, pk=subtask_id)

        TaskHierarchy.objects.filter(
            parent_task=old_parent,
            child_task=child_task,
        ).delete()

        new_parent.add_subtask(child_task)

        return Response({"success": True}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "post"])
    def relations(self, request, pk=None):
        """List relations or add a relation to a task"""
        task = self.get_object()

        if request.method == "GET":

            def build_relation_data(relation, related_task):
                return {
                    "relation_id": relation.id,
                    "task": TaskSerializer(
                        related_task,
                        context={"request": request},
                    ).data,
                }

            causes_relations = task.outgoing_relationships.filter(
                relationship_type=TaskRelation.CAUSES
            )
            causes_data = [
                build_relation_data(rel, rel.target_task)
                for rel in causes_relations
            ]

            blocks_relations = task.outgoing_relationships.filter(
                relationship_type=TaskRelation.BLOCKS
            )
            blocks_data = [
                build_relation_data(rel, rel.target_task)
                for rel in blocks_relations
            ]

            clones_relations = task.outgoing_relationships.filter(
                relationship_type=TaskRelation.CLONES
            )
            clones_data = [
                build_relation_data(rel, rel.target_task)
                for rel in clones_relations
            ]

            is_caused_by_relations = task.incoming_relationships.filter(
                relationship_type=TaskRelation.CAUSES
            )
            is_caused_by_data = [
                build_relation_data(rel, rel.source_task)
                for rel in is_caused_by_relations
            ]

            is_blocked_by_relations = task.incoming_relationships.filter(
                relationship_type=TaskRelation.BLOCKS
            )
            is_blocked_by_data = [
                build_relation_data(rel, rel.source_task)
                for rel in is_blocked_by_relations
            ]

            is_cloned_by_relations = task.incoming_relationships.filter(
                relationship_type=TaskRelation.CLONES
            )
            is_cloned_by_data = [
                build_relation_data(rel, rel.source_task)
                for rel in is_cloned_by_relations
            ]

            relates_to_outgoing = task.outgoing_relationships.filter(
                relationship_type=TaskRelation.RELATES_TO
            )
            relates_to_incoming = task.incoming_relationships.filter(
                relationship_type=TaskRelation.RELATES_TO
            )

            relates_to_dict = {}

            for rel in relates_to_outgoing:
                relates_to_dict[rel.id] = build_relation_data(rel, rel.target_task)

            for rel in relates_to_incoming:
                relates_to_dict[rel.id] = build_relation_data(rel, rel.source_task)

            relates_to_data = list(relates_to_dict.values())

            relations_data = {
                "causes": causes_data,
                "is_caused_by": is_caused_by_data,
                "blocks": blocks_data,
                "is_blocked_by": is_blocked_by_data,
                "clones": clones_data,
                "is_cloned_by": is_cloned_by_data,
                "relates_to": relates_to_data,
            }

            return Response(relations_data, status=status.HTTP_200_OK)

        if request.method == "POST":
            serializer = TaskRelationAddSerializer(data=request.data)

            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            target_task_id = serializer.validated_data["target_task_id"]
            relationship_type = serializer.validated_data["relationship_type"]
            target_task = get_object_or_404(Task, id=target_task_id)

            has_membership = ProjectMember.objects.filter(
                user=request.user,
                project=target_task.project,
                is_active=True,
            ).exists()

            if not has_membership:
                raise PermissionDenied("You do not have access to this task.")

            try:
                task.add_relationship(target_task, relationship_type)

                return Response(
                    {
                        "message": f"Relation {relationship_type} added successfully",
                        "source_task_id": task.id,
                        "target_task_id": target_task_id,
                        "relationship_type": relationship_type,
                    },
                    status=status.HTTP_201_CREATED,
                )
            except ValidationError as e:
                return Response(
                    {
                        "error": str(e),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=True, methods=["delete"], url_path="relations/(?P<relation_id>[^/.]+)")
    def relation_detail(self, request, pk=None, relation_id=None):
        """Delete a specific relation"""
        task = self.get_object()

        relation = get_object_or_404(TaskRelation, id=relation_id)

        if relation.source_task_id != task.id and relation.target_task_id != task.id:
            return Response(
                {
                    "error": "This relation does not belong to this task",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        other_task_id = (
            relation.target_task_id
            if relation.source_task_id == task.id
            else relation.source_task_id
        )
        other_task = get_object_or_404(Task, id=other_task_id)

        has_membership = ProjectMember.objects.filter(
            user=request.user,
            project=other_task.project,
            is_active=True,
        ).exists()

        if not has_membership:
            raise PermissionDenied("You do not have access to this task.")

        relation.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
    

    @action(detail=True, methods=["post"], url_path="track-interaction")
    def track_interaction(self, request, pk=None):
        """Track task workflow interaction events."""
        task = self.get_object()

        event_type = request.data.get("event_type")
        source = str(request.data.get("source", "")).strip() or None

        allowed_event_types = {
            "internal_search",
            "ai_help_request",
            "snippet_interaction",
        }

        if event_type not in allowed_event_types:
            return Response(
                {"error": "Unsupported interaction event_type"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        meta = {
            "task_id": task.id,
            "source": source,
            "tracked_at": timezone.now().isoformat(),
        }

        if event_type == "internal_search":
            query = str(request.data.get("query", "")).strip()
            result_count = request.data.get("result_count")

            if len(query) < 2:
                return Response(
                    {"error": "Search query must be at least 2 characters"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            meta.update(
                {
                    "query": query,
                    "result_count": result_count,
                }
            )

        if event_type == "ai_help_request":
            trigger = str(request.data.get("trigger", "")).strip()
            context = str(request.data.get("context", "")).strip() or None

            if not trigger:
                return Response(
                    {"error": "AI help request trigger is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            meta.update(
                {
                    "trigger": trigger,
                    "context": context,
                }
            )

        if event_type == "snippet_interaction":
            snippet_id = str(request.data.get("snippet_id", "")).strip()
            snippet_label = str(request.data.get("snippet_label", "")).strip() or None
            interaction = str(request.data.get("interaction", "")).strip()
            context = str(request.data.get("context", "")).strip() or None

            if not snippet_id:
                return Response(
                    {"error": "snippet_id is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not interaction:
                return Response(
                    {"error": "snippet interaction is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            meta.update(
                {
                    "snippet_id": snippet_id,
                    "snippet_label": snippet_label,
                    "interaction": interaction,
                    "context": context,
                }
            )

        CollaborationEvent.objects.create(
            task=task,
            user=request.user,
            event_type=event_type,
            meta=meta,
        )

        return Response(
            {
                "status": "tracked",
                "event_type": event_type,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="collaboration-events")
    def collaboration_events(self, request, pk=None):
        """Get collaboration event history for a task."""
        task = self.get_object()
        events = task.collaboration_events.order_by("-created_at")

        event_type = request.query_params.get("event_type")

        if event_type:
            events = events.filter(event_type=event_type)

        return Response(
            {
                "count": events.count(),
                "results": CollaborationEventSerializer(events, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="collaboration-metrics")
    def collaboration_metrics(self, request, pk=None):
        """Get collaboration metrics for a task."""
        task = self.get_object()

        comments = TaskComment.objects.filter(task=task)

        total_comments = comments.count()
        root_comment_count = comments.filter(parent__isnull=True).count()
        reply_count = comments.filter(parent__isnull=False).count()

        root_reply_counts = list(
            comments.filter(parent__isnull=True)
            .annotate(reply_count_for_thread=Count("replies"))
            .values_list("reply_count_for_thread", flat=True)
        )

        thread_sizes = [1 + count for count in root_reply_counts]
        thread_depths = [2 if count > 0 else 1 for count in root_reply_counts]

        max_thread_size = max(thread_sizes) if thread_sizes else 0
        average_thread_size = (
            round(sum(thread_sizes) / len(thread_sizes), 2)
            if thread_sizes
            else 0
        )

        max_thread_depth = max(thread_depths) if thread_depths else 0
        average_thread_depth = (
            round(sum(thread_depths) / len(thread_depths), 2)
            if thread_depths
            else 0
        )

        threads_with_replies = sum(1 for count in root_reply_counts if count > 0)

        response_comments = comments.filter(
            parent__isnull=False,
            response_time_secs__isnull=False,
        )

        response_stats = response_comments.aggregate(
            average_response_time_secs=Avg("response_time_secs"),
            max_response_time_secs=Max("response_time_secs"),
        )

        average_response_time_secs = response_stats["average_response_time_secs"]

        if average_response_time_secs is not None:
            average_response_time_secs = int(round(average_response_time_secs))

        approval_delay_events = task.collaboration_events.filter(
            event_type="approval_delay",
        )

        approval_delay_secs = []

        for event in approval_delay_events:
            delay_secs = event.meta.get("delay_secs")

            if isinstance(delay_secs, int):
                approval_delay_secs.append(delay_secs)

        approval_delay_count = len(approval_delay_secs)
        average_approval_delay_secs = None
        max_approval_delay_secs = None

        if approval_delay_secs:
            average_approval_delay_secs = int(
                round(sum(approval_delay_secs) / len(approval_delay_secs))
            )
            max_approval_delay_secs = max(approval_delay_secs)

        shared_access_events = task.collaboration_events.filter(
            event_type="shared_task_access",
        )

        shared_access_count = shared_access_events.count()
        unique_shared_accessor_count = (
            shared_access_events.values("user_id").distinct().count()
        )

        documentation_revisit_events = task.collaboration_events.filter(
            event_type="documentation_revisit",
        )

        documentation_revisit_count = documentation_revisit_events.count()
        unique_revisited_document_count = (
            documentation_revisit_events
            .values("meta__attachment_id")
            .distinct()
            .count()
        )

        internal_search_events = task.collaboration_events.filter(
            event_type="internal_search",
        )

        internal_search_count = internal_search_events.count()
        unique_internal_search_query_count = (
            internal_search_events
            .values("meta__query")
            .distinct()
            .count()
        )

        ai_help_events = task.collaboration_events.filter(
            event_type="ai_help_request",
        )

        ai_help_request_count = ai_help_events.count()
        unique_ai_help_trigger_count = (
            ai_help_events
            .values("meta__trigger")
            .distinct()
            .count()
        )

        snippet_events = task.collaboration_events.filter(
            event_type="snippet_interaction",
        )

        snippet_interaction_count = snippet_events.count()
        unique_snippet_count = (
            snippet_events
            .values("meta__snippet_id")
            .distinct()
            .count()
        )

        return Response(
            {
                "comment_response": {
                    "reply_count": reply_count,
                    "responses_with_timing": response_comments.count(),
                    "average_response_time_secs": average_response_time_secs,
                    "max_response_time_secs": response_stats["max_response_time_secs"],
                },
                "discussion_threads": {
                    "total_comments": total_comments,
                    "root_comment_count": root_comment_count,
                    "reply_count": reply_count,
                    "threads_with_replies": threads_with_replies,
                    "max_thread_depth": max_thread_depth,
                    "average_thread_depth": average_thread_depth,
                    "max_thread_size": max_thread_size,
                    "average_thread_size": average_thread_size,
                },
                "approval_delays": {
                    "completed_approval_count": approval_delay_count,
                    "average_delay_secs": average_approval_delay_secs,
                    "max_delay_secs": max_approval_delay_secs,
                },
                "shared_access": {
                    "access_count": shared_access_count,
                    "unique_accessor_count": unique_shared_accessor_count,
                },
                "documentation_revisits": {
                    "revisit_count": documentation_revisit_count,
                    "unique_document_count": unique_revisited_document_count,
                },
                "internal_searches": {
                    "search_count": internal_search_count,
                    "unique_query_count": unique_internal_search_query_count,
                },
                "ai_help_requests": {
                    "request_count": ai_help_request_count,
                    "unique_trigger_count": unique_ai_help_trigger_count,
                },
                "snippet_interactions": {
                    "interaction_count": snippet_interaction_count,
                    "unique_snippet_count": unique_snippet_count,
                },
            },
            status=status.HTTP_200_OK,
        )


def _create_shared_task_access_event(task, actor, source):
    if not actor or not actor.is_authenticated:
        return

    if task.owner_id == actor.id:
        return

    cache_key = f"shared_task_access:{task.id}:{actor.id}:{source}"

    if not cache.add(cache_key, "1", timeout=300):
        return

    project_role = (
        ProjectMember.objects.filter(
            project=task.project,
            user=actor,
            is_active=True,
        )
        .values_list("role", flat=True)
        .first()
    )

    CollaborationEvent.objects.create(
        task=task,
        user=actor,
        event_type="shared_task_access",
        meta={
            "task_id": task.id,
            "owner_id": task.owner_id,
            "accessed_by_id": actor.id,
            "project_id": task.project_id,
            "project_role": project_role,
            "is_current_approver": task.current_approver_id == actor.id,
            "source": source,
            "accessed_at": timezone.now().isoformat(),
        },
    )

def _create_documentation_revisit_event(task, attachment, actor, source):
    if not actor or not actor.is_authenticated:
        return

    CollaborationEvent.objects.create(
        task=task,
        user=actor,
        event_type="documentation_revisit",
        meta={
            "task_id": task.id,
            "attachment_id": attachment.id,
            "file_name": attachment.original_filename,
            "content_type": attachment.content_type,
            "file_size": attachment.file_size,
            "uploaded_by_id": attachment.uploaded_by_id,
            "source": source,
            "revisited_at": timezone.now().isoformat(),
        },
    )

def _user_can_access_task(user, task):
    """
    Return True if user is an active project member or the current designated approver.
    Mirrors the same permission check used in TaskViewSet.get_object().
    """
    if ProjectMember.objects.filter(
        user=user,
        project=task.project,
        is_active=True,
    ).exists():
        return True

    return task.current_approver_id is not None and task.current_approver_id == user.id

def _extract_mention_ids_from_request(request):
    raw_mentions = request.data.get("mentions", [])

    if raw_mentions is None:
        return []

    if not isinstance(raw_mentions, list):
        return []

    mention_ids = []

    for value in raw_mentions:
        try:
            mention_ids.append(int(value))
        except (TypeError, ValueError):
            continue

    return list(set(mention_ids))

def _get_user_team_ids_for_project(project, user_id):
    team_memberships = TeamMember.objects.filter(user_id=user_id)

    if getattr(project, "organization_id", None):
        team_memberships = team_memberships.filter(
            team__organization_id=project.organization_id
        )

    return set(team_memberships.values_list("team_id", flat=True))


def _create_cross_team_mention_events(task, comment, actor, mention_ids):
    if not mention_ids:
        return

    actor_team_ids = _get_user_team_ids_for_project(task.project, actor.id)

    if not actor_team_ids:
        return

    mentioned_project_members = (
        ProjectMember.objects.filter(
            project=task.project,
            user_id__in=mention_ids,
            is_active=True,
        )
        .select_related("user")
    )

    for member in mentioned_project_members:
        if member.user_id == actor.id:
            continue

        mentioned_team_ids = _get_user_team_ids_for_project(
            task.project,
            member.user_id,
        )

        if not mentioned_team_ids:
            continue

        shared_team_ids = actor_team_ids.intersection(mentioned_team_ids)

        if shared_team_ids:
            continue

        CollaborationEvent.objects.create(
            task=task,
            user=actor,
            event_type="cross_team_mention",
            meta={
                "comment_id": comment.id,
                "parent_id": comment.parent_id,
                "mentioned_user_id": member.user_id,
                "mentioned_username": member.user.username,
                "actor_team_ids": sorted(actor_team_ids),
                "mentioned_team_ids": sorted(mentioned_team_ids),
                "source": "comment_mention",
            },
        )

def _create_approval_review_started_event(task, actor, source):
    if not task.current_approver_id:
        return

    CollaborationEvent.objects.create(
        task=task,
        user=actor,
        event_type="approval_review_started",
        meta={
            "approver_id": task.current_approver_id,
            "approval_step": task.current_approval_step,
            "revision_round": task.revision_round,
            "status": task.status,
            "source": source,
            "started_at": timezone.now().isoformat(),
        },
    )


def _get_latest_approval_review_started_event(task, approver_id, approval_step, revision_round):
    return (
        CollaborationEvent.objects.filter(
            task=task,
            event_type="approval_review_started",
            meta__approver_id=approver_id,
            meta__approval_step=approval_step,
            meta__revision_round=revision_round,
        )
        .order_by("-created_at")
        .first()
    )


def _create_approval_delay_event(task, actor, approval_record, action_value):
    started_event = _get_latest_approval_review_started_event(
        task=task,
        approver_id=approval_record.approved_by_id,
        approval_step=approval_record.step_number,
        revision_round=approval_record.revision_round,
    )

    if started_event is None:
        return

    completed_at = timezone.now()

    delay_secs = max(
        0,
        int((completed_at - started_event.created_at).total_seconds()),
    )

    CollaborationEvent.objects.create(
        task=task,
        user=actor,
        event_type="approval_delay",
        meta={
            "approval_record_id": approval_record.id,
            "approver_id": approval_record.approved_by_id,
            "approval_step": approval_record.step_number,
            "revision_round": approval_record.revision_round,
            "action": action_value,
            "is_approved": approval_record.is_approved,
            "started_at": started_event.created_at.isoformat(),
            "completed_at": completed_at.isoformat(),
            "delay_secs": delay_secs,
            "source": "approval_action",
        },
    )

class TaskCommentListView(generics.ListCreateAPIView):
    """
    List comments for a task or create a new task-level comment.
    Comments are attached directly to the Task.
    """

    serializer_class = TaskCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        task_id = self.kwargs.get("task_id")
        task = get_object_or_404(Task, pk=task_id)

        if not _user_can_access_task(self.request.user, task):
            raise PermissionDenied("You do not have access to this task.")

        return TaskComment.objects.filter(
            task_id=task_id,
            parent__isnull=True,
        ).order_by("created_at")

    def perform_create(self, serializer):
        task_id = self.kwargs.get("task_id")
        task = get_object_or_404(Task, pk=task_id)

        if not _user_can_access_task(self.request.user, task):
            raise PermissionDenied("You do not have access to comment on this task.")

        parent = serializer.validated_data.get("parent")

        if parent is not None and parent.task_id != task.id:
            raise DRFValidationError(
                {"parent": "Parent comment must belong to this task."}
            )

        comment = serializer.save(task=task, user=self.request.user)
        mention_ids = _extract_mention_ids_from_request(self.request)

        if task.current_approver_id and task.current_approver_id in mention_ids:
            CollaborationEvent.objects.create(
                task=task,
                user=self.request.user,
                event_type="reviewer_ping",
                meta={
                    "comment_id": comment.id,
                    "parent_id": comment.parent_id,
                    "reviewer_id": task.current_approver_id,
                    "source": "comment_mention",
                },
            )
        _create_cross_team_mention_events(
            task=task,
            comment=comment,
            actor=self.request.user,
            mention_ids=mention_ids,
)

        thread_depth = 2 if comment.parent_id else 1
        response_time_secs = None

        if comment.parent_id:
            response_time_secs = max(
                0,
                int((comment.created_at - comment.parent.created_at).total_seconds()),
            )
            comment.response_time_secs = response_time_secs
            comment.save(update_fields=["response_time_secs"])

        CollaborationEvent.objects.create(
            task=task,
            user=self.request.user,
            event_type="comment",
            meta={
                "comment_id": comment.id,
                "parent_id": comment.parent_id,
                "thread_depth": thread_depth,
                "comment_created_at": comment.created_at.isoformat(),
                "parent_created_at": (
                    comment.parent.created_at.isoformat()
                    if comment.parent_id
                    else None
                ),
                "response_time_secs": response_time_secs,
            },
        )

        if comment.is_clarification:
            CollaborationEvent.objects.create(
                task=task,
                user=self.request.user,
                event_type="clarification",
                meta={
                    "comment_id": comment.id,
                    "parent_id": comment.parent_id,
                    "body": comment.body,
                },
            )


class TaskAttachmentListView(generics.ListCreateAPIView):
    """
    List attachments for a task or create a new task attachment.
    """

    serializer_class = TaskAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        task_id = self.kwargs.get("task_id")
        task = get_object_or_404(Task, pk=task_id)

        if not _user_can_access_task(self.request.user, task):
            raise PermissionDenied("You do not have access to this task.")

        return TaskAttachment.objects.filter(task_id=task_id)

    def perform_create(self, serializer):
        task_id = self.kwargs.get("task_id")
        task = get_object_or_404(Task, pk=task_id)

        if not _user_can_access_task(self.request.user, task):
            raise PermissionDenied("You do not have access to upload attachments to this task.")

        serializer.save(task=task, uploaded_by=self.request.user)


class TaskAttachmentDetailView(generics.RetrieveDestroyAPIView):
    """
    Retrieve or delete a specific task attachment.
    """

    serializer_class = TaskAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        task_id = self.kwargs.get("task_id")
        task = get_object_or_404(Task, pk=task_id)

        if not _user_can_access_task(self.request.user, task):
            raise PermissionDenied("You do not have access to this task.")

        return TaskAttachment.objects.filter(task_id=task_id)

    def get_object(self):
        queryset = self.get_queryset()
        attachment_id = self.kwargs.get("pk")

        return get_object_or_404(queryset, pk=attachment_id)


class TaskAttachmentDownloadView(APIView):
    """Download a specific task attachment"""

    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get"]

    def get(self, request, *args, **kwargs):
        task_id = self.kwargs.get("task_id")
        attachment_id = self.kwargs.get("pk")

        attachment = get_object_or_404(
            TaskAttachment,
            pk=attachment_id,
            task_id=task_id,
        )

        if not _user_can_access_task(request.user, attachment.task):
            raise PermissionDenied("You do not have access to this task.")

        if not attachment.file:
            return Response(
                {
                    "detail": "No file available for download.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        _create_documentation_revisit_event(
            task=attachment.task,
            attachment=attachment,
            actor=request.user,
            source="attachment_download",
        )

        download_data = {
            "task_id": attachment.task.id,
            "task_summary": attachment.task.summary,
            "attachment_id": attachment.id,
            "file_name": attachment.original_filename,
            "file_size": attachment.file_size,
            "content_type": attachment.content_type,
            "checksum": attachment.checksum,
            "scan_status": attachment.scan_status,
            "uploaded_at": attachment.created_at,
            "uploaded_by": attachment.uploaded_by.username,
            "download_url": request.build_absolute_uri(attachment.file.url),
        }

        return Response(download_data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_task_types(request):
    """
    Get available task types with their labels.
    Returns all task types defined in the Task model.
    """
    task_type_choices = Task._meta.get_field("type").choices

    task_types = [
        {
            "value": choice[0],
            "label": choice[1],
        }
        for choice in task_type_choices
    ]

    return Response({"task_types": task_types}, status=status.HTTP_200_OK)


_AUTOSAVE_TTL = 604800
_AUTOSAVE_MAX_BYTES = 16 * 1024
_VALID_TASK_TYPES = frozenset(
    choice[0] for choice in Task._meta.get_field("type").choices
)


class TaskFormAutosaveView(APIView):
    """
    Cache-backed form autosave for the task creation form.

    All data is scoped to request.user.
    Cache key: task_form_autosave:{user_id}:{task_type}
    """

    permission_classes = [IsAuthenticated]

    def _cache_key(self, user_id: int, task_type: str) -> str:
        return f"task_form_autosave:{user_id}:{task_type}"

    def _validated_type(self, request) -> tuple[str | None, Response | None]:
        task_type = request.query_params.get("type", "").strip()

        if not task_type:
            return None, Response(
                {
                    "error": "`type` query parameter is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if task_type not in _VALID_TASK_TYPES:
            return None, Response(
                {
                    "error": (
                        f"Invalid task type: {task_type!r}. "
                        f"Must be one of: {sorted(_VALID_TASK_TYPES)}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return task_type, None

    def get(self, request):
        task_type, err = self._validated_type(request)

        if err:
            return err

        key = self._cache_key(request.user.id, task_type)
        payload = cache.get(key)

        if payload is None:
            return Response(status=status.HTTP_204_NO_CONTENT)

        return Response(payload, status=status.HTTP_200_OK)

    def put(self, request):
        task_type, err = self._validated_type(request)

        if err:
            return err

        raw = request.body

        if len(raw) > _AUTOSAVE_MAX_BYTES:
            return Response(
                {
                    "error": f"Payload too large. Maximum size is {_AUTOSAVE_MAX_BYTES} bytes.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(request.data, dict):
            return Response(
                {
                    "error": "Request body must be a JSON object.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        key = self._cache_key(request.user.id, task_type)
        cache.set(key, request.data, timeout=_AUTOSAVE_TTL)

        return Response(request.data, status=status.HTTP_200_OK)

    def delete(self, request):
        task_type, err = self._validated_type(request)

        if err:
            return err

        key = self._cache_key(request.user.id, task_type)
        cache.delete(key)

        return Response(status=status.HTTP_204_NO_CONTENT)