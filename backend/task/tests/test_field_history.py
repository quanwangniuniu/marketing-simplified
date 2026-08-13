from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Organization, Project, ProjectMember
from task.models import Task, TaskFieldHistory
from task.signals import set_current_user


User = get_user_model()


class TaskFieldHistoryConcurrentWriteTests(TestCase):
    def setUp(self):
        set_current_user(None)
        self.addCleanup(set_current_user, None)

        self.writer_a = User.objects.create_user(
            email='history-writer-a@example.com',
            username='history-writer-a',
            password='testpass123',
        )
        self.writer_b = User.objects.create_user(
            email='history-writer-b@example.com',
            username='history-writer-b',
            password='testpass123',
        )
        self.organization = Organization.objects.create(
            name='History Concurrent Write Org',
        )
        self.project = Project.objects.create(
            name='History Concurrent Write Project',
            organization=self.organization,
        )
        self.task = Task.objects.create(
            summary='Original summary',
            type='execution',
            project=self.project,
            owner=self.writer_a,
        )
        ProjectMember.objects.create(
            user=self.writer_a,
            project=self.project,
            role='Team Leader',
            is_active=True,
        )

    def test_two_writers_in_same_transaction_append_both_transitions(self):
        with transaction.atomic():
            writer_a_task = Task.objects.get(pk=self.task.pk)
            writer_b_task = Task.objects.get(pk=self.task.pk)

            set_current_user(self.writer_a)
            writer_a_task.summary = 'Writer A summary'
            writer_a_task.save(update_fields=['summary'])

            set_current_user(self.writer_b)
            writer_b_task.summary = 'Writer B summary'
            writer_b_task.save(update_fields=['summary'])

        rows = list(
            TaskFieldHistory.objects
            .filter(task=self.task, field_name='summary')
            .order_by('changed_at', 'id')
        )

        self.assertEqual(len(rows), 2)

        self.assertEqual(
            (rows[0].old_value, rows[0].new_value),
            ('Original summary', 'Writer A summary'),
        )
        self.assertEqual(
            (rows[1].old_value, rows[1].new_value),
            ('Writer A summary', 'Writer B summary'),
        )

        self.assertEqual(rows[0].changed_by_id, self.writer_a.id)
        self.assertEqual(rows[1].changed_by_id, self.writer_b.id)
        self.assertLess(rows[0].changed_at, rows[1].changed_at)

        saved_task = Task.objects.get(pk=self.task.pk)
        self.assertEqual(saved_task.summary, 'Writer B summary')

    def test_same_target_writes_are_both_recorded(self):
        with transaction.atomic():
            writer_a_task = Task.objects.get(pk=self.task.pk)
            writer_b_task = Task.objects.get(pk=self.task.pk)

            set_current_user(self.writer_a)
            writer_a_task.summary = 'Shared summary'
            writer_a_task.save(update_fields=['summary'])

            set_current_user(self.writer_b)
            writer_b_task.summary = 'Shared summary'
            writer_b_task.save(update_fields=['summary'])

        rows = list(
            TaskFieldHistory.objects
            .filter(task=self.task, field_name='summary')
            .order_by('changed_at', 'id')
        )

        self.assertEqual(len(rows), 2)
        self.assertEqual(
            (rows[0].old_value, rows[0].new_value),
            ('Original summary', 'Shared summary'),
        )
        self.assertEqual(
            (rows[1].old_value, rows[1].new_value),
            ('Shared summary', 'Shared summary'),
        )
        self.assertEqual(rows[0].changed_by_id, self.writer_a.id)
        self.assertEqual(rows[1].changed_by_id, self.writer_b.id)
        self.assertLess(rows[0].changed_at, rows[1].changed_at)

    def test_patch_echoes_operation_id_and_records_explicit_noop(self):
        client = APIClient()
        client.force_authenticate(user=self.writer_a)

        operation_id = 'med237-operation-1'
        url = reverse(
            'task-detail',
            kwargs={'pk': self.task.slug},
        )

        response = client.patch(
            f'{url}?operation_id={operation_id}',
            {'summary': 'Original summary'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['operation_id'], operation_id)

        row = TaskFieldHistory.objects.get(
            task=self.task,
            field_name='summary',
        )

        self.assertEqual(row.old_value, 'Original summary')
        self.assertEqual(row.new_value, 'Original summary')
        self.assertEqual(row.changed_by_id, self.writer_a.id)