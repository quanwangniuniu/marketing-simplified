"""Tests for the automation rule + execution log API."""

import pytest
from django.urls import reverse
from rest_framework import status

from csm.models import AutomationRule, AutomationExecutionLog, Ticket

pytestmark = pytest.mark.django_db


def _rules_url(project_id):
    return reverse('automation-rule-list') + f'?project={project_id}'


def _logs_url(project_id):
    return reverse('automation-log-list') + f'?project={project_id}'


class TestAutomationRuleAPI:
    def test_create_rule(self, member_client, project):
        resp = member_client.post(_rules_url(project.id), {
            'name': 'Escalate on breach',
            'trigger_event': 'sla_breached',
            'conditions': [{'field': 'priority', 'operator': 'eq', 'value': 'high'}],
            'actions': [{'type': 'set_priority', 'value': 'critical'}],
        }, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        rule = AutomationRule.objects.get(project=project, name='Escalate on breach')
        assert rule.created_by is not None            # perform_create stamps the author
        assert rule.trigger_event == 'sla_breached'

    def test_list_rules_scoped_to_project(self, member_client, project):
        AutomationRule.objects.create(
            project=project, name='R', trigger_event='ticket_created',
            actions=[{'type': 'add_tag', 'value': 'x'}],
        )
        resp = member_client.get(_rules_url(project.id))
        assert resp.status_code == status.HTTP_200_OK
        names = {r['name'] for r in (resp.data if isinstance(resp.data, list) else resp.data['results'])}
        assert 'R' in names

    def test_invalid_condition_field_rejected(self, member_client, project):
        resp = member_client.post(_rules_url(project.id), {
            'name': 'Bad', 'trigger_event': 'ticket_created',
            'conditions': [{'field': 'nonsense', 'operator': 'eq', 'value': 'x'}],
            'actions': [{'type': 'add_tag', 'value': 'x'}],
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_unknown_action_type_rejected(self, member_client, project):
        resp = member_client.post(_rules_url(project.id), {
            'name': 'Bad', 'trigger_event': 'ticket_created',
            'conditions': [], 'actions': [{'type': 'no_such_action'}],
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_empty_actions_rejected(self, member_client, project):
        resp = member_client.post(_rules_url(project.id), {
            'name': 'Bad', 'trigger_event': 'ticket_created',
            'conditions': [], 'actions': [],
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_toggle_active(self, member_client, project):
        rule = AutomationRule.objects.create(
            project=project, name='R', trigger_event='ticket_created',
            actions=[{'type': 'add_tag', 'value': 'x'}], is_active=True,
        )
        url = reverse('automation-rule-detail', kwargs={'pk': rule.id})
        resp = member_client.patch(url, {'is_active': False}, format='json')
        assert resp.status_code == status.HTTP_200_OK
        rule.refresh_from_db()
        assert rule.is_active is False


class TestAutomationLogAPI:
    def test_log_list_read_only(self, member_client, project, csm_queue):
        rule = AutomationRule.objects.create(
            project=project, name='R', trigger_event='ticket_created',
            actions=[{'type': 'add_tag', 'value': 'x'}],
        )
        ticket = Ticket.objects.create(queue=csm_queue, title='T')
        AutomationExecutionLog.objects.create(
            rule=rule, rule_name='R', trigger_event='ticket_created',
            ticket=ticket, ticket_ref=ticket.id,
            actions_performed=[{'type': 'add_tag', 'status': 'ok'}],
        )
        resp = member_client.get(_logs_url(project.id))
        assert resp.status_code == status.HTTP_200_OK
        rows = resp.data if isinstance(resp.data, list) else resp.data['results']
        assert len(rows) == 1
        assert rows[0]['rule_name'] == 'R'

    def test_log_is_read_only(self, member_client, project):
        resp = member_client.post(_logs_url(project.id), {}, format='json')
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


class TestTagTrigger:
    def test_patch_tags_saves_and_fires_tag_added(
        self, member_client, project, csm_queue, user, django_capture_on_commit_callbacks,
    ):
        from csm.models import QueueAgent
        QueueAgent.objects.create(queue=csm_queue, user=user)   # grant ticket access
        ticket = Ticket.objects.create(
            queue=csm_queue, title='T', priority='medium', status='in_progress',
        )
        AutomationRule.objects.create(
            project=project, name='R', trigger_event='tag_added',
            conditions=[{'field': 'tags', 'operator': 'contains', 'value': 'urgent'}],
            actions=[{'type': 'set_priority', 'value': 'critical'}], is_active=True,
        )
        url = reverse('ticket-detail', kwargs={'pk': ticket.id})
        with django_capture_on_commit_callbacks(execute=True):
            resp = member_client.patch(url, {'tags': ['urgent']}, format='json')
        assert resp.status_code == status.HTTP_200_OK
        ticket.refresh_from_db()
        assert ticket.tags == ['urgent']            # tags saved via API
        assert ticket.priority == 'critical'        # tag_added rule fired
