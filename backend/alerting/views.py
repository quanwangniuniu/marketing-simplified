from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError

from alerting.models import AlertTask
from alerting.serializers import AlertTaskSerializer
from core.models import ProjectMember


class AlertTaskListCreateView(generics.ListCreateAPIView):
    """
    GET /alerting/alert-tasks/
    POST /alerting/alert-tasks/
    """

    permission_classes = [IsAuthenticated]
    serializer_class = AlertTaskSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return AlertTask.objects.none()

        accessible_project_ids = ProjectMember.objects.filter(
            user=user,
            is_active=True,
        ).values_list("project_id", flat=True)

        queryset = AlertTask.objects.select_related("task", "task__project").filter(
            task__project_id__in=accessible_project_ids
        )

        task_id = self.request.query_params.get("task_id")
        if task_id:
            queryset = queryset.filter(task_id=task_id)

        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)

        return queryset

    def perform_create(self, serializer):
        task = serializer.validated_data.get("task")
        if task is None:
            raise DRFValidationError({"task": "Task is required for alert details."})

        if task.type != "alert":
            raise DRFValidationError(
                {"task": 'Alert details can only be created for tasks of type "alert".'}
            )

        user = self.request.user
        has_membership = ProjectMember.objects.filter(
            user=user,
            project=task.project,
            is_active=True,
        ).exists()
        if not has_membership:
            raise PermissionDenied("You do not have access to this task.")

        if hasattr(task, "alert_task"):
            raise DRFValidationError({"task": "Alert details already exist for this task."})

        alert_task = serializer.save()
        task.link_to_object(alert_task)
        task.save()


class AlertTaskRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    """
    GET /alerting/alert-tasks/{id}/
    PATCH /alerting/alert-tasks/{id}/
    """

    permission_classes = [IsAuthenticated]
    serializer_class = AlertTaskSerializer
    lookup_field = "id"

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return AlertTask.objects.none()

        accessible_project_ids = ProjectMember.objects.filter(
            user=user,
            is_active=True,
        ).values_list("project_id", flat=True)

        return AlertTask.objects.select_related("task", "task__project").filter(
            task__project_id__in=accessible_project_ids
        )
