"""Workflow automation engine.

``evaluate_rules(ticket, event)`` is the heart: for a ticket event, it finds the
active rules for that event on the ticket's project, checks each rule's
conditions, runs its actions, and writes an execution log. Actions reuse
existing CSM capabilities; a re-entrancy guard stops an action's own writes from
re-triggering the engine into a loop.
"""

import threading
from contextlib import contextmanager

from csm.services.rule_conditions import conditions_match


_ctx = threading.local()


class SkipAction(Exception):
    """Raised by an action for a benign no-op (e.g. no conversation to message),
    so it is logged as 'skipped' rather than an 'error'."""


def in_automation():
    """True while the engine is executing actions.

    Trigger hooks check this so an action that writes to the ticket (e.g. a
    status change) does not re-fire the engine into an infinite loop.
    """
    return getattr(_ctx, 'active', False)


@contextmanager
def _guard():
    _ctx.active = True
    try:
        yield
    finally:
        _ctx.active = False


# --- action dispatcher ------------------------------------------------------
# Each handler performs one action, reusing existing ticket capabilities. More
# actions (assign, status via state machine, notifications, notes) are added in
# the action-dispatcher step; these first two are the simplest, side-effect-free
# field writes used to prove the engine end to end.

def _act_set_priority(ticket, action):
    ticket.priority = action.get('value')
    ticket.save(update_fields=['priority'])


def _act_add_tag(ticket, action):
    tag = action.get('value')
    if tag and tag not in ticket.tags:
        ticket.tags = list(ticket.tags) + [tag]
        ticket.save(update_fields=['tags'])


def _act_set_status(ticket, action):
    # Respect the per-project transition graph so automation can't push a ticket
    # into a state agents could never reach; save() handles pending_since/SLA.
    from csm.services.status_machine import is_transition_allowed
    new_status = action.get('value')
    if not new_status or new_status == ticket.status:
        return
    project_id = ticket.queue.project_id if ticket.queue_id else None
    if not is_transition_allowed(project_id, ticket.status, new_status):
        raise ValueError(f'transition not allowed: {ticket.status} -> {new_status}')
    ticket.status = new_status
    ticket.save(update_fields=['status'])


def _act_assign_agent(ticket, action):
    ticket.assigned_to_id = action.get('value')
    ticket.save(update_fields=['assigned_to'])


def _act_assign_queue(ticket, action):
    ticket.queue_id = action.get('value')
    ticket.save(update_fields=['queue'])


def _template_text(action):
    """Text for a template-based action: the chosen template's content, or inline
    text. v1 uses the raw content — no variable interpolation yet."""
    template_id = action.get('template_id')
    if template_id:
        from csm.models import QuickReplyTemplate
        tpl = QuickReplyTemplate.objects.filter(id=template_id).first()
        if tpl:
            return tpl.content
    return action.get('text', '')


def _system_user():
    """A non-login user credited as the author of automation-created notes."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user, _ = User.objects.get_or_create(
        username='automation@system.local',
        defaults={'email': 'automation@system.local', 'is_active': False},
    )
    return user


def _notify_recipients(ticket, kind):
    from csm.models import CustomerUser
    users = {}
    if kind in (None, 'assigned_agent', 'both') and ticket.assigned_to_id:
        users[ticket.assigned_to_id] = ticket.assigned_to
    if kind in ('supervisor', 'both'):
        supervisors = CustomerUser.objects.filter(
            queue_id=ticket.queue_id, user_type='supervisor', is_active=True,
        ).select_related('user')
        for cu in supervisors:
            if cu.user_id:
                users[cu.user_id] = cu.user
    return list(users.values())


def _act_notify(ticket, action):
    from csm.models import CsmNotification
    recipients = _notify_recipients(ticket, action.get('recipient'))
    if not recipients:
        raise SkipAction('no recipients')
    text = action.get('text', '')
    CsmNotification.objects.bulk_create([
        CsmNotification(
            recipient=user, notification_type='automation',
            title=f'Automation: {ticket.title}', message=text,
        )
        for user in recipients
    ])


def _act_customer_notify(ticket, action):
    from csm.models import ConversationMessage
    if not ticket.conversation_id:
        raise SkipAction('no conversation')
    ConversationMessage.objects.create(
        conversation_id=ticket.conversation_id,
        sender_type='system',
        content=_template_text(action),
    )


def _act_add_note(ticket, action):
    customer = ticket.conversation.customer if ticket.conversation_id else None
    if customer is None:
        raise SkipAction('no customer')
    from customer.models import CustomerInternalNote
    content = _template_text(action)
    CustomerInternalNote.objects.create(
        customer=customer, author=_system_user(),
        body={'text': content}, body_text=content, body_format='rich_text_json',
    )


ACTIONS = {
    'set_priority': _act_set_priority,
    'set_status': _act_set_status,
    'add_tag': _act_add_tag,
    'assign_agent': _act_assign_agent,
    'assign_queue': _act_assign_queue,
    'notify': _act_notify,
    'customer_notify': _act_customer_notify,
    'add_note': _act_add_note,
}


def _execute_action(ticket, action):
    """Run one action and return its outcome for the log.

    A single failing action is recorded and skipped, not raised, so the rest of
    the rule still runs and the log tells the truth about what happened.
    """
    handler = ACTIONS.get(action.get('type'))
    if handler is None:
        return {'type': action.get('type'), 'status': 'skipped', 'detail': 'unknown action'}
    try:
        handler(ticket, action)
        return {'type': action.get('type'), 'status': 'ok'}
    except SkipAction as exc:
        return {'type': action.get('type'), 'status': 'skipped', 'detail': str(exc)}
    except Exception as exc:
        return {'type': action.get('type'), 'status': 'error', 'detail': str(exc)}


# --- engine -----------------------------------------------------------------

def evaluate_rules(ticket, event_type):
    """Run every active rule for this event on the ticket's project.

    Returns how many rules fired. No-ops while already inside an automation run
    (re-entrancy guard) or when the ticket has no resolvable project.
    """
    if in_automation():
        return 0

    from csm.models import AutomationRule, AutomationExecutionLog

    project_id = ticket.queue.project_id if ticket.queue_id else None
    if not project_id:
        return 0

    rules = AutomationRule.objects.filter(
        project_id=project_id, trigger_event=event_type, is_active=True,
    )
    fired = 0
    with _guard():
        for rule in rules:
            if not conditions_match(ticket, rule.conditions):
                continue
            performed = [_execute_action(ticket, a) for a in (rule.actions or [])]
            AutomationExecutionLog.objects.create(
                rule=rule,
                rule_name=rule.name,
                trigger_event=event_type,
                ticket=ticket,
                ticket_ref=ticket.id,
                actions_performed=performed,
            )
            fired += 1
    return fired


def fire_trigger(ticket, event_type):
    """Schedule rule evaluation for a ticket event once the current transaction
    commits.

    Running after commit means the engine reads committed state and an engine
    failure can't roll back the change that triggered it. No-op during an
    automation run so an action's own writes don't re-trigger the engine.
    """
    if in_automation():
        return

    from django.db import transaction

    ticket_id = ticket.id

    def _run():
        from csm.models import Ticket
        fresh = Ticket.objects.filter(id=ticket_id).select_related('queue').first()
        if fresh is not None:
            evaluate_rules(fresh, event_type)

    transaction.on_commit(_run)
