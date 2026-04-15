import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from task.models import Task, ApprovalRecord, TaskComment
from decision.models import Decision
from spreadsheet.models import Spreadsheet
from .serializers import DashboardSummarySerializer, ProjectWorkspaceDashboardSerializer


logger = logging.getLogger(__name__)

try:
    from opentelemetry import trace
    from opentelemetry.trace import set_span_in_context, INVALID_SPAN
    from opentelemetry.context import attach, detach
    TRACING_AVAILABLE = True
except ImportError:
    TRACING_AVAILABLE = False


def disable_tracing(func):
    """
    SAFETY LOCK 2: Disable OpenTelemetry tracing for this view
    Reason: Dashboard has large response bodies that cause Jaeger UDP packet overflow
    Error prevented: "Data exceeds the max UDP packet size; size 87621, max 65000"
    """
    if not TRACING_AVAILABLE:
        return func

    def wrapper(*args, **kwargs):
        ctx = set_span_in_context(INVALID_SPAN)
        token = attach(ctx)
        try:
            return func(*args, **kwargs)
        finally:
            detach(token)
    return wrapper


class DashboardSummaryView(APIView):
    """
    Dashboard summary endpoint - Returns all dashboard statistics.
    Supports optional project_id filtering.

    PERFORMANCE NOTES:
    - SAFETY LOCK 2: Tracing disabled for this endpoint (high response body size)
    - SAFETY LOCK 3: Never use async/await or asyncio.gather - sequential queries only
    - Dashboard queries are intentionally synchronous to avoid event loop saturation
    """
    permission_classes = [IsAuthenticated]

    @disable_tracing
    def get(self, request):
        try:
            project_id_param = request.query_params.get('project_id')
            project_id = None
            if project_id_param is not None:
                try:
                    project_id = int(project_id_param)
                except (TypeError, ValueError):
                    return Response(
                        {"detail": "Invalid project_id. It must be a positive integer."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if project_id <= 0:
                    return Response(
                        {"detail": "Invalid project_id. It must be a positive integer."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            queryset = Task.objects.all()
            if project_id is not None:
                queryset = queryset.filter(project_id=project_id)

            now = timezone.now()
            seven_days_ago = now - timedelta(days=7)
            seven_days_ahead = now + timedelta(days=7)

            time_metrics = {
                'completed_last_7_days': queryset.filter(
                    status__in=[Task.Status.APPROVED, Task.Status.LOCKED],
                    updated_at__gte=seven_days_ago
                ).count(),
                'updated_last_7_days': queryset.filter(
                    updated_at__gte=seven_days_ago
                ).count(),
                'created_last_7_days': queryset.filter(
                    created_at__gte=seven_days_ago
                ).count(),
                'due_soon': queryset.filter(
                    due_date__gte=now.date(),
                    due_date__lte=seven_days_ahead.date()
                ).exclude(
                    status__in=[Task.Status.APPROVED, Task.Status.LOCKED, Task.Status.CANCELLED]
                ).count()
            }

            total_work_items = queryset.count()

            status_mapping = {
                Task.Status.DRAFT: ('TO_DO', 'To Do', '#94A3B8'),
                Task.Status.SUBMITTED: ('TO_DO', 'To Do', '#94A3B8'),
                Task.Status.UNDER_REVIEW: ('IN_PROGRESS', 'In Progress', '#3B82F6'),
                Task.Status.APPROVED: ('DONE', 'Done', '#10B981'),
                Task.Status.LOCKED: ('DONE', 'Done', '#10B981'),
                Task.Status.REJECTED: ('RESEARCH', 'Research', '#8B5CF6'),
                Task.Status.CANCELLED: ('CANCELLED', 'Cancelled', '#6B7280'),
            }

            status_counts = {}
            for task_status in queryset.values('status').annotate(count=Count('status')):
                db_status = task_status['status']
                count = task_status['count']
                display_status, display_name, color = status_mapping.get(db_status, (db_status, db_status, '#94A3B8'))

                if display_status not in status_counts:
                    status_counts[display_status] = {
                        'status': display_status,
                        'display_name': display_name,
                        'count': 0,
                        'color': color
                    }
                status_counts[display_status]['count'] += count

            status_breakdown = list(status_counts.values())
            status_overview = {
                'total_work_items': total_work_items,
                'breakdown': status_breakdown
            }

            priority_counts = queryset.values('priority').annotate(count=Count('priority')).order_by('priority')
            priority_order = [Task.Priority.HIGHEST, Task.Priority.HIGH, Task.Priority.MEDIUM, Task.Priority.LOW, Task.Priority.LOWEST]
            priority_count_dict = {item['priority']: item['count'] for item in priority_counts}
            priority_breakdown = []
            for priority in priority_order:
                priority_breakdown.append({
                    'priority': priority,
                    'count': priority_count_dict.get(priority, 0)
                })

            type_counts = queryset.values('type').annotate(count=Count('type')).order_by('-count')
            type_display_names = {
                'budget': 'Budget',
                'asset': 'Asset',
                'retrospective': 'Retrospective',
                'report': 'Report',
                'execution': 'Execution'
            }
            types_of_work = []
            for type_item in type_counts:
                type_code = type_item['type']
                count = type_item['count']
                percentage = (count / total_work_items * 100) if total_work_items > 0 else 0
                types_of_work.append({
                    'type': type_code,
                    'display_name': type_display_names.get(type_code, type_code.title()),
                    'count': count,
                    'percentage': round(percentage, 1)
                })

            recent_activity = self._get_recent_activity(project_id, limit=20)

            dashboard_data = {
                'time_metrics': time_metrics,
                'status_overview': status_overview,
                'priority_breakdown': priority_breakdown,
                'types_of_work': types_of_work,
                'recent_activity': recent_activity
            }

            serializer = DashboardSummarySerializer(dashboard_data)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception:
            logger.exception("Unexpected error in DashboardSummaryView")
            return Response(
                {'detail': 'Internal server error. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _get_recent_activity(self, project_id, limit=20):
        """
        Gather recent activity from multiple sources and unify them.

        CRITICAL OPTIMIZATION: Direct project_id filtering instead of subqueries.
        - Much faster than task__in=queryset which creates expensive subqueries
        - Uses indexed project_id field for fast lookups
        """
        activities = []
        limit = min(limit, 20)  # SAFETY LOCK 1: hard cap at 20

        task_filter = Q(project_id=project_id) if project_id else Q()

        recent_tasks = Task.objects.filter(task_filter).select_related('owner').order_by('-created_at')[:limit]
        for task in recent_tasks:
            if task.owner:
                activities.append({
                    'id': f'task_created_{task.id}',
                    'event_type': 'task_created',
                    'user': task.owner,
                    'task': task,
                    'timestamp': task.created_at,
                    'human_readable': self._get_human_readable_time(task.created_at)
                })

        approval_filter = Q(task__project_id=project_id) if project_id else Q()
        approval_records = ApprovalRecord.objects.filter(
            approval_filter
        ).select_related('approved_by', 'task').order_by('-decided_time')[:limit]

        for record in approval_records:
            event_type = 'approved' if record.is_approved else 'rejected'
            activities.append({
                'id': f'{event_type}_{record.id}',
                'event_type': event_type,
                'user': record.approved_by,
                'task': record.task,
                'timestamp': record.decided_time,
                'human_readable': self._get_human_readable_time(record.decided_time),
                'is_approved': record.is_approved
            })

        comment_filter = Q(task__project_id=project_id) if project_id else Q()
        comments = TaskComment.objects.filter(
            comment_filter
        ).select_related('user', 'task').order_by('-created_at')[:limit]

        for comment in comments:
            activities.append({
                'id': f'commented_{comment.id}',
                'event_type': 'commented',
                'user': comment.user,
                'task': comment.task,
                'timestamp': comment.created_at,
                'human_readable': self._get_human_readable_time(comment.created_at),
                'comment_body': comment.body[:100] if len(comment.body) > 100 else comment.body
            })

        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        return activities[:limit]

    def _get_human_readable_time(self, timestamp):
        """Convert timestamp to human-readable relative time string."""
        now = timezone.now()
        diff = now - timestamp
        seconds = diff.total_seconds()

        if seconds < 60:
            return 'less than a minute ago'
        elif seconds < 3600:
            minutes = int(seconds / 60)
            return f'{minutes} minute{"s" if minutes > 1 else ""} ago'
        elif seconds < 86400:
            hours = int(seconds / 3600)
            return f'{hours} hour{"s" if hours > 1 else ""} ago'
        elif seconds < 604800:
            days = int(seconds / 86400)
            return f'{days} day{"s" if days > 1 else ""} ago'
        elif seconds < 2592000:
            weeks = int(seconds / 604800)
            return f'{weeks} week{"s" if weeks > 1 else ""} ago'
        else:
            months = int(seconds / 2592000)
            return f'{months} month{"s" if months > 1 else ""} ago'


# ── SMP-472: Project Workspace Dashboard ──────────────────────────────────

class ProjectWorkspaceDashboardView(APIView):
    """
    Project Workspace Dashboard endpoint for SMP-472.

    Returns a lightweight summary of Decisions, Tasks, Spreadsheets, and
    WorkflowPatterns scoped strictly to the requested project.
    This is an orientation surface, not an analytics dashboard —
    no cross-project data is ever returned.

    Query params:
        project_id (int, required): The project to scope the dashboard to.

    Returns:
        200: { decisions: [...], tasks: [...], spreadsheets: [...], patterns: [...] }
        400: If project_id is missing or invalid.
        401: If the user is not authenticated.
    """
    permission_classes = [IsAuthenticated]

    # Maximum items returned per zone — keeps the dashboard lightweight
    ZONE_LIMIT = 5

    def get(self, request):
        # --- Validate project_id ---
        project_id_param = request.query_params.get('project_id')
        if project_id_param is None:
            return Response(
                {'detail': 'project_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            project_id = int(project_id_param)
            if project_id <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {'detail': 'project_id must be a positive integer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.db import models as django_models
        from django.db.models import Exists, OuterRef
        from django.contrib.contenttypes.models import ContentType
        from django.db.models.functions import Cast
        from task.models import TaskRelation
        from spreadsheet.models import PatternJob, WorkflowPattern

        # Get ContentType for Decision — used to identify decision-linked tasks
        decision_content_type = ContentType.objects.get_for_model(Decision)

        # Terminal task statuses — tasks in these states are considered resolved
        RESOLVED_TASK_STATUSES = [
            Task.Status.APPROVED,
            Task.Status.LOCKED,
            Task.Status.CANCELLED,
        ]

        # --- Decision Zone ---
        # Show active decisions: committed, awaiting approval, or reviewed
        # Annotate with has_unresolved_tasks_flag: True if any linked task is not yet resolved

        unresolved_tasks_subquery = Task.objects.filter(
            project_id=project_id,
            content_type=decision_content_type,
            object_id=Cast(OuterRef('pk'), django_models.CharField()),
        ).exclude(status__in=RESOLVED_TASK_STATUSES)

        decisions = Decision.objects.filter(
            project_id=project_id,
            is_deleted=False,
            status__in=[
                Decision.Status.COMMITTED,
                Decision.Status.AWAITING_APPROVAL,
                Decision.Status.REVIEWED,
            ]
        ).annotate(
            has_unresolved_tasks_flag=Exists(unresolved_tasks_subquery)
        ).order_by('-updated_at')[:self.ZONE_LIMIT]

        # --- Task Zone ---
        # Show tasks needing attention: submitted, under review, or rejected
        # Annotate with is_blocked_flag and is_decision_linked_flag
        # Priority order: decision-linked first, then blocked, then by updated_at

        # Subquery: is this task blocked by another task via TaskRelation.BLOCKS?
        blocked_subquery = TaskRelation.objects.filter(
            target_task=OuterRef('pk'),
            relationship_type=TaskRelation.BLOCKS,
        )

        # Subquery: is this task linked to a Decision via GenericForeignKey?
        decision_linked_subquery = Task.objects.filter(
            pk=OuterRef('pk'),
            content_type=decision_content_type,
        )

        tasks = Task.objects.filter(
            project_id=project_id,
            status__in=[
                Task.Status.SUBMITTED,
                Task.Status.UNDER_REVIEW,
                Task.Status.REJECTED,
            ]
        ).annotate(
            is_blocked_flag=Exists(blocked_subquery),
            is_decision_linked_flag=Exists(decision_linked_subquery),
        ).order_by(
            '-is_decision_linked_flag',  # Decision-linked tasks appear first
            '-is_blocked_flag',           # Blocked tasks appear second
            '-updated_at',
        )[:self.ZONE_LIMIT]

        # --- Spreadsheet Zone ---
        # Show recently active spreadsheets in this project
        # Annotate with has_running_job_flag: True if a PatternJob is queued or running

        running_job_subquery = PatternJob.objects.filter(
            spreadsheet=OuterRef('pk'),
            status__in=['queued', 'running'],
        )

        spreadsheets = Spreadsheet.objects.filter(
            project_id=project_id,
            is_deleted=False,
        ).annotate(
            has_running_job_flag=Exists(running_job_subquery)
        ).order_by('-updated_at')[:self.ZONE_LIMIT]

        # --- Pattern Zone ---
        # Show recently used WorkflowPatterns that originated from this project's spreadsheets
        # WorkflowPattern has no direct project_id, so we filter via origin_spreadsheet_id

        # Get all spreadsheet IDs belonging to this project
        project_spreadsheet_ids = Spreadsheet.objects.filter(
            project_id=project_id,
            is_deleted=False,
        ).values_list('id', flat=True)

        patterns = WorkflowPattern.objects.filter(
            origin_spreadsheet_id__in=project_spreadsheet_ids,
            is_archived=False,
            is_deleted=False,
        ).order_by('-updated_at')[:self.ZONE_LIMIT]

        # --- Serialize and respond ---
        data = {
            'decisions': list(decisions),
            'tasks': list(tasks),
            'spreadsheets': list(spreadsheets),
            'patterns': list(patterns),
        }
        serializer = ProjectWorkspaceDashboardSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)