from datetime import date, timedelta
from task.models import Task, TaskFieldHistory, TaskRelation
from task.intelligence import velocity_trend


def _task_stub(task):
    owner = task.owner
    return {
        'id': task.id,
        'summary': task.summary,
        'type': task.type,
        'status': task.status,
        'priority': task.priority,
        'due_date': task.due_date.isoformat() if task.due_date else None,
        'owner': {
            'id': owner.id,
            'name': owner.get_full_name().strip() or owner.username,
        } if owner else None,
    }


def _filled_velocity_trend(project_id, weeks, today):
    raw_weeks = velocity_trend([project_id], weeks=weeks, today=today)
    counts_by_week = {row['week']: row['count'] for row in raw_weeks}
    current_week_start = today - timedelta(days=today.weekday())
    first_week_start = current_week_start - timedelta(weeks=weeks - 1)

    filled = []
    for i in range(weeks):
        week = (first_week_start + timedelta(weeks=i)).isoformat()
        filled.append({'week': week, 'count': counts_by_week.get(week, 0)})
    return filled


def generate_status_report(project_id, date_from, date_to):
    today = date.today()
    base_qs = Task.objects.filter(project_id=project_id).select_related('owner')

    # 1. Completed work: tasks that moved to APPROVED or LOCKED during the period
    completed_ids = (
        TaskFieldHistory.objects
        .filter(
            task__project_id=project_id,
            field_name='status',
            new_value__in=['APPROVED', 'LOCKED'],
            changed_at__date__gte=date_from,
            changed_at__date__lte=date_to,
        )
        .values_list('task_id', flat=True)
        .distinct()
    )
    completed_work = [_task_stub(t) for t in base_qs.filter(id__in=completed_ids)]

    # 2. In progress
    in_progress = [_task_stub(t) for t in base_qs.filter(status__in=['SUBMITTED', 'UNDER_REVIEW'])]

    # 3. Blockers: tasks in this project blocked by an active task
    blocked_ids = (
        TaskRelation.objects
        .filter(
            target_task__project_id=project_id,
            relationship_type='blocks',
            source_task__status__in=['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'],
        )
        .values_list('target_task_id', flat=True)
        .distinct()
    )
    blockers = [_task_stub(t) for t in base_qs.filter(id__in=blocked_ids)]

    # 4. Risks: overdue or HIGH+ priority stalled tasks
    risks = []
    for t in base_qs.filter(status__in=['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REJECTED']):
        if t.due_date and t.due_date < today:
            stub = _task_stub(t)
            stub['risk_type'] = 'overdue'
            stub['days_overdue'] = (today - t.due_date).days
            risks.append(stub)
        elif t.priority in ('HIGHEST', 'HIGH'):
            stub = _task_stub(t)
            stub['risk_type'] = 'high_priority_stalled'
            risks.append(stub)

    # 5. Key decisions: APPROVED/REJECTED status changes during the period
    decisions_qs = (
        TaskFieldHistory.objects
        .filter(
            task__project_id=project_id,
            field_name='status',
            new_value__in=['APPROVED', 'REJECTED'],
            changed_at__date__gte=date_from,
            changed_at__date__lte=date_to,
        )
        .select_related('task', 'changed_by')
        .order_by('-changed_at')[:20]
    )
    key_decisions = [
        {
            'task_id': e.task_id,
            'task_summary': e.task.summary,
            'decision': e.new_value,
            'decided_at': e.changed_at.isoformat(),
            'decided_by': (
                e.changed_by.get_full_name().strip() or e.changed_by.username
                if e.changed_by else None
            ),
        }
        for e in decisions_qs
    ]

    # 6. Next steps: DRAFT/REJECTED with upcoming due dates
    next_steps = [
        _task_stub(t)
        for t in base_qs.filter(
            status__in=['DRAFT', 'REJECTED'],
            due_date__gte=today,
        ).order_by('due_date')[:10]
    ]

    # 7. Velocity + projection
    vel_data = _filled_velocity_trend(project_id, weeks=8, today=today)
    recent_4 = vel_data[-4:]
    avg_4wk = sum(w['count'] for w in recent_4) / len(recent_4)
    current_week_count = vel_data[-1]['count']

    if len(vel_data) >= 2:
        last, prev = vel_data[-1]['count'], vel_data[-2]['count']
        trend = 'up' if last > prev else ('down' if last < prev else 'stable')
    else:
        trend = 'stable'

    remaining_count = base_qs.filter(
        status__in=['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REJECTED']
    ).count()

    if avg_4wk > 0:
        projected_weeks = max(1, round(remaining_count / avg_4wk))
        projected_completion = (today + timedelta(weeks=projected_weeks)).isoformat()
    else:
        projected_weeks = None
        projected_completion = None

    return {
        'period': {'start': date_from.isoformat(), 'end': date_to.isoformat()},
        'completed_work': completed_work,
        'in_progress': in_progress,
        'blockers': blockers,
        'risks': risks,
        'key_decisions': key_decisions,
        'next_steps': next_steps,
        'velocity': {
            'current_week': current_week_count,
            'avg_4wk': round(avg_4wk, 1),
            'trend': trend,
            'remaining_count': remaining_count,
            'projected_weeks': projected_weeks,
            'projected_completion': projected_completion,
            'weekly_data': vel_data,
        },
    }
