from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from task.lookups import resolve_task_lookup_kwargs
from task.models import Task

from .engagement_summary import TaskEngagementSummaryService
from .serializers import TaskEngagementSummarySerializer


class TaskEngagementSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        task = get_object_or_404(Task, **resolve_task_lookup_kwargs(task_id))
        result = TaskEngagementSummaryService.get_summary(
            user=request.user,
            task_id=task.pk,
        )
        payload = TaskEngagementSummarySerializer(
            {
                "visits": result.visits,
                "estimated_active_ms": result.estimated_active_ms,
                "last_operated_at": result.last_operated_at,
                "write_operations_count": result.write_operations_count,
            }
        )
        return Response(payload.data)
