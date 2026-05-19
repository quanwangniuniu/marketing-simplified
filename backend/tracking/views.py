from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Max, Min, Q, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tracking.models import TrackingEvent, TrackingSession


class ConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "idle_seconds": settings.TRACKING_IDLE_SECONDS,
            "heartbeat_seconds": settings.TRACKING_HEARTBEAT_SECONDS,
            "session_timeout_seconds": settings.TRACKING_SESSION_TIMEOUT_SECONDS,
            "event_flush_seconds": settings.TRACKING_EVENT_FLUSH_SECONDS,
        })


class TaskEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        ct = ContentType.objects.get(app_label='task', model='task')

        agg = TrackingEvent.objects.filter(
            user=request.user,
            content_type=ct,
            object_id=task_id,
        ).aggregate(
            open_count=Count('id', filter=Q(event_type='TASK_OPEN')),
            first_interaction_at=Min('occurred_at', filter=Q(event_type='FIRST_INTERACTION')),
            last_open_at=Max('occurred_at', filter=Q(event_type='TASK_OPEN')),
        )

        session_ids = TrackingEvent.objects.filter(
            user=request.user,
            content_type=ct,
            object_id=task_id,
        ).values_list('session_id', flat=True).distinct()

        total_active_seconds = (
            TrackingSession.objects.filter(id__in=session_ids)
            .aggregate(s=Sum('active_seconds'))['s'] or 0
        )

        return Response({
            'task_id': task_id,
            'open_count': agg['open_count'],
            'first_interaction_at': agg['first_interaction_at'],
            'last_open_at': agg['last_open_at'],
            'total_active_seconds': total_active_seconds,
        })
