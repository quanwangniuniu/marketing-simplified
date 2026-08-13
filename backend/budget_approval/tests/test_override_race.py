"""
MED-240: org-admin override vs chain approver must serialize on one step.

Two actors clicking approve at once must not let the loser stamp the *next*
chain step. PostgreSQL SELECT FOR UPDATE is required; skipped on SQLite.
"""
import threading

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import connection, connections
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from budget_approval.exceptions import ApprovalConflict
from budget_approval.models import BudgetRequest, BudgetRequestStatus
from budget_approval.services import BudgetRequestService
from core.services.tenant import slug_to_schema_name
from task.models import ApprovalChain, ApprovalChainStep, Task

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.skipif(
        connection.vendor != 'postgresql',
        reason='select_for_update row locking requires PostgreSQL (no-op on SQLite).',
    ),
]


def _set_tenant_search_path(user):
    schema = slug_to_schema_name(user.organization.slug)
    with connection.cursor() as cursor:
        cursor.execute(f'SET search_path TO {schema}, public')


def _attach_two_step_chain(budget_request, project, user2, user3):
    task = budget_request.task
    chain = ApprovalChain.objects.create(
        name='Step1 → Step2',
        project=project,
        task_type='budget',
    )
    ApprovalChainStep.objects.create(chain=chain, order=1, approver=user2)
    ApprovalChainStep.objects.create(chain=chain, order=2, approver=user3)
    task.approval_chain = chain
    task.current_approval_step = 1
    task.current_approver = user2
    task.save(
        update_fields=['approval_chain', 'current_approval_step', 'current_approver']
    )
    return task


class TestOrgAdminOverrideRace:
    """Org-admin and the assigned approver must not both win the same step."""

    def test_concurrent_org_admin_and_approver_one_winner(
        self, budget_request_under_review, org_admin, user2
    ):
        """Same step, no chain advance: one 200-equivalent, one ApprovalConflict."""
        request_id = budget_request_under_review.id
        barrier = threading.Barrier(2)
        outcomes = []
        lock = threading.Lock()

        def _run(user_id, is_approved):
            try:
                User = get_user_model()
                user = User.objects.get(id=user_id)
                _set_tenant_search_path(user)
                barrier.wait(timeout=5)
                br = BudgetRequest.objects.get(id=request_id)
                with patch('budget_approval.services.budget_notifications'):
                    BudgetRequestService.process_approval(
                        budget_request=br,
                        approver=user,
                        is_approved=is_approved,
                        comment=f'race from {user_id}',
                    )
                with lock:
                    outcomes.append(('ok', user_id))
            except ApprovalConflict:
                with lock:
                    outcomes.append(('conflict', user_id))
            except Exception as exc:
                with lock:
                    outcomes.append(('error', f'{user_id}:{exc}'))
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=_run, args=(org_admin.id, True)),
            threading.Thread(target=_run, args=(user2.id, False)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=15)

        kinds = [k for k, _ in outcomes]
        assert kinds.count('ok') == 1, outcomes
        assert kinds.count('conflict') == 1, outcomes
        assert 'error' not in kinds, outcomes

        final = BudgetRequest.objects.get(id=request_id)
        assert final.status in (
            BudgetRequestStatus.APPROVED,
            BudgetRequestStatus.REJECTED,
        )

    def test_concurrent_override_does_not_let_step1_stamp_step2(
        self, budget_request_under_review, org_admin, user2, user3, project
    ):
        """Override advances to step 2; late step-1 approver must not approve step 2."""
        _attach_two_step_chain(budget_request_under_review, project, user2, user3)
        request_id = budget_request_under_review.id
        barrier = threading.Barrier(2)
        outcomes = []
        lock = threading.Lock()

        def _run(user_id):
            try:
                User = get_user_model()
                user = User.objects.get(id=user_id)
                _set_tenant_search_path(user)
                barrier.wait(timeout=5)
                br = BudgetRequest.objects.get(id=request_id)
                with patch('budget_approval.services.budget_notifications'):
                    BudgetRequestService.process_approval(
                        budget_request=br,
                        approver=user,
                        is_approved=True,
                        comment=f'race from {user_id}',
                    )
                with lock:
                    outcomes.append(('ok', user_id))
            except ApprovalConflict:
                with lock:
                    outcomes.append(('conflict', user_id))
            except Exception as exc:
                with lock:
                    outcomes.append(('error', f'{user_id}:{exc}'))
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=_run, args=(org_admin.id,)),
            threading.Thread(target=_run, args=(user2.id,)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=15)

        kinds = [k for k, _ in outcomes]
        assert kinds.count('ok') == 1, outcomes
        assert kinds.count('conflict') == 1, outcomes
        assert 'error' not in kinds, outcomes

        final = BudgetRequest.objects.get(id=request_id)
        winner_id = next(uid for kind, uid in outcomes if kind == 'ok')
        if winner_id == org_admin.id:
            # Admin replaced step 1 and forwarded — step 2 still belongs to user3.
            assert final.status == BudgetRequestStatus.UNDER_REVIEW
            assert final.current_approver_id == user3.id
        else:
            # Chain approver won step 1 (no auto-forward without next_approver).
            assert final.status == BudgetRequestStatus.APPROVED
            assert final.current_approver_id == user2.id

        task_row = Task.objects.filter(pk=budget_request_under_review.task_id).values(
            'current_approver_id', 'current_approval_step'
        ).get()
        if winner_id == org_admin.id:
            assert task_row['current_approver_id'] == user3.id
            assert task_row['current_approval_step'] == 2

    def test_decision_api_org_admin_vs_approver_returns_409(
        self, budget_request_under_review, org_admin, user2, team, user_role2, role_permissions
    ):
        """HTTP: concurrent PATCH decision → one 200, one 409."""
        url = reverse(
            'budget-request-decision',
            kwargs={'pk': budget_request_under_review.id},
        )
        barrier = threading.Barrier(2)
        results = [None, None]

        def _patch(index, user, role):
            try:
                _set_tenant_search_path(user)
                barrier.wait(timeout=5)
                client = APIClient()
                client.force_authenticate(user=user)
                client.credentials(
                    HTTP_X_USER_ROLE=role,
                    HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
                    HTTP_X_TEAM_ID=str(team.id),
                )
                response = client.patch(
                    url,
                    {'decision': 'approve', 'comment': f'from {user.id}'},
                    format='json',
                )
                results[index] = response.status_code
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=_patch, args=(0, org_admin, 'org_admin')),
            threading.Thread(target=_patch, args=(1, user2, 'team_leader')),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=15)

        assert status.HTTP_200_OK in results, results
        assert status.HTTP_409_CONFLICT in results, results
