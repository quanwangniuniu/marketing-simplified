"""Tests for the workflow automation rule engine."""

import pytest

from csm.models import AutomationRule, AutomationExecutionLog, Ticket
from csm.services.rule_conditions import conditions_match
from csm.services import automation
from csm.services.automation import evaluate_rules, fire_trigger


class _Ticket:
    """Minimal stand-in — conditions_match only reads attributes, no DB needed."""

    def __init__(self, **kw):
        self.status = kw.get('status', 'todo')
        self.priority = kw.get('priority', 'medium')
        self.queue_id = kw.get('queue_id', 1)
        self.assigned_to_id = kw.get('assigned_to_id')
        self.work_type_id = kw.get('work_type_id')
        self.support_project_id = kw.get('support_project_id')
        self.tags = kw.get('tags', [])
        self.customer_email = kw.get('customer_email', '')
        self.conversation_id = kw.get('conversation_id')
        self.conversation = kw.get('conversation')


class TestConditionsMatch:
    def test_empty_conditions_always_match(self):
        assert conditions_match(_Ticket(), []) is True

    def test_eq_match_and_mismatch(self):
        t = _Ticket(priority='high')
        assert conditions_match(t, [{'field': 'priority', 'operator': 'eq', 'value': 'high'}]) is True
        assert conditions_match(t, [{'field': 'priority', 'operator': 'eq', 'value': 'low'}]) is False

    def test_all_conditions_are_anded(self):
        t = _Ticket(priority='high', status='in_progress')
        ok = [
            {'field': 'priority', 'operator': 'eq', 'value': 'high'},
            {'field': 'status', 'operator': 'eq', 'value': 'in_progress'},
        ]
        assert conditions_match(t, ok) is True
        # One failing condition fails the whole rule.
        assert conditions_match(t, ok + [{'field': 'status', 'operator': 'eq', 'value': 'closed'}]) is False

    def test_tags_contains(self):
        t = _Ticket(tags=['urgent', 'vip'])
        assert conditions_match(t, [{'field': 'tags', 'operator': 'contains', 'value': 'vip'}]) is True
        assert conditions_match(t, [{'field': 'tags', 'operator': 'contains', 'value': 'refund'}]) is False

    def test_assignee_set_and_empty(self):
        unassigned = [{'field': 'assignee', 'operator': 'is_empty', 'value': None}]
        assigned = [{'field': 'assignee', 'operator': 'is_set', 'value': None}]
        assert conditions_match(_Ticket(assigned_to_id=None), unassigned) is True
        assert conditions_match(_Ticket(assigned_to_id=5), assigned) is True
        assert conditions_match(_Ticket(assigned_to_id=5), unassigned) is False

    def test_unknown_field_or_operator_fails_closed(self):
        assert conditions_match(_Ticket(), [{'field': 'nonsense', 'operator': 'eq', 'value': 'x'}]) is False
        assert conditions_match(_Ticket(), [{'field': 'status', 'operator': 'weird', 'value': 'x'}]) is False

    def test_channel_no_conversation_is_safe(self):
        # No conversation -> channel None -> shouldn't crash, just no match.
        assert conditions_match(_Ticket(conversation_id=None),
                                [{'field': 'channel', 'operator': 'eq', 'value': 'web'}]) is False


pytestmark = pytest.mark.django_db


class TestEvaluateRules:
    """End-to-end engine: matching rule runs its actions and logs; inactive skips."""

    @pytest.fixture
    def ticket(self, csm_queue):
        return Ticket.objects.create(
            queue=csm_queue, title='T', priority='medium', status='in_progress',
        )

    def _rule(self, project, **kw):
        defaults = dict(
            project=project, name='R', trigger_event='status_changed',
            conditions=[], actions=[{'type': 'set_priority', 'value': 'high'}],
            is_active=True,
        )
        defaults.update(kw)
        return AutomationRule.objects.create(**defaults)

    def test_matching_rule_runs_action_and_logs(self, project, ticket):
        self._rule(project)
        fired = evaluate_rules(ticket, 'status_changed')
        assert fired == 1
        ticket.refresh_from_db()
        assert ticket.priority == 'high'                       # action ran
        assert AutomationExecutionLog.objects.count() == 1     # logged
        log = AutomationExecutionLog.objects.first()
        assert log.rule_name == 'R'
        assert log.ticket_ref == ticket.id
        assert log.actions_performed == [{'type': 'set_priority', 'status': 'ok'}]

    def test_inactive_rule_does_not_run(self, project, ticket):
        self._rule(project, is_active=False)
        fired = evaluate_rules(ticket, 'status_changed')
        assert fired == 0
        ticket.refresh_from_db()
        assert ticket.priority == 'medium'                     # unchanged
        assert AutomationExecutionLog.objects.count() == 0

    def test_condition_not_met_skips(self, project, ticket):
        self._rule(project, conditions=[{'field': 'priority', 'operator': 'eq', 'value': 'low'}])
        fired = evaluate_rules(ticket, 'status_changed')       # ticket is medium, not low
        assert fired == 0
        ticket.refresh_from_db()
        assert ticket.priority == 'medium'

    def test_wrong_event_skips(self, project, ticket):
        self._rule(project, trigger_event='sla_breached')
        assert evaluate_rules(ticket, 'status_changed') == 0

    def test_add_tag_action(self, project, ticket):
        self._rule(project, actions=[{'type': 'add_tag', 'value': 'escalated'}])
        evaluate_rules(ticket, 'status_changed')
        ticket.refresh_from_db()
        assert 'escalated' in ticket.tags

    def test_unknown_action_logged_as_skipped(self, project, ticket):
        self._rule(project, actions=[{'type': 'no_such_action'}])
        evaluate_rules(ticket, 'status_changed')
        log = AutomationExecutionLog.objects.first()
        assert log.actions_performed[0]['status'] == 'skipped'


class TestFireTrigger:
    """fire_trigger runs the engine after commit, and no-ops during an automation run."""

    @pytest.fixture
    def ticket(self, csm_queue):
        return Ticket.objects.create(
            queue=csm_queue, title='T', priority='medium', status='in_progress',
        )

    def _rule(self, project, **kw):
        defaults = dict(
            project=project, name='R', trigger_event='status_changed',
            conditions=[], actions=[{'type': 'set_priority', 'value': 'high'}],
            is_active=True,
        )
        defaults.update(kw)
        return AutomationRule.objects.create(**defaults)

    def test_runs_after_commit(self, project, ticket, django_capture_on_commit_callbacks):
        self._rule(project)
        with django_capture_on_commit_callbacks(execute=True):
            fire_trigger(ticket, 'status_changed')
        ticket.refresh_from_db()
        assert ticket.priority == 'high'
        assert AutomationExecutionLog.objects.count() == 1

    def test_noop_during_automation_run(self, project, ticket, django_capture_on_commit_callbacks):
        self._rule(project)
        automation._ctx.active = True   # pretend we're mid-automation
        try:
            with django_capture_on_commit_callbacks(execute=True):
                fire_trigger(ticket, 'status_changed')
        finally:
            automation._ctx.active = False
        ticket.refresh_from_db()
        assert ticket.priority == 'medium'                 # guard blocked it
        assert AutomationExecutionLog.objects.count() == 0


class TestActions:
    """The field-based actions: set_status (via the transition graph), assign."""

    @pytest.fixture
    def ticket(self, csm_queue):
        return Ticket.objects.create(
            queue=csm_queue, title='T', priority='medium', status='todo',
        )

    def _run(self, project, ticket, actions):
        AutomationRule.objects.create(
            project=project, name='R', trigger_event='status_changed',
            conditions=[], actions=actions, is_active=True,
        )
        return evaluate_rules(ticket, 'status_changed')

    def test_set_status_allowed(self, project, ticket):
        from csm.services.status_machine import ensure_status_machine
        ensure_status_machine(project.id)
        self._run(project, ticket, [{'type': 'set_status', 'value': 'in_progress'}])
        ticket.refresh_from_db()
        assert ticket.status == 'in_progress'

    def test_set_status_not_allowed_is_logged(self, project, ticket):
        from csm.services.status_machine import ensure_status_machine
        ensure_status_machine(project.id)
        self._run(project, ticket, [{'type': 'set_status', 'value': 'closed'}])  # todo->closed not allowed
        ticket.refresh_from_db()
        assert ticket.status == 'todo'                 # unchanged
        detail = AutomationExecutionLog.objects.first().actions_performed[0]
        assert detail['status'] == 'error'
        assert 'transition not allowed' in detail['detail']

    def test_assign_agent(self, project, ticket, user2):
        self._run(project, ticket, [{'type': 'assign_agent', 'value': user2.id}])
        ticket.refresh_from_db()
        assert ticket.assigned_to_id == user2.id

    def test_assign_queue(self, project, ticket, customer_organisation):
        from csm.models import Queue
        q2 = Queue.objects.create(project=project, organisation=customer_organisation, name='Q2', tier='T2')
        self._run(project, ticket, [{'type': 'assign_queue', 'value': q2.id}])
        ticket.refresh_from_db()
        assert ticket.queue_id == q2.id


class TestCommunicationActions:
    """notify (internal), customer_notify (template message), add_note (internal note)."""

    @pytest.fixture
    def ticket(self, csm_queue):
        return Ticket.objects.create(
            queue=csm_queue, title='T', priority='medium', status='in_progress',
        )

    def _run(self, project, ticket, actions):
        AutomationRule.objects.create(
            project=project, name='R', trigger_event='status_changed',
            conditions=[], actions=actions, is_active=True,
        )
        return evaluate_rules(ticket, 'status_changed')

    def test_notify_assigned_agent(self, project, ticket, user2):
        from csm.models import CsmNotification
        ticket.assigned_to = user2
        ticket.save(update_fields=['assigned_to'])
        self._run(project, ticket, [{'type': 'notify', 'recipient': 'assigned_agent', 'text': 'hi'}])
        assert CsmNotification.objects.filter(recipient=user2, notification_type='automation').count() == 1

    def test_notify_no_recipient_skipped(self, project, ticket):
        self._run(project, ticket, [{'type': 'notify', 'recipient': 'assigned_agent', 'text': 'hi'}])
        assert AutomationExecutionLog.objects.first().actions_performed[0]['status'] == 'skipped'

    def test_customer_notify_posts_message(self, project, csm_queue, customer):
        from csm.models import Conversation, ConversationMessage
        conv = Conversation.objects.create(queue=csm_queue, customer=customer, status='active')
        ticket = Ticket.objects.create(
            queue=csm_queue, title='T', priority='medium', status='in_progress', conversation=conv,
        )
        self._run(project, ticket, [{'type': 'customer_notify', 'text': 'We received your request.'}])
        msg = ConversationMessage.objects.filter(conversation=conv, sender_type='system').first()
        assert msg is not None
        assert msg.content == 'We received your request.'

    def test_customer_notify_no_conversation_skipped(self, project, ticket):
        self._run(project, ticket, [{'type': 'customer_notify', 'text': 'x'}])
        assert AutomationExecutionLog.objects.first().actions_performed[0]['status'] == 'skipped'

    def test_add_note_creates_internal_note(self, project, csm_queue, customer):
        from customer.models import CustomerInternalNote
        from csm.models import Conversation
        conv = Conversation.objects.create(queue=csm_queue, customer=customer, status='active')
        ticket = Ticket.objects.create(
            queue=csm_queue, title='T', priority='medium', status='in_progress', conversation=conv,
        )
        self._run(project, ticket, [{'type': 'add_note', 'text': 'VIP customer'}])
        note = CustomerInternalNote.objects.filter(customer=customer).first()
        assert note is not None
        assert note.body_text == 'VIP customer'

    def test_add_note_no_customer_skipped(self, project, ticket):
        self._run(project, ticket, [{'type': 'add_note', 'text': 'x'}])
        assert AutomationExecutionLog.objects.first().actions_performed[0]['status'] == 'skipped'
