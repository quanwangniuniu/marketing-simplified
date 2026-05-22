from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from core.models import Organization, Project, ProjectMember
from task.status_report import generate_status_report


User = get_user_model()


class StatusReportAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='member@example.com',
            username='member',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Test Organization')
        self.project = Project.objects.create(
            name='Accessible Project',
            organization=self.organization,
        )
        self.other_project = Project.objects.create(
            name='Hidden Project',
            organization=self.organization,
        )
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role='member',
            is_active=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_status_report_rejects_projects_without_membership(self):
        response = self.client.get(
            reverse('task-status-report'),
            {'project_id': self.other_project.id},
        )

        self.assertEqual(response.status_code, 404)

    def test_status_report_rejects_invalid_project_id(self):
        response = self.client.get(
            reverse('task-status-report'),
            {'project_id': 'not-a-number'},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'Invalid project_id')

    def test_status_report_allows_active_project_members(self):
        payload = {
            'period': {'start': '2026-01-01', 'end': '2026-01-07'},
            'completed_work': [],
            'in_progress': [],
            'blockers': [],
            'risks': [],
            'key_decisions': [],
            'next_steps': [],
            'velocity': {
                'current_week': 0,
                'avg_4wk': 0,
                'trend': 'stable',
                'remaining_count': 0,
                'projected_weeks': None,
                'projected_completion': None,
                'weekly_data': [],
            },
        }

        with patch('task.status_report.generate_status_report', return_value=payload) as mock_generate:
            response = self.client.get(
                reverse('task-status-report'),
                {'project_id': self.project.id},
            )

        self.assertEqual(response.status_code, 200)
        mock_generate.assert_called_once()
        self.assertEqual(mock_generate.call_args.args[0], self.project.id)


class StatusReportVelocityTest(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name='Test Organization')
        self.project = Project.objects.create(
            name='Velocity Project',
            organization=self.organization,
        )

    def test_velocity_fills_missing_weeks_before_calculating_current_week(self):
        today = date.today()
        current_week_start = today - timedelta(days=today.weekday())
        previous_week_start = current_week_start - timedelta(weeks=1)

        with patch(
            'task.status_report.velocity_trend',
            return_value=[{'week': previous_week_start.isoformat(), 'count': 4}],
        ):
            report = generate_status_report(
                self.project.id,
                today - timedelta(days=7),
                today,
            )

        velocity = report['velocity']
        self.assertEqual(velocity['weekly_data'][-1], {
            'week': current_week_start.isoformat(),
            'count': 0,
        })
        self.assertEqual(velocity['weekly_data'][-2], {
            'week': previous_week_start.isoformat(),
            'count': 4,
        })
        self.assertEqual(velocity['current_week'], 0)
        self.assertEqual(velocity['avg_4wk'], 1.0)
