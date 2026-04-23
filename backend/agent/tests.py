import json
import uuid
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from core.models import Organization, Project, ProjectMember, CustomUser
from .models import (
    AgentSession, AgentMessage, AgentWorkflowRun,
    AgentWorkflowDefinition, AgentWorkflowStep, AgentStepExecution,
)
from .services import AgentOrchestrator, _forward_to_users


def _test_analysis_data():
    """Minimal valid analysis structure for tests."""
    return {
        "anomalies": [
            {
                "metric": "ROAS",
                "movement": "SHARP_DECREASE",
                "scope_type": "CAMPAIGN",
                "scope_value": "Test Campaign",
                "delta_value": -20.0,
                "delta_unit": "PERCENT",
                "period": "LAST_7_DAYS",
                "description": "Test Campaign ROAS dropped 20%",
            },
        ],
        "suggested_decision": {
            "title": "Test Decision",
            "context_summary": "Test context",
            "reasoning": "Test reasoning",
            "risk_level": "MEDIUM",
            "confidence": 3,
            "options": [
                {"text": "Option A", "order": 0},
                {"text": "Option B", "order": 1},
            ],
        },
        "recommended_tasks": [
            {"type": "optimization", "summary": "Test task", "priority": "MEDIUM"},
        ],
    }


class AgentModelTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Test Org', slug='test-org')
        self.user = CustomUser.objects.create_user(
            email='agent@test.com',
            username='agentuser',
            password='testpass123',
        )
        self.user.organization = self.org
        self.user.save()
        self.project = Project.objects.create(
            name='Test Project',
            organization=self.org,
            owner=self.user,
        )

    def test_create_session(self):
        session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
            title='Test Session',
        )
        self.assertEqual(session.status, 'active')
        self.assertEqual(str(session.id), str(session.pk))

    def test_create_message(self):
        session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
        )
        msg = AgentMessage.objects.create(
            session=session,
            role='user',
            content='Hello agent',
        )
        self.assertEqual(msg.message_type, 'text')
        self.assertEqual(msg.metadata, {})

    def test_create_workflow_run(self):
        session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
        )
        run = AgentWorkflowRun.objects.create(
            session=session,
            status='analyzing',
        )
        self.assertEqual(run.status, 'analyzing')
        self.assertIsNone(run.spreadsheet)


class AgentSessionAPITests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Test Org API', slug='test-org-api')
        self.user = CustomUser.objects.create_user(
            email='agentapi@test.com',
            username='agentapiuser',
            password='testpass123',
        )
        self.user.organization = self.org
        self.user.save()
        self.project = Project.objects.create(
            name='Test Project API',
            organization=self.org,
            owner=self.user,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_session(self):
        response = self.client.post(
            '/api/agent/sessions/',
            {'project_id': self.project.id},
            format='json',
            HTTP_X_PROJECT_ID=str(self.project.id),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)

    def test_list_sessions(self):
        AgentSession.objects.create(
            user=self.user,
            project=self.project,
            title='Session 1',
        )
        response = self.client.get(
            '/api/agent/sessions/',
            HTTP_X_PROJECT_ID=str(self.project.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_retrieve_session(self):
        session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
            title='Detail Session',
        )
        AgentMessage.objects.create(
            session=session,
            role='user',
            content='test message',
        )
        response = self.client.get(
            f'/api/agent/sessions/{session.id}/',
            HTTP_X_PROJECT_ID=str(self.project.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['messages']), 1)

    def test_delete_session(self):
        session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
        )
        response = self.client.delete(
            f'/api/agent/sessions/{session.id}/',
            HTTP_X_PROJECT_ID=str(self.project.id),
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        session.refresh_from_db()
        self.assertTrue(session.is_deleted)


class ChatAPITests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Test Org Chat', slug='test-org-chat')
        self.user = CustomUser.objects.create_user(
            email='chat@test.com',
            username='chatuser',
            password='testpass123',
        )
        self.user.organization = self.org
        self.user.save()
        self.project = Project.objects.create(
            name='Test Project Chat',
            organization=self.org,
            owner=self.user,
        )
        self.session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_chat_returns_sse_response(self):
        response = self.client.post(
            f'/api/agent/sessions/{self.session.id}/chat/',
            {'message': 'Hello'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/event-stream')

    def test_chat_creates_messages(self):
        response = self.client.post(
            f'/api/agent/sessions/{self.session.id}/chat/',
            {'message': 'Hello agent'},
            format='json',
        )
        # Consume the streaming response
        content = b''.join(response.streaming_content).decode()
        self.assertIn('"type": "done"', content)

        # Check messages were saved
        messages = AgentMessage.objects.filter(session=self.session)
        self.assertEqual(messages.filter(role='user').count(), 1)
        self.assertEqual(messages.filter(role='assistant').count(), 1)

    def test_chat_session_not_found(self):
        fake_id = uuid.uuid4()
        response = self.client.post(
            f'/api/agent/sessions/{fake_id}/chat/',
            {'message': 'Hello'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_chat_sets_session_title(self):
        self.client.post(
            f'/api/agent/sessions/{self.session.id}/chat/',
            {'message': 'Analyze my campaign data'},
            format='json',
        )
        self.session.refresh_from_db()
        self.assertEqual(self.session.title, 'Analyze my campaign data')


class SpreadsheetListAPITests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Test Org SS', slug='test-org-ss')
        self.user = CustomUser.objects.create_user(
            email='ss@test.com',
            username='ssuser',
            password='testpass123',
        )
        self.user.organization = self.org
        self.user.save()
        self.project = Project.objects.create(
            name='Test Project SS',
            organization=self.org,
            owner=self.user,
        )
        ProjectMember.objects.create(user=self.user, project=self.project, is_active=True)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_list_spreadsheets(self):
        from spreadsheet.models import Spreadsheet
        Spreadsheet.objects.create(project=self.project, name='Test Sheet')
        response = self.client.get(
            '/api/agent/spreadsheets/',
            HTTP_X_PROJECT_ID=str(self.project.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Test Sheet')

    def test_list_spreadsheets_no_project(self):
        response = self.client.get('/api/agent/spreadsheets/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class OrchestratorTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Test Org Orch', slug='test-org-orch')
        self.user = CustomUser.objects.create_user(
            email='orch@test.com',
            username='orchuser',
            password='testpass123',
        )
        self.user.organization = self.org
        self.user.save()
        self.project = Project.objects.create(
            name='Test Project Orch',
            organization=self.org,
            owner=self.user,
        )
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role='owner',
            is_active=True,
        )
        self.session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
        )

    def test_handle_message_general_chat(self):
        orchestrator = AgentOrchestrator(self.user, self.project, self.session)
        chunks = list(orchestrator.handle_message("hello"))
        types = [c['type'] for c in chunks]
        self.assertIn('text', types)
        self.assertIn('done', types)

    def test_create_decision_draft(self):
        from decision.models import Decision, Signal, Option
        orchestrator = AgentOrchestrator(self.user, self.project, self.session)
        analysis = _test_analysis_data()
        chunks = list(orchestrator.create_decision_draft(analysis))
        types = [c['type'] for c in chunks]
        self.assertIn('decision_draft', types)

        # Verify decision was created
        decision = Decision.objects.filter(project=self.project).last()
        self.assertIsNotNone(decision)
        self.assertEqual(decision.author, self.user)
        self.assertTrue(decision.signals.exists())
        self.assertTrue(decision.options.exists())

    def test_create_tasks_from_decision(self):
        from decision.models import Decision
        from task.models import Task

        decision = Decision.objects.create(
            title='Test Decision',
            project=self.project,
            project_seq=1,
            author=self.user,
        )
        workflow_run = AgentWorkflowRun.objects.create(
            session=self.session,
            decision=decision,
            analysis_result=_test_analysis_data(),
        )
        orchestrator = AgentOrchestrator(self.user, self.project, self.session)
        chunks = list(orchestrator.create_tasks_from_analysis(workflow_run))
        types = [c['type'] for c in chunks]
        self.assertIn('task_created', types)

        # Verify tasks were created
        tasks = Task.objects.filter(project=self.project)
        self.assertTrue(tasks.exists())
        workflow_run.refresh_from_db()
        self.assertEqual(workflow_run.status, 'completed')


    @patch('agent.services._call_gemini_chat')
    def test_follow_up_completed_marks_run_and_passes_project_members(self, mock_call_dify_chat):
        teammate = CustomUser.objects.create_user(
            email='alice@test.com',
            username='alice',
            password='testpass123',
            first_name='Alice',
            last_name='Chen',
        )
        teammate.organization = self.org
        teammate.save()
        ProjectMember.objects.create(
            user=teammate,
            project=self.project,
            role='member',
            is_active=True,
        )
        workflow_run = AgentWorkflowRun.objects.create(
            session=self.session,
            status='awaiting_confirmation',
            analysis_result=_test_analysis_data(),
            chat_follow_up_started=True,
        )
        AgentMessage.objects.create(
            session=self.session,
            role='assistant',
            content='Analysis complete.',
        )
        mock_call_dify_chat.return_value = {
            'status': 'completed',
            'text': 'Prepared a summary.',
            'forwards': [],
        }

        orchestrator = AgentOrchestrator(self.user, self.project, self.session)
        chunks = list(orchestrator.handle_message("Explain this to me."))

        self.assertIn(
            {'type': 'text', 'content': 'Prepared a summary.'},
            chunks,
        )
        workflow_run.refresh_from_db()
        self.assertTrue(workflow_run.chat_followed_up)

        self.assertTrue(mock_call_dify_chat.called)
        project_members = mock_call_dify_chat.call_args.kwargs['project_members']
        current_username = mock_call_dify_chat.call_args.kwargs['current_username']
        usernames = {member['username'] for member in project_members}
        self.assertEqual(current_username, 'orchuser')
        self.assertIn('orchuser', usernames)
        self.assertIn('alice', usernames)
        self.assertNotIn('agent-bot', usernames)

    @patch('agent.services._call_gemini_chat')
    def test_follow_up_needs_clarification_keeps_run_open(self, mock_call_dify_chat):
        workflow_run = AgentWorkflowRun.objects.create(
            session=self.session,
            status='awaiting_confirmation',
            analysis_result=_test_analysis_data(),
            chat_follow_up_started=True,
        )
        mock_call_dify_chat.return_value = {
            'status': 'needs_clarification',
            'text': 'Please provide the exact username.',
            'forwards': [],
        }

        orchestrator = AgentOrchestrator(self.user, self.project, self.session)
        chunks = list(orchestrator.handle_message("Forward this to Alex."))

        self.assertIn(
            {'type': 'text', 'content': 'Please provide the exact username.'},
            chunks,
        )
        self.assertEqual(
            mock_call_dify_chat.call_args.kwargs['current_username'],
            'orchuser',
        )
        workflow_run.refresh_from_db()
        self.assertFalse(workflow_run.chat_followed_up)
        self.assertTrue(workflow_run.chat_follow_up_started)

    def test_start_follow_up_marks_run_started_and_returns_prompt(self):
        workflow_run = AgentWorkflowRun.objects.create(
            session=self.session,
            status='awaiting_confirmation',
            analysis_result=_test_analysis_data(),
        )

        orchestrator = AgentOrchestrator(self.user, self.project, self.session)
        chunks = list(orchestrator.handle_message("start_follow_up", action="start_follow_up"))

        self.assertIn(
            {
                'type': 'follow_up_prompt',
                'content': 'Follow-up chat started. Ask one follow-up question about the analysis, or include the exact username/email if you want me to prepare a forwarded message.',
                'data': {'workflow_run_id': str(workflow_run.id)},
            },
            chunks,
        )
        workflow_run.refresh_from_db()
        self.assertTrue(workflow_run.chat_follow_up_started)
        self.assertFalse(workflow_run.chat_followed_up)

    def test_cancel_follow_up_marks_run_inactive(self):
        workflow_run = AgentWorkflowRun.objects.create(
            session=self.session,
            status='awaiting_confirmation',
            analysis_result=_test_analysis_data(),
            chat_follow_up_started=True,
        )

        orchestrator = AgentOrchestrator(self.user, self.project, self.session)
        chunks = list(orchestrator.handle_message("cancel_follow_up", action="cancel_follow_up"))

        self.assertIn(
            {
                'type': 'text',
                'content': 'Follow-up chat closed.',
                'data': {'workflow_run_id': str(workflow_run.id)},
            },
            chunks,
        )
        workflow_run.refresh_from_db()
        self.assertFalse(workflow_run.chat_follow_up_started)
        self.assertFalse(workflow_run.chat_followed_up)

    @patch('agent.services._call_gemini_chat')
    def test_follow_up_requires_explicit_start(self, mock_call_dify_chat):
        AgentWorkflowRun.objects.create(
            session=self.session,
            status='awaiting_confirmation',
            analysis_result=_test_analysis_data(),
        )

        orchestrator = AgentOrchestrator(self.user, self.project, self.session)
        chunks = list(orchestrator.handle_message("Explain this to me."))

        self.assertIn(
            {
                'type': 'text',
                'content': (
                    "I can help you analyze spreadsheet data and create decisions. "
                    "To get started, select a spreadsheet and use the 'analyze' action."
                ),
            },
            chunks,
        )
        mock_call_dify_chat.assert_not_called()

    @patch('chat.tasks.notify_new_message.delay')
    def test_forward_to_users_does_not_match_first_name(self, mock_notify_delay):
        teammate = CustomUser.objects.create_user(
            email='alice-fn@test.com',
            username='alice-ops',
            password='testpass123',
            first_name='Alice',
            last_name='Operator',
        )
        teammate.organization = self.org
        teammate.save()
        ProjectMember.objects.create(
            user=teammate,
            project=self.project,
            role='member',
            is_active=True,
        )

        results = _forward_to_users(
            [{'username': 'Alice', 'content': 'Please review the report.'}],
            self.user,
            self.project,
        )

        self.assertEqual(results[0]['status'], 'not_found')
        mock_notify_delay.assert_not_called()

    @patch('chat.tasks.notify_new_message.delay')
    def test_forward_to_users_reactivates_existing_private_chat(self, mock_notify_delay):
        from chat.models import Chat, ChatParticipant, ChatType
        from core.utils.bot_user import get_agent_bot_user

        teammate = CustomUser.objects.create_user(
            email='alice-chat@test.com',
            username='alice-chat',
            password='testpass123',
        )
        teammate.organization = self.org
        teammate.save()
        ProjectMember.objects.create(
            user=teammate,
            project=self.project,
            role='member',
            is_active=True,
        )

        bot = get_agent_bot_user()
        chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=chat, user=bot, is_active=True)
        participant = ChatParticipant.objects.create(chat=chat, user=teammate, is_active=False)

        results = _forward_to_users(
            [{'username': 'alice-chat', 'content': 'Please review Campaign A.'}],
            self.user,
            self.project,
        )

        participant.refresh_from_db()
        self.assertTrue(participant.is_active)
        self.assertEqual(results[0]['status'], 'sent')
        mock_notify_delay.assert_called_once()


class DecisionFieldCompatibilityTests(TestCase):
    """
    Verify that every field written by create_decision_draft() is compatible
    with the existing Decision module (models, validation, FSM transitions).

    The workflow must fully pass through decision creation and every field
    must be checked in detail, with tests to support.
    """

    def setUp(self):
        self.org = Organization.objects.create(name='Test Org FieldCompat', slug='test-org-fc')
        self.user = CustomUser.objects.create_user(
            email='fc@test.com',
            username='fcuser',
            password='testpass123',
        )
        self.user.organization = self.org
        self.user.save()
        self.project = Project.objects.create(
            name='Test Project FieldCompat',
            organization=self.org,
            owner=self.user,
        )
        self.session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
        )
        self.orchestrator = AgentOrchestrator(self.user, self.project, self.session)

    def _create_decision(self, analysis=None):
        """Helper: run create_decision_draft and return the created Decision."""
        from decision.models import Decision
        data = analysis or _test_analysis_data()
        list(self.orchestrator.create_decision_draft(data))
        # ordering is '-created_at', so .first() returns the most recently created
        return Decision.objects.filter(project=self.project).first()

    # ------------------------------------------------------------------ #
    # Decision top-level fields                                           #
    # ------------------------------------------------------------------ #

    def test_decision_title_set(self):
        decision = self._create_decision()
        self.assertEqual(decision.title, 'Test Decision')

    def test_decision_context_summary_set(self):
        decision = self._create_decision()
        self.assertEqual(decision.context_summary, 'Test context')

    def test_decision_reasoning_set(self):
        decision = self._create_decision()
        self.assertEqual(decision.reasoning, 'Test reasoning')

    def test_decision_risk_level_valid_choice(self):
        from decision.models import Decision
        decision = self._create_decision()
        valid_choices = [c[0] for c in Decision.RiskLevel.choices]
        self.assertIn(decision.risk_level, valid_choices)

    def test_decision_confidence_in_valid_range(self):
        decision = self._create_decision()
        self.assertIn(decision.confidence, [1, 2, 3, 4, 5])

    def test_decision_status_is_predraft(self):
        from decision.models import Decision
        decision = self._create_decision()
        self.assertEqual(decision.status, Decision.Status.PREDRAFT)

    def test_decision_project_linked(self):
        decision = self._create_decision()
        self.assertEqual(decision.project, self.project)

    def test_decision_author_linked(self):
        decision = self._create_decision()
        self.assertEqual(decision.author, self.user)

    def test_decision_created_by_agent_flag(self):
        decision = self._create_decision()
        self.assertTrue(decision.created_by_agent)

    def test_decision_agent_session_id_linked(self):
        decision = self._create_decision()
        self.assertEqual(decision.agent_session_id, self.session.id)

    def test_decision_project_seq_assigned(self):
        decision = self._create_decision()
        self.assertIsNotNone(decision.project_seq)
        self.assertGreater(decision.project_seq, 0)

    def test_decision_project_seq_increments(self):
        d1 = self._create_decision()
        d1_seq = d1.project_seq
        d2 = self._create_decision()
        self.assertEqual(d2.project_seq, d1_seq + 1)

    # ------------------------------------------------------------------ #
    # Option fields                                                       #
    # ------------------------------------------------------------------ #

    def test_options_count_at_least_two(self):
        decision = self._create_decision()
        self.assertGreaterEqual(decision.options.count(), 2)

    def test_options_have_non_empty_text(self):
        decision = self._create_decision()
        for opt in decision.options.all():
            self.assertTrue(opt.text.strip(), f"Option id={opt.id} has empty text")

    def test_exactly_one_option_is_selected(self):
        decision = self._create_decision()
        selected_count = decision.options.filter(is_selected=True).count()
        self.assertEqual(selected_count, 1)

    def test_first_option_is_selected(self):
        decision = self._create_decision()
        first_option = decision.options.order_by('order').first()
        self.assertTrue(first_option.is_selected)

    def test_options_order_is_sequential(self):
        decision = self._create_decision()
        orders = list(decision.options.order_by('order').values_list('order', flat=True))
        self.assertEqual(orders, list(range(len(orders))))

    # ------------------------------------------------------------------ #
    # Signal fields                                                       #
    # ------------------------------------------------------------------ #

    def test_signals_count_at_least_one(self):
        decision = self._create_decision()
        self.assertGreaterEqual(decision.signals.count(), 1)

    def test_signal_metric_valid_choice(self):
        from decision.models import Signal
        decision = self._create_decision()
        valid_metrics = [c[0] for c in Signal.Metric.choices]
        for signal in decision.signals.all():
            self.assertIn(
                signal.metric, valid_metrics,
                f"Signal metric '{signal.metric}' is not a valid choice"
            )

    def test_signal_movement_valid_choice(self):
        from decision.models import Signal
        decision = self._create_decision()
        valid_movements = [c[0] for c in Signal.Movement.choices]
        for signal in decision.signals.all():
            self.assertIn(
                signal.movement, valid_movements,
                f"Signal movement '{signal.movement}' is not a valid choice"
            )

    def test_signal_period_valid_choice(self):
        from decision.models import Signal
        decision = self._create_decision()
        valid_periods = [c[0] for c in Signal.Period.choices]
        for signal in decision.signals.all():
            self.assertIn(
                signal.period, valid_periods,
                f"Signal period '{signal.period}' is not a valid choice"
            )

    def test_signal_scope_type_valid_choice(self):
        from decision.models import Signal
        decision = self._create_decision()
        valid_scope_types = [c[0] for c in Signal.ScopeType.choices]
        for signal in decision.signals.all():
            if signal.scope_type:
                self.assertIn(
                    signal.scope_type, valid_scope_types,
                    f"Signal scope_type '{signal.scope_type}' is not a valid choice"
                )

    def test_signal_delta_unit_valid_choice(self):
        from decision.models import Signal
        decision = self._create_decision()
        valid_units = [c[0] for c in Signal.DeltaUnit.choices]
        for signal in decision.signals.all():
            if signal.delta_unit:
                self.assertIn(
                    signal.delta_unit, valid_units,
                    f"Signal delta_unit '{signal.delta_unit}' is not a valid choice"
                )

    def test_signal_display_text_set(self):
        decision = self._create_decision()
        for signal in decision.signals.all():
            self.assertTrue(
                len(signal.display_text) > 0,
                "Signal display_text should not be empty"
            )

    def test_signal_author_linked(self):
        decision = self._create_decision()
        for signal in decision.signals.all():
            self.assertEqual(signal.author, self.user)

    # ------------------------------------------------------------------ #
    # Full commit flow — end-to-end compatibility with Decision module    #
    # ------------------------------------------------------------------ #

    def test_agent_decision_can_be_committed(self):
        """
        The decision created by the agent must pass validate_can_commit()
        and successfully transition to COMMITTED (or AWAITING_APPROVAL for HIGH risk).
        This is the definitive compatibility test.
        """
        from decision.models import Decision
        decision = self._create_decision()
        self.assertEqual(decision.status, Decision.Status.PREDRAFT)

        # Should not raise ValidationError
        try:
            decision.validate_can_commit()
        except Exception as e:
            self.fail(f"validate_can_commit() raised {e!r} on agent-created decision")

    def test_agent_decision_fsm_commit_transition(self):
        """Agent-created MEDIUM/LOW risk decision transitions to COMMITTED via FSM."""
        from decision.models import Decision
        analysis = _test_analysis_data()
        analysis['suggested_decision']['risk_level'] = 'MEDIUM'
        decision = self._create_decision(analysis)

        decision.commit(user=self.user)
        decision.save()
        # refresh_from_db() cannot be used on protected FSMField; fetch a new instance
        committed = Decision.objects.get(pk=decision.pk)
        self.assertEqual(committed.status, Decision.Status.COMMITTED)

    def test_agent_decision_fsm_high_risk_awaiting_approval(self):
        """Agent-created HIGH risk decision transitions to AWAITING_APPROVAL via FSM."""
        from decision.models import Decision
        analysis = _test_analysis_data()
        analysis['suggested_decision']['risk_level'] = 'HIGH'
        decision = self._create_decision(analysis)

        decision.submit_for_approval(user=self.user)
        decision.save()
        # refresh_from_db() cannot be used on protected FSMField; fetch a new instance
        approved = Decision.objects.get(pk=decision.pk)
        self.assertEqual(approved.status, Decision.Status.AWAITING_APPROVAL)

    def test_agent_decision_appears_in_project_decision_list(self):
        """Agent-created decision is queryable via the same project FK as manual decisions."""
        from decision.models import Decision
        decision = self._create_decision()
        qs = Decision.objects.filter(project=self.project, created_by_agent=True)
        self.assertIn(decision, qs)

    def test_sse_response_includes_decision_id(self):
        """The decision_draft SSE event must include decision_id for frontend navigation."""
        data = _test_analysis_data()
        chunks = list(self.orchestrator.create_decision_draft(data))
        draft_chunk = next((c for c in chunks if c['type'] == 'decision_draft'), None)
        self.assertIsNotNone(draft_chunk)
        self.assertIn('decision_id', draft_chunk.get('data', {}))
        self.assertIsNotNone(draft_chunk['data']['decision_id'])


class CalendarAgentTests(TestCase):
    """
    Verify that answer_calendar_question() correctly routes calendar
    context through the Dify Calendar workflow and handles responses.
    """

    def setUp(self):
        self.org = Organization.objects.create(name='Test Org Cal', slug='test-org-cal')
        self.user = CustomUser.objects.create_user(
            email='cal@test.com',
            username='caluser',
            password='testpass123',
        )
        self.user.organization = self.org
        self.user.save()
        self.project = Project.objects.create(
            name='Test Project Cal',
            organization=self.org,
            owner=self.user,
        )
        self.session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
        )
        self.orchestrator = AgentOrchestrator(self.user, self.project, self.session)

    def _make_calendar_and_event(self, days_offset=1):
        """Create a Calendar + Event for this org and return (calendar, event)."""
        from calendars.models import Calendar as CalendarModel, Event as EventModel
        from django.utils import timezone
        cal = CalendarModel.objects.create(
            organization=self.org,
            owner=self.user,
            name='Test Calendar',
        )
        now = timezone.now()
        event = EventModel.objects.create(
            organization=self.org,
            calendar=cal,
            created_by=self.user,
            title='Team Standup',
            description='Daily sync',
            start_datetime=now + timezone.timedelta(days=days_offset),
            end_datetime=now + timezone.timedelta(days=days_offset, hours=1),
            timezone='UTC',
        )
        return cal, event

    # ------------------------------------------------------------------ #
    # handle_message routing                                              #
    # ------------------------------------------------------------------ #

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'})
    @patch('agent.gemini_client.call_gemini')
    def test_handle_message_routes_to_calendar_when_context_provided(self, mock_call_gemini):
        """handle_message with calendar_context skips general chat and calls Gemini calendar."""
        mock_call_gemini.return_value = '{"answer": "You have 1 event.", "create_events": []}'

        calendar_context = {'type': 'calendar', 'calendarIds': [], 'currentView': 'week'}
        chunks = list(self.orchestrator.handle_message(
            'What is on my calendar?',
            calendar_context=calendar_context,
        ))
        types = [c['type'] for c in chunks]
        self.assertIn('text', types)
        self.assertIn('done', types)
        self.assertTrue(mock_call_gemini.called)

    @patch('agent.services.requests.post')
    def test_handle_message_without_calendar_context_skips_calendar(self, mock_post):
        """handle_message without calendar_context must NOT call the calendar Dify endpoint."""
        chunks = list(self.orchestrator.handle_message('Hello'))
        # requests.post should not have been called for the calendar workflow
        self.assertFalse(mock_post.called)

    # ------------------------------------------------------------------ #
    # _fetch_events_for_context                                           #
    # ------------------------------------------------------------------ #

    def test_fetch_events_returns_upcoming_events(self):
        """Events within the 30-day past / 60-day future window are returned."""
        _, event = self._make_calendar_and_event(days_offset=5)
        calendar_context = {'type': 'calendar', 'calendarIds': []}
        events = self.orchestrator._fetch_events_for_context(calendar_context)
        event_ids = [str(e.id) for e in events]
        self.assertIn(str(event.id), event_ids)

    def test_fetch_events_returns_specific_event_by_id(self):
        """When eventId is given, only that event is returned."""
        _, event = self._make_calendar_and_event(days_offset=3)
        calendar_context = {'type': 'event', 'eventId': str(event.id)}
        events = self.orchestrator._fetch_events_for_context(calendar_context)
        self.assertEqual(len(events), 1)
        self.assertEqual(str(events[0].id), str(event.id))

    def test_fetch_events_filters_by_calendar_ids(self):
        """calendarIds filter limits results to the specified calendar."""
        from calendars.models import Calendar as CalendarModel, Event as EventModel
        from django.utils import timezone

        cal1, event1 = self._make_calendar_and_event(days_offset=2)
        cal2 = CalendarModel.objects.create(
            organization=self.org, owner=self.user, name='Other Calendar',
        )
        now = timezone.now()
        event2 = EventModel.objects.create(
            organization=self.org,
            calendar=cal2,
            created_by=self.user,
            title='Other Event',
            start_datetime=now + timezone.timedelta(days=2),
            end_datetime=now + timezone.timedelta(days=2, hours=1),
            timezone='UTC',
        )

        context_cal1_only = {'type': 'calendar', 'calendarIds': [str(cal1.id)]}
        events = self.orchestrator._fetch_events_for_context(context_cal1_only)
        ids = [str(e.id) for e in events]
        self.assertIn(str(event1.id), ids)
        self.assertNotIn(str(event2.id), ids)

    def test_fetch_events_returns_empty_for_unknown_event_id(self):
        """Non-existent eventId returns empty list (no crash)."""
        context = {'type': 'event', 'eventId': str(uuid.uuid4())}
        events = self.orchestrator._fetch_events_for_context(context)
        self.assertEqual(events, [])

    # ------------------------------------------------------------------ #
    # answer_calendar_question — Dify response handling                  #
    # ------------------------------------------------------------------ #

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'})
    @patch('agent.gemini_client.call_gemini')
    def test_answer_calendar_question_yields_text_chunk(self, mock_call_gemini):
        """A successful Gemini response yields a text chunk with the answer."""
        mock_call_gemini.return_value = '{"answer": "You have 2 events this week.", "create_events": []}'

        self._make_calendar_and_event(days_offset=1)
        context = {'type': 'calendar', 'calendarIds': []}
        chunks = list(self.orchestrator.answer_calendar_question('What is on my calendar?', context))
        text_chunks = [c for c in chunks if c['type'] == 'text' and 'events this week' in c.get('content', '')]
        self.assertTrue(len(text_chunks) > 0)

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'})
    @patch('agent.gemini_client.call_gemini')
    def test_answer_calendar_question_creates_event_from_dify(self, mock_call_gemini):
        """When Gemini returns create_events, the events are created in the DB."""
        from calendars.models import Calendar as CalendarModel, Event as EventModel
        CalendarModel.objects.create(
            organization=self.org, owner=self.user, name='My Calendar',
        )
        mock_call_gemini.return_value = json.dumps({
            'answer': 'I have scheduled a meeting for you.',
            'create_events': [{
                'title': 'AI Scheduled Meeting',
                'description': 'Auto-created by agent',
                'start_datetime': '2026-04-01T10:00:00+00:00',
                'end_datetime': '2026-04-01T11:00:00+00:00',
            }]
        })

        before_count = EventModel.objects.filter(organization=self.org).count()
        context = {'type': 'calendar', 'calendarIds': []}
        list(self.orchestrator.answer_calendar_question('Schedule a meeting', context))
        after_count = EventModel.objects.filter(organization=self.org).count()
        self.assertEqual(after_count, before_count + 1)

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'})
    @patch('agent.gemini_client.call_gemini')
    def test_answer_calendar_question_dify_error_yields_error_chunk(self, mock_call_gemini):
        """A Gemini error yields an error chunk without raising."""
        mock_call_gemini.side_effect = Exception('Network timeout')
        context = {'type': 'calendar', 'calendarIds': []}
        chunks = list(self.orchestrator.answer_calendar_question('What is on my calendar?', context))
        error_chunks = [c for c in chunks if c['type'] == 'error']
        self.assertTrue(len(error_chunks) > 0)

    @override_settings(GEMINI_API_KEY='')
    @patch.dict('os.environ', {'GEMINI_API_KEY': ''}, clear=False)
    def test_answer_calendar_question_no_api_key_yields_error(self):
        """Missing GEMINI_API_KEY yields a configuration error chunk."""
        context = {'type': 'calendar', 'calendarIds': []}
        chunks = list(self.orchestrator.answer_calendar_question('Any events?', context))
        error_chunks = [c for c in chunks if c['type'] == 'error']
        self.assertTrue(len(error_chunks) > 0)


def _create_default_workflow():
    """Helper: create a system default 5-step workflow definition."""
    wf = AgentWorkflowDefinition.objects.create(
        name='Default Analysis Workflow',
        description='Analyze, confirm, decide, confirm, tasks',
        is_default=True,
        is_system=True,
        status='active',
    )
    steps = [
        ('Analyze Data', 'analyze_data', 1, {}),
        ('Confirm Analysis', 'await_confirmation', 2,
         {'message': 'Analysis complete. Create a decision?'}),
        ('Create Decision', 'create_decision', 3, {}),
        ('Confirm Decision', 'await_confirmation', 4,
         {'message': 'Decision created. Create tasks?'}),
        ('Create Tasks', 'create_tasks', 5, {}),
    ]
    for name, step_type, order, config in steps:
        AgentWorkflowStep.objects.create(
            workflow=wf, name=name, step_type=step_type,
            order=order, config=config,
        )
    return wf


class WorkflowEngineTests(TestCase):
    """AGENT-9: Workflow engine tests."""

    def setUp(self):
        self.org = Organization.objects.create(name='Test Org WF', slug='test-org-wf')
        self.user = CustomUser.objects.create_user(
            email='wf@test.com',
            username='wfuser',
            password='testpass123',
        )
        self.user.organization = self.org
        self.user.save()
        self.project = Project.objects.create(
            name='Test Project WF',
            organization=self.org,
            owner=self.user,
        )
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role='owner',
            is_active=True,
        )
        self.session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
        )
        self.workflow = _create_default_workflow()
        self.orchestrator = AgentOrchestrator(self.user, self.project, self.session)

    def test_workflow_definition_creation(self):
        """Workflow + steps are created with correct ordering."""
        self.assertEqual(self.workflow.steps.count(), 5)
        orders = list(self.workflow.steps.values_list('order', flat=True))
        self.assertEqual(orders, [1, 2, 3, 4, 5])

    def test_default_workflow_lookup_system(self):
        """System default is found when no project default exists."""
        found = self.orchestrator._resolve_workflow()
        self.assertEqual(found, self.workflow)

    def test_default_workflow_lookup_project_priority(self):
        """Project default takes priority over system default."""
        project_wf = AgentWorkflowDefinition.objects.create(
            name='Project Workflow',
            project=self.project,
            is_default=True,
            status='active',
        )
        found = self.orchestrator._resolve_workflow()
        self.assertEqual(found, project_wf)

    def test_default_workflow_lookup_explicit_id(self):
        """Explicit workflow_id overrides all defaults."""
        other_wf = AgentWorkflowDefinition.objects.create(
            name='Other Workflow',
            status='active',
        )
        found = self.orchestrator._resolve_workflow(workflow_id=other_wf.id)
        self.assertEqual(found, other_wf)

    def test_executor_registry_complete(self):
        """All workflow step types have a registered executor."""
        from .executors import EXECUTOR_REGISTRY
        expected = {
            'analyze_data', 'call_dify', 'call_llm',
            'create_decision', 'create_tasks',
            'generate_miro_snapshot', 'create_miro_board',
            'await_confirmation', 'custom_api',
            'detect_columns', 'normalize_data',
            'generate_criteria',
        }
        self.assertEqual(set(EXECUTOR_REGISTRY.keys()), expected)

    @patch('agent.services._run_analysis')
    def test_analyze_data_executor(self, mock_analysis):
        """AnalyzeDataExecutor calls _run_analysis and returns SSE events."""
        from .executors import AnalyzeDataExecutor

        mock_analysis.return_value = _test_analysis_data()

        run = AgentWorkflowRun.objects.create(
            session=self.session,
            workflow_definition=self.workflow,
            status='analyzing',
        )
        step = self.workflow.steps.get(order=1)
        executor = AnalyzeDataExecutor(step, run, self.orchestrator)
        result = executor.execute({'spreadsheet_data': {'name': 'test', 'sheets': []}})

        self.assertTrue(result.success)
        self.assertIn('analysis_result', result.output_data)
        self.assertEqual(len(result.sse_events), 1)
        self.assertEqual(result.sse_events[0]['type'], 'analysis')
        mock_analysis.assert_called_once()

    @patch('agent.services._run_analysis')
    def test_await_confirmation_pauses_workflow(self, mock_analysis):
        """Workflow pauses at await_confirmation step and updates run status."""
        mock_analysis.return_value = _test_analysis_data()

        run = AgentWorkflowRun.objects.create(
            session=self.session,
            workflow_definition=self.workflow,
            status='analyzing',
            current_step_order=1,
        )

        chunks = list(self.orchestrator._execute_steps(
            run, {'spreadsheet_data': {'name': 'test', 'sheets': []}}
        ))

        run.refresh_from_db()
        self.assertEqual(run.status, 'awaiting_confirmation')
        self.assertEqual(run.current_step_order, 3)

        # Should have: step_progress(1), analysis, step_progress(2), confirmation_request
        types = [c.get('type') for c in chunks]
        self.assertIn('analysis', types)
        self.assertIn('confirmation_request', types)

    @patch('agent.services._run_analysis')
    def test_resume_workflow_continues_from_pause(self, mock_analysis):
        """Resume picks up from where workflow paused."""
        mock_analysis.return_value = _test_analysis_data()

        run = AgentWorkflowRun.objects.create(
            session=self.session,
            workflow_definition=self.workflow,
            status='analyzing',
            current_step_order=1,
        )

        # Execute until first pause
        list(self.orchestrator._execute_steps(
            run, {'spreadsheet_data': {'name': 'test', 'sheets': []}}
        ))
        run.refresh_from_db()
        self.assertEqual(run.status, 'awaiting_confirmation')

        # Resume — should hit create_decision (step 3) then pause again at step 4
        chunks = list(self.orchestrator._resume_workflow(run))
        run.refresh_from_db()
        types = [c.get('type') for c in chunks]
        self.assertIn('decision_draft', types)
        self.assertIn('confirmation_request', types)
        self.assertEqual(run.status, 'awaiting_confirmation')
        self.assertEqual(run.current_step_order, 5)

    @patch('agent.services._run_analysis')
    def test_step_execution_records_created(self, mock_analysis):
        """Each executed step creates an AgentStepExecution record."""
        mock_analysis.return_value = _test_analysis_data()

        run = AgentWorkflowRun.objects.create(
            session=self.session,
            workflow_definition=self.workflow,
            status='analyzing',
            current_step_order=1,
        )

        list(self.orchestrator._execute_steps(
            run, {'spreadsheet_data': {'name': 'test', 'sheets': []}}
        ))

        executions = AgentStepExecution.objects.filter(workflow_run=run)
        # Should have 2 executions: step 1 (analyze) + step 2 (await)
        self.assertEqual(executions.count(), 2)
        self.assertEqual(executions.filter(status='completed').count(), 2)

    @patch('agent.services._run_analysis')
    def test_workflow_failure_handling(self, mock_analysis):
        """Failed step marks execution and run as failed."""
        mock_analysis.side_effect = RuntimeError("API unavailable")

        run = AgentWorkflowRun.objects.create(
            session=self.session,
            workflow_definition=self.workflow,
            status='analyzing',
            current_step_order=1,
        )

        chunks = list(self.orchestrator._execute_steps(
            run, {'spreadsheet_data': {'name': 'test', 'sheets': []}}
        ))

        run.refresh_from_db()
        self.assertEqual(run.status, 'failed')

        types = [c.get('type') for c in chunks]
        self.assertIn('error', types)

        failed_exec = AgentStepExecution.objects.filter(
            workflow_run=run, status='failed'
        )
        self.assertEqual(failed_exec.count(), 1)

    def test_legacy_backward_compat(self):
        """Runs without workflow_definition use legacy logic."""
        orchestrator = AgentOrchestrator(self.user, self.project, self.session)
        chunks = list(orchestrator.handle_message("hello"))
        types = [c['type'] for c in chunks]
        self.assertIn('text', types)
        self.assertIn('done', types)


class ColumnDetectionTests(TestCase):
    """AGENT-13: Column detection and data normalization tests."""

    # ------------------------------------------------------------------ #
    # Rule-based detection                                                #
    # ------------------------------------------------------------------ #

    def test_detect_known_meta_ads_columns(self):
        """Standard Meta Ads headers are matched by DB template or rule without calling LLM."""
        from .column_registry import detect_columns

        headers = ['Campaign name', 'Amount spent', 'Impressions', 'Clicks', 'CTR']
        result = detect_columns(headers)

        # schema_key is either 'meta_ads' (rule) or a UUID string (db_template)
        self.assertIsNotNone(result.schema_key)
        self.assertIn(result.source, ('rule', 'db_template'))
        self.assertGreaterEqual(result.confidence, 0.8)
        self.assertEqual(result.mappings['Campaign name'], 'campaign_name')
        self.assertEqual(result.mappings['Amount spent'], 'amount_spent')
        self.assertEqual(result.mappings['Impressions'], 'impressions')
        self.assertEqual(result.mappings['Clicks'], 'clicks')
        self.assertEqual(result.mappings['CTR'], 'ctr')

    def test_detect_columns_case_insensitive(self):
        """Header matching ignores case differences."""
        from .column_registry import detect_columns

        headers = ['IMPRESSIONS', 'AMOUNT SPENT', 'cpc', 'campaign_name']
        result = detect_columns(headers)

        self.assertIn(result.source, ('rule', 'db_template'))
        self.assertEqual(result.mappings['IMPRESSIONS'], 'impressions')
        self.assertEqual(result.mappings['AMOUNT SPENT'], 'amount_spent')
        self.assertEqual(result.mappings['cpc'], 'cpc')

    def test_detect_columns_alias_variants(self):
        """Alias variants map to the same canonical name."""
        from .column_registry import detect_columns

        # 'spend' is an alias for 'amount_spent'
        headers = ['Campaign name', 'spend', 'Reach', 'Purchases']
        result = detect_columns(headers)

        self.assertEqual(result.mappings['spend'], 'amount_spent')
        self.assertEqual(result.mappings['Reach'], 'reach')
        self.assertEqual(result.mappings['Purchases'], 'purchases')

    def test_detect_columns_unrecognized_labeled_unknown(self):
        """Headers that do not match any alias are labeled 'unknown'."""
        from .column_registry import detect_columns

        headers = ['Campaign name', 'Amount spent', 'My Custom Metric']
        result = detect_columns(headers)

        self.assertEqual(result.mappings['My Custom Metric'], 'unknown')
        self.assertIn('My Custom Metric', result.unrecognized)

    def test_detect_columns_empty_headers(self):
        """Empty header list returns an unknown result without error."""
        from .column_registry import detect_columns

        result = detect_columns([])

        self.assertIsNone(result.schema_key)
        self.assertEqual(result.confidence, 0.0)
        self.assertEqual(result.mappings, {})

    def test_detect_columns_below_threshold_falls_through(self):
        """Headers that match < 50% of a known schema fall through to LLM path."""
        from .column_registry import detect_columns, _try_rule_match

        # Only 1 out of 5 headers matches — confidence 0.2 < threshold 0.5
        headers = ['Campaign name', 'Revenue', 'Sessions', 'Bounce Rate', 'Goal Completions']
        result = _try_rule_match(headers)
        self.assertIsNone(result)

    def test_to_dict_serializable(self):
        """ColumnDetectionResult.to_dict() returns a plain dict."""
        from .column_registry import detect_columns

        headers = ['Campaign name', 'Amount spent']
        result = detect_columns(headers)
        d = result.to_dict()

        self.assertIsInstance(d, dict)
        self.assertIn('schema_key', d)
        self.assertIn('mappings', d)
        self.assertIn('confidence', d)
        self.assertIn('source', d)
        self.assertIn('unrecognized', d)

    # ------------------------------------------------------------------ #
    # Data normalization                                                  #
    # ------------------------------------------------------------------ #

    def test_normalize_spreadsheet_renames_columns(self):
        """normalize_spreadsheet renames columns and row keys according to mapping."""
        from .column_registry import normalize_spreadsheet

        data = {
            "name": "Test Report",
            "sheets": [{
                "name": "Sheet1",
                "columns": ["Campaign name", "Amount spent", "Impressions"],
                "rows": [
                    {"Campaign name": "Summer Sale", "Amount spent": 500.0, "Impressions": 10000},
                ],
            }],
        }
        mapping = {
            "Campaign name": "campaign_name",
            "Amount spent": "amount_spent",
            "Impressions": "impressions",
        }

        normalized = normalize_spreadsheet(data, mapping)

        sheet = normalized["sheets"][0]
        self.assertEqual(sheet["columns"], ["campaign_name", "amount_spent", "impressions"])
        row = sheet["rows"][0]
        self.assertIn("campaign_name", row)
        self.assertIn("amount_spent", row)
        self.assertEqual(row["campaign_name"], "Summer Sale")
        self.assertEqual(row["amount_spent"], 500.0)

    def test_normalize_spreadsheet_unknown_columns_keep_original_name(self):
        """Columns mapped to 'unknown' retain their original header name."""
        from .column_registry import normalize_spreadsheet

        data = {
            "name": "Test",
            "sheets": [{
                "name": "Sheet1",
                "columns": ["Campaign name", "My Custom Metric"],
                "rows": [{"Campaign name": "X", "My Custom Metric": 42}],
            }],
        }
        mapping = {"Campaign name": "campaign_name", "My Custom Metric": "unknown"}

        normalized = normalize_spreadsheet(data, mapping)
        sheet = normalized["sheets"][0]
        self.assertIn("campaign_name", sheet["columns"])
        self.assertIn("My Custom Metric", sheet["columns"])
        row = sheet["rows"][0]
        self.assertIn("My Custom Metric", row)

    def test_normalize_spreadsheet_empty_mapping_passthrough(self):
        """normalize_spreadsheet with no mapping returns data unchanged."""
        from .column_registry import normalize_spreadsheet

        data = {"name": "X", "sheets": [{"name": "S", "columns": ["A"], "rows": [{"A": 1}]}]}
        result = normalize_spreadsheet(data, {})
        self.assertEqual(result, data)

    # ------------------------------------------------------------------ #
    # Executor integration                                                #
    # ------------------------------------------------------------------ #

    def setUp(self):
        self.org = Organization.objects.create(name='Test Org CD', slug='test-org-cd')
        self.user = CustomUser.objects.create_user(
            email='cd@test.com',
            username='cduser',
            password='testpass123',
        )
        self.user.organization = self.org
        self.user.save()
        self.project = Project.objects.create(
            name='Test Project CD',
            organization=self.org,
            owner=self.user,
        )
        self.session = AgentSession.objects.create(
            user=self.user,
            project=self.project,
        )
        self.workflow = AgentWorkflowDefinition.objects.create(
            name='Column Detection Workflow',
            is_default=False,
            is_system=False,
            status='active',
        )
        AgentWorkflowStep.objects.create(
            workflow=self.workflow,
            name='Detect Columns',
            step_type='detect_columns',
            order=1,
        )
        AgentWorkflowStep.objects.create(
            workflow=self.workflow,
            name='Await Column Confirmation',
            step_type='await_confirmation',
            order=2,
            config={'message': 'Please confirm or correct the detected columns.'},
        )
        AgentWorkflowStep.objects.create(
            workflow=self.workflow,
            name='Normalize Data',
            step_type='normalize_data',
            order=3,
        )
        self.orchestrator = AgentOrchestrator(self.user, self.project, self.session)

    def test_detect_columns_executor_emits_column_mapping_event(self):
        """DetectColumnsExecutor emits a column_mapping SSE event with detection data."""
        from .executors import DetectColumnsExecutor

        run = AgentWorkflowRun.objects.create(
            session=self.session,
            workflow_definition=self.workflow,
            status='analyzing',
        )
        step = self.workflow.steps.get(order=1)
        executor = DetectColumnsExecutor(step, run, self.orchestrator)

        input_data = {
            'spreadsheet_data': {
                'name': 'Meta Report',
                'sheets': [{
                    'name': 'Sheet1',
                    'columns': ['Campaign name', 'Amount spent', 'Impressions'],
                    'rows': [{'Campaign name': 'Test', 'Amount spent': 100, 'Impressions': 500}],
                }],
            }
        }
        result = executor.execute(input_data)

        self.assertTrue(result.success)
        self.assertEqual(len(result.sse_events), 1)
        self.assertEqual(result.sse_events[0]['type'], 'column_mapping')
        self.assertIn('column_mapping', result.output_data)
        self.assertIn('column_detection', result.output_data)

    def test_normalize_data_executor_renames_columns(self):
        """NormalizeDataExecutor renames columns using column_mapping from input."""
        from .executors import NormalizeDataExecutor

        run = AgentWorkflowRun.objects.create(
            session=self.session,
            workflow_definition=self.workflow,
            status='analyzing',
        )
        step = self.workflow.steps.get(order=3)
        executor = NormalizeDataExecutor(step, run, self.orchestrator)

        input_data = {
            'spreadsheet_data': {
                'name': 'Report',
                'sheets': [{
                    'name': 'Sheet1',
                    'columns': ['Campaign name', 'Amount spent'],
                    'rows': [{'Campaign name': 'X', 'Amount spent': 100}],
                }],
            },
            'column_mapping': {
                'Campaign name': 'campaign_name',
                'Amount spent': 'amount_spent',
            },
        }
        result = executor.execute(input_data)

        self.assertTrue(result.success)
        sheet = result.output_data['spreadsheet_data']['sheets'][0]
        self.assertIn('campaign_name', sheet['columns'])
        self.assertIn('amount_spent', sheet['columns'])

    def test_confirm_columns_action_resumes_workflow_with_mapping(self):
        """confirm_columns action resumes the paused workflow with the user's mapping."""
        run = AgentWorkflowRun.objects.create(
            session=self.session,
            workflow_definition=self.workflow,
            status='awaiting_confirmation',
            current_step_order=3,
        )
        # Simulate the last completed step (detect_columns at order=1)
        step1 = self.workflow.steps.get(order=1)
        AgentStepExecution.objects.create(
            workflow_run=run,
            step=step1,
            step_order=1,
            step_name='Detect Columns',
            status='completed',
            output_data={
                'spreadsheet_data': {
                    'name': 'Report',
                    'sheets': [{
                        'name': 'Sheet1',
                        'columns': ['Campaign name', 'Amount spent'],
                        'rows': [{'Campaign name': 'Y', 'Amount spent': 200}],
                    }],
                },
                'column_mapping': {'Campaign name': 'campaign_name', 'Amount spent': 'amount_spent'},
            },
        )

        user_mapping = {'Campaign name': 'campaign_name', 'Amount spent': 'spend_custom'}
        chunks = list(self.orchestrator.handle_message(
            '',
            action='confirm_columns',
            column_mapping=user_mapping,
        ))

        types = [c.get('type') for c in chunks]
        self.assertIn('done', types)
        # The normalize step should have emitted a text event
        self.assertIn('text', types)
