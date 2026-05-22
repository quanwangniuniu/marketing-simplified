"""
Task Intelligence — query helpers for the intelligence dashboard.

All public functions accept a collection of project_ids and return
QuerySets or plain dicts. Keep this module free of HTTP/request logic
so it can be called from tests or management commands as well.
"""

from datetime import date, timedelta

from django.db.models import Count, Exists, Q, Subquery
from django.db.models.functions import TruncWeek

from .models import Task, TaskComment, TaskFieldHistory, TaskRelation

# ── Status groupings ─────────────────────────────────────────────────────────

ACTIVE_STATUSES = {'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'}
DONE_STATUS = 'LOCKED'
TODO_STATUSES = {'DRAFT', 'SUBMITTED'}
IN_PROGRESS_STATUSES = {'UNDER_REVIEW', 'APPROVED'}

# ── Base queryset ────────────────────────────────────────────────────────────

def _tasks(project_ids):
    return Task.objects.filter(project_id__in=project_ids).select_related(
        'owner', 'current_approver', 'project'
    )


# ── Individual signal queries ────────────────────────────────────────────────

def overdue_tasks(project_ids, today=None):
    today = today or date.today()
    return _tasks(project_ids).filter(
        due_date__lt=today,
        status__in=ACTIVE_STATUSES,
    )


def due_soon_tasks(project_ids, days=7, today=None):
    today = today or date.today()
    return _tasks(project_ids).filter(
        due_date__range=[today, today + timedelta(days=days)],
        status__in=ACTIVE_STATUSES,
    )


def blocked_tasks(project_ids):
    """Tasks that have at least one 'is_blocked_by' (incoming BLOCKS) relation."""
    blocked_ids = TaskRelation.objects.filter(
        relationship_type=TaskRelation.BLOCKS,
        target_task__project_id__in=project_ids,
        target_task__status__in=ACTIVE_STATUSES,
    ).values_list('target_task_id', flat=True)
    return _tasks(project_ids).filter(id__in=blocked_ids)


def high_priority_incomplete_tasks(project_ids):
    return _tasks(project_ids).filter(
        priority__in=['HIGHEST', 'HIGH'],
        status__in=ACTIVE_STATUSES,
    )


def awaiting_approval_tasks(project_ids):
    return _tasks(project_ids).filter(status__in=['SUBMITTED', 'UNDER_REVIEW'])


def stalled_tasks(project_ids, days=7, today=None):
    """
    Active tasks with no field-history change in the last `days` days
    that are also older than `days` days (so brand-new tasks aren't flagged).
    """
    today = today or date.today()
    cutoff = today - timedelta(days=days)

    recently_changed_ids = TaskFieldHistory.objects.filter(
        task__project_id__in=project_ids,
        changed_at__date__gte=cutoff,
    ).values_list('task_id', flat=True)

    return _tasks(project_ids).filter(
        status__in=ACTIVE_STATUSES,
        created_at__date__lt=cutoff,
    ).exclude(id__in=recently_changed_ids)


# ── Progress counts ──────────────────────────────────────────────────────────

def progress_counts(project_ids):
    rows = (
        Task.objects.filter(project_id__in=project_ids)
        .values('status')
        .annotate(count=Count('id'))
    )
    by_status = {row['status']: row['count'] for row in rows}
    total = sum(by_status.values())
    done = by_status.get(DONE_STATUS, 0)
    todo = sum(by_status.get(s, 0) for s in TODO_STATUSES)
    in_progress = sum(by_status.get(s, 0) for s in IN_PROGRESS_STATUSES)

    return {
        'total': total,
        'todo': todo,
        'in_progress': in_progress,
        'done': done,
        'by_status': by_status,
        'completion_pct': round(done / total * 100) if total else 0,
    }


# ── Recent activity feed ─────────────────────────────────────────────────────

def recent_activity(project_ids, limit=20):
    return (
        TaskFieldHistory.objects.filter(task__project_id__in=project_ids)
        .select_related('task', 'changed_by')
        .order_by('-changed_at')[:limit]
    )


# ── Velocity trend ───────────────────────────────────────────────────────────

def velocity_trend(project_ids, weeks=8, today=None):
    """
    Tasks completed (reached LOCKED) per week for the last `weeks` weeks.
    Returns a list of {week, count} dicts ordered oldest-first.
    """
    today = today or date.today()
    cutoff = today - timedelta(weeks=weeks)

    rows = (
        TaskFieldHistory.objects.filter(
            task__project_id__in=project_ids,
            field_name='status',
            new_value=DONE_STATUS,
            changed_at__date__gte=cutoff,
        )
        .annotate(week=TruncWeek('changed_at'))
        .values('week')
        .annotate(count=Count('id'))
        .order_by('week')
    )
    return [{'week': row['week'].date().isoformat(), 'count': row['count']} for row in rows]


# ── Work cycle history ───────────────────────────────────────────────────────

CYCLE_TRACKED_FIELDS = {'status', 'owner', 'priority', 'due_date'}


def work_cycle_history(project_ids, date_from, date_to):
    """
    Returns grouped changes within [date_from, date_to] for the given projects.

    Shape:
      {
        'date_from': str,
        'date_to': str,
        'added': [task stubs],
        'completed': [task stubs],
        'field_changes': {
          'status':   [history entries],
          'owner':    [history entries],
          'priority': [history entries],
          'due_date': [history entries],
        },
      }
    """
    from datetime import datetime, time, timezone as dt_tz

    start = datetime.combine(date_from, time.min).replace(tzinfo=dt_tz.utc)
    end = datetime.combine(date_to, time.max).replace(tzinfo=dt_tz.utc)

    # Tasks created in range
    added_qs = (
        Task.objects.filter(project_id__in=project_ids, created_at__range=[start, end])
        .select_related('owner', 'current_approver')
        .order_by('created_at')
    )

    # Field history in range for tracked fields
    history_qs = (
        TaskFieldHistory.objects.filter(
            task__project_id__in=project_ids,
            field_name__in=CYCLE_TRACKED_FIELDS,
            changed_at__range=[start, end],
        )
        .select_related('task', 'changed_by')
        .order_by('-changed_at')
    )

    def _stub(t):
        return {
            'id': t.id,
            'summary': t.summary,
            'status': t.status,
            'priority': getattr(t, 'priority', None),
            'type': t.type,
            'due_date': t.due_date.isoformat() if t.due_date else None,
            'project_id': t.project_id,
        }

    def _entry(h):
        return {
            'task_id': h.task_id,
            'task_summary': h.task.summary,
            'old_value': h.old_value,
            'new_value': h.new_value,
            'changed_by': h.changed_by.username if h.changed_by else None,
            'changed_at': h.changed_at.isoformat(),
        }

    # Completed = status changed TO DONE_STATUS in the range
    completed_ids = set()
    field_groups: dict = {f: [] for f in CYCLE_TRACKED_FIELDS}
    for h in history_qs:
        field_groups[h.field_name].append(_entry(h))
        if h.field_name == 'status' and h.new_value == DONE_STATUS:
            completed_ids.add(h.task_id)

    completed_qs = (
        Task.objects.filter(id__in=completed_ids)
        .select_related('owner', 'current_approver')
    ) if completed_ids else Task.objects.none()

    return {
        'date_from': date_from.isoformat(),
        'date_to': date_to.isoformat(),
        'added': [_stub(t) for t in added_qs],
        'completed': [_stub(t) for t in completed_qs],
        'field_changes': field_groups,
    }


# ── My actions ───────────────────────────────────────────────────────────────

def my_actions(user, project_ids, today=None, due_soon_days=7):
    today = today or date.today()

    def _stub(t):
        return {
            'id': t.id,
            'summary': t.summary,
            'status': t.status,
            'priority': getattr(t, 'priority', None),
            'type': t.type,
            'due_date': t.due_date.isoformat() if t.due_date else None,
            'project_id': t.project_id,
            'owner': {'id': t.owner_id, 'username': t.owner.username} if t.owner_id else None,
            'current_approver': {'id': t.current_approver_id, 'username': t.current_approver.username}
                if t.current_approver_id else None,
            'updated_at': t.updated_at.isoformat() if t.updated_at else None,
        }

    base = _tasks(project_ids)

    assigned_qs = base.filter(owner=user, status__in=ACTIVE_STATUSES)
    awaiting_qs = base.filter(current_approver=user, status__in=['SUBMITTED', 'UNDER_REVIEW'])
    approved_pending_lock_qs = base.filter(current_approver=user, status='APPROVED')

    overdue_qs = assigned_qs.filter(due_date__lt=today)
    due_soon_qs = assigned_qs.filter(
        due_date__range=[today, today + timedelta(days=due_soon_days)],
    )

    blocked_ids = TaskRelation.objects.filter(
        relationship_type=TaskRelation.BLOCKS,
        target_task__project_id__in=project_ids,
        target_task__owner=user,
        target_task__status__in=ACTIVE_STATUSES,
    ).values_list('target_task_id', flat=True)
    blocked_qs = base.filter(id__in=blocked_ids)

    high_priority_qs = assigned_qs.filter(priority__in=['HIGHEST', 'HIGH'])

    # comment_followups: tasks where the user has commented, are still active,
    # and have had activity (comment or field change) after the user's last comment.
    from django.db.models import OuterRef

    user_last_comment = (
        TaskComment.objects.filter(user=user, task=OuterRef('pk'))
        .order_by('-created_at')
        .values('created_at')[:1]
    )

    commented_task_ids = (
        TaskComment.objects.filter(user=user, task__project_id__in=project_ids)
        .values_list('task_id', flat=True)
        .distinct()
    )

    active_commented_qs = base.filter(
        id__in=commented_task_ids,
        status__in=ACTIVE_STATUSES,
    ).annotate(user_last_comment_at=Subquery(user_last_comment))

    newer_comment_sq = TaskComment.objects.filter(
        task_id=OuterRef('pk'),
        created_at__gt=OuterRef('user_last_comment_at'),
    ).exclude(user=user)

    newer_change_sq = TaskFieldHistory.objects.filter(
        task_id=OuterRef('pk'),
        changed_at__gt=OuterRef('user_last_comment_at'),
    ).exclude(changed_by=user)

    followup_qs = active_commented_qs.annotate(
        has_newer_comment=Exists(newer_comment_sq),
        has_newer_change=Exists(newer_change_sq),
    ).filter(
        user_last_comment_at__isnull=False,
    ).filter(
        Q(has_newer_comment=True) | Q(has_newer_change=True)
    )

    return {
        'assigned_to_me': [_stub(t) for t in assigned_qs],
        'awaiting_my_approval': [_stub(t) for t in awaiting_qs],
        'approved_pending_lock': [_stub(t) for t in approved_pending_lock_qs],
        'overdue_i_own': [_stub(t) for t in overdue_qs],
        'due_soon_i_own': [_stub(t) for t in due_soon_qs],
        'blocked_i_own': [_stub(t) for t in blocked_qs],
        'high_priority_i_own': [_stub(t) for t in high_priority_qs],
        'comment_followups': [_stub(t) for t in followup_qs],
    }


# ── Risk summary ─────────────────────────────────────────────────────────────

def risk_summary(project_ids, today=None, stall_days=7):
    """
    Combined risk signal from overdue + blocked + stalled tasks.
    Score = overdue×3 + blocked×2 + stalled×1.
    """
    today = today or date.today()
    overdue = overdue_tasks(project_ids, today).count()
    blocked = blocked_tasks(project_ids).count()
    stalled = stalled_tasks(project_ids, stall_days, today).count()

    signals = []
    if overdue:
        signals.append({'type': 'overdue', 'count': overdue})
    if blocked:
        signals.append({'type': 'blocked', 'count': blocked})
    if stalled:
        signals.append({'type': 'stalled', 'count': stalled})

    return {
        'score': overdue * 3 + blocked * 2 + stalled,
        'level': 'high' if overdue * 3 + blocked * 2 + stalled >= 10 else
                 'medium' if overdue * 3 + blocked * 2 + stalled >= 4 else 'low',
        'signals': signals,
    }
