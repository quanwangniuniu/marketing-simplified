"""
Tests for budget_approval/services.py
Covers: BudgetRequestService and BudgetPoolService

Uses only safe fixtures (no tenant_schema, user_role*, role_permissions)
to avoid the tenant-schema FK teardown issue.
"""
import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.core.exceptions import ValidationError

from budget_approval.models import BudgetPool, BudgetRequest, BudgetRequestStatus
from budget_approval.services import BudgetRequestService, BudgetPoolService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _force_status(budget_request, new_status):
    """Bypass FSMField(protected=True) and set status directly in DB."""
    BudgetRequest.objects.filter(pk=budget_request.pk).update(status=new_status)
    budget_request.__dict__['status'] = new_status
    return budget_request


# ---------------------------------------------------------------------------
# BudgetRequestService.create_budget_request
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCreateBudgetRequest:

    def test_creates_draft_budget_request(self, user1, task, budget_pool, user2, ad_channel):
        data = {
            'task': task,
            'requested_by': user1,
            'amount': Decimal('500.00'),
            'currency': 'AUD',
            'budget_pool': budget_pool,
            'current_approver': user2,
            'ad_channel': ad_channel,
            'notes': 'Created via service',
        }
        br = BudgetRequestService.create_budget_request(data)
        assert br.pk is not None
        assert br.status == BudgetRequestStatus.DRAFT
        assert br.amount == Decimal('500.00')
        assert br.currency == 'AUD'

    def test_missing_budget_pool_key_raises(self, user1, task, user2, ad_channel):
        data = {
            'task': task,
            'requested_by': user1,
            'amount': Decimal('500.00'),
            'currency': 'AUD',
            'current_approver': user2,
            'ad_channel': ad_channel,
        }
        with pytest.raises(ValidationError, match="budget_pool is required"):
            BudgetRequestService.create_budget_request(data)

    def test_missing_ad_channel_key_raises(self, user1, task, budget_pool, user2):
        data = {
            'task': task,
            'requested_by': user1,
            'amount': Decimal('500.00'),
            'currency': 'AUD',
            'budget_pool': budget_pool,
            'current_approver': user2,
        }
        with pytest.raises(ValidationError, match="ad_channel is required"):
            BudgetRequestService.create_budget_request(data)

    def test_budget_pool_not_instance_raises(self, user1, task, budget_pool, user2, ad_channel):
        data = {
            'task': task,
            'requested_by': user1,
            'amount': Decimal('500.00'),
            'currency': 'AUD',
            'budget_pool': budget_pool.pk,   # ID, not instance
            'current_approver': user2,
            'ad_channel': ad_channel,
        }
        with pytest.raises(ValidationError, match="budget_pool must be a BudgetPool instance"):
            BudgetRequestService.create_budget_request(data)

    def test_ad_channel_not_instance_raises(self, user1, task, budget_pool, user2, ad_channel):
        data = {
            'task': task,
            'requested_by': user1,
            'amount': Decimal('500.00'),
            'currency': 'AUD',
            'budget_pool': budget_pool,
            'current_approver': user2,
            'ad_channel': ad_channel.pk,    # ID, not instance
        }
        with pytest.raises(ValidationError, match="ad_channel must be an AdChannel instance"):
            BudgetRequestService.create_budget_request(data)


# ---------------------------------------------------------------------------
# BudgetRequestService.check_budget_availability
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCheckBudgetAvailability:

    def test_returns_true_when_sufficient(self, budget_pool):
        # pool has 10000 total, 0 used → 10000 available
        assert BudgetRequestService.check_budget_availability(budget_pool, Decimal('5000.00')) is True

    def test_returns_true_for_exact_amount(self, budget_pool):
        assert BudgetRequestService.check_budget_availability(budget_pool, Decimal('10000.00')) is True

    def test_returns_false_when_insufficient(self, budget_pool):
        assert BudgetRequestService.check_budget_availability(budget_pool, Decimal('10000.01')) is False

    def test_returns_false_when_pool_fully_used(self, budget_pool):
        budget_pool.used_amount = Decimal('10000.00')
        budget_pool.save()
        assert BudgetRequestService.check_budget_availability(budget_pool, Decimal('1.00')) is False


# ---------------------------------------------------------------------------
# BudgetRequestService.check_escalation_rules
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCheckEscalationRules:

    def test_returns_false_when_no_rules(self, budget_request_draft):
        # No BudgetEscalationRule rows exist
        result = BudgetRequestService.check_escalation_rules(budget_request_draft)
        assert result is False

    def test_returns_true_when_amount_exceeds_threshold(
        self, budget_pool, budget_request_draft
    ):
        from budget_approval.models import BudgetEscalationRule
        from access_control.models import Role

        role = Role.objects.create(
            name="Escalation Role",
            organization=budget_pool.project.organization,
            level=10,
        )
        BudgetEscalationRule.objects.create(
            budget_pool=budget_pool,
            threshold_amount=Decimal('500.00'),   # request is 1000 > 500
            threshold_currency='AUD',
            escalate_to_role=role,
            is_active=True,
        )
        result = BudgetRequestService.check_escalation_rules(budget_request_draft)
        assert result is True

    def test_returns_false_when_amount_below_threshold(
        self, budget_pool, budget_request_draft
    ):
        from budget_approval.models import BudgetEscalationRule
        from access_control.models import Role

        role = Role.objects.create(
            name="Escalation Role 2",
            organization=budget_pool.project.organization,
            level=10,
        )
        BudgetEscalationRule.objects.create(
            budget_pool=budget_pool,
            threshold_amount=Decimal('5000.00'),   # request is 1000 < 5000
            threshold_currency='AUD',
            escalate_to_role=role,
            is_active=True,
        )
        result = BudgetRequestService.check_escalation_rules(budget_request_draft)
        assert result is False

    def test_returns_false_for_inactive_rule(
        self, budget_pool, budget_request_draft
    ):
        from budget_approval.models import BudgetEscalationRule
        from access_control.models import Role

        role = Role.objects.create(
            name="Escalation Role 3",
            organization=budget_pool.project.organization,
            level=10,
        )
        BudgetEscalationRule.objects.create(
            budget_pool=budget_pool,
            threshold_amount=Decimal('500.00'),
            threshold_currency='AUD',
            escalate_to_role=role,
            is_active=False,   # inactive
        )
        result = BudgetRequestService.check_escalation_rules(budget_request_draft)
        assert result is False


# ---------------------------------------------------------------------------
# BudgetRequestService.submit_budget_request
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSubmitBudgetRequest:

    def test_submit_transitions_to_submitted(self, budget_request_draft, user2):
        with patch('budget_approval.services.budget_notifications') as mock_notif:
            br = BudgetRequestService.submit_budget_request(budget_request_draft, user2)
        assert br.status == BudgetRequestStatus.SUBMITTED
        assert br.current_approver == user2
        assert br.submitted_at is not None
        mock_notif.notify_budget_submitted.assert_called_once()

    def test_submit_raises_when_not_draft(self, user2, budget_request_under_review):
        with pytest.raises(ValidationError, match="cannot be submitted"):
            BudgetRequestService.submit_budget_request(budget_request_under_review, user2)

    def test_submit_raises_when_insufficient_budget(self, user1, task, user2, ad_channel, project):
        # Create a pool with very small budget
        from core.models import AdChannel
        small_pool = BudgetPool.objects.create(
            project=project,
            ad_channel=ad_channel,
            total_amount=Decimal('10.00'),
            used_amount=Decimal('0.00'),
            currency='AUD',
        )
        br = BudgetRequest.objects.create(
            task=task,
            requested_by=user1,
            amount=Decimal('9999.00'),   # Much more than pool total
            currency='AUD',
            budget_pool=small_pool,
            current_approver=user2,
            ad_channel=ad_channel,
        )
        with pytest.raises(ValidationError, match="Insufficient budget"):
            BudgetRequestService.submit_budget_request(br, user2)


# ---------------------------------------------------------------------------
# BudgetRequestService.start_review
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestStartReview:

    def test_start_review_transitions_to_under_review(self, budget_request_submitted):
        with patch('budget_approval.services.budget_notifications'), \
             patch('budget_approval.services.trigger_escalation') as mock_trigger:
            mock_trigger.delay = MagicMock()
            br = BudgetRequestService.start_review(budget_request_submitted)
        assert br.status == BudgetRequestStatus.UNDER_REVIEW

    def test_start_review_raises_when_not_submitted(self, budget_request_draft):
        with pytest.raises(ValidationError, match="SUBMITTED status"):
            BudgetRequestService.start_review(budget_request_draft)

    def test_start_review_escalates_when_rule_matches(
        self, budget_pool, budget_request_submitted
    ):
        from budget_approval.models import BudgetEscalationRule
        from access_control.models import Role

        role = Role.objects.create(
            name="SR Escalation Role",
            organization=budget_pool.project.organization,
            level=10,
        )
        BudgetEscalationRule.objects.create(
            budget_pool=budget_pool,
            threshold_amount=Decimal('500.00'),   # request is 1000 > 500
            threshold_currency='AUD',
            escalate_to_role=role,
            is_active=True,
        )
        with patch('budget_approval.services.budget_notifications'), \
             patch('budget_approval.services.trigger_escalation') as mock_trigger:
            mock_trigger.delay = MagicMock()
            br = BudgetRequestService.start_review(budget_request_submitted)

        assert br.is_escalated is True
        mock_trigger.delay.assert_called_once_with(br.id)


# ---------------------------------------------------------------------------
# BudgetRequestService.process_approval
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProcessApproval:

    def test_approve_transitions_to_approved(self, budget_request_under_review, user2):
        with patch('budget_approval.services.budget_notifications') as mock_notif:
            result = BudgetRequestService.process_approval(
                budget_request_under_review, user2, is_approved=True, comment="Looks good"
            )
        assert result.status == BudgetRequestStatus.APPROVED
        mock_notif.notify_budget_approved.assert_called_once()

    def test_reject_transitions_to_rejected(self, budget_request_under_review, user2):
        with patch('budget_approval.services.budget_notifications') as mock_notif:
            result = BudgetRequestService.process_approval(
                budget_request_under_review, user2, is_approved=False, comment="Denied"
            )
        assert result.status == BudgetRequestStatus.REJECTED
        mock_notif.notify_budget_rejected.assert_called_once()

    def test_approve_with_next_approver_forwards(
        self, budget_request_under_review, user2, user3
    ):
        with patch('budget_approval.services.budget_notifications') as mock_notif:
            result = BudgetRequestService.process_approval(
                budget_request_under_review,
                user2,
                is_approved=True,
                comment="Forward",
                next_approver=user3,
            )
        assert result.status == BudgetRequestStatus.UNDER_REVIEW
        assert result.current_approver == user3
        mock_notif.notify_budget_forwarded.assert_called_once()

    def test_wrong_approver_raises(self, budget_request_under_review, user1):
        # user1 is requested_by, not current_approver (user2 is)
        with pytest.raises(ValidationError, match="Only the assigned approver"):
            BudgetRequestService.process_approval(
                budget_request_under_review, user1, is_approved=True, comment=""
            )

    def test_superuser_can_bypass_approver_check(self, budget_request_under_review, superuser):
        with patch('budget_approval.services.budget_notifications'):
            result = BudgetRequestService.process_approval(
                budget_request_under_review, superuser, is_approved=True, comment=""
            )
        assert result.status == BudgetRequestStatus.APPROVED

    def test_raises_when_not_under_review(self, budget_request_draft, user2):
        with pytest.raises(ValidationError, match="cannot be processed"):
            BudgetRequestService.process_approval(
                budget_request_draft, user2, is_approved=True, comment=""
            )


# ---------------------------------------------------------------------------
# BudgetRequestService.revise_rejected_request
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestReviseRejectedRequest:

    def test_revise_transitions_to_draft(self, budget_request_under_review, user2):
        # Manually move to REJECTED state
        br = budget_request_under_review
        _force_status(br, BudgetRequestStatus.REJECTED)

        revised = BudgetRequestService.revise_rejected_request(
            br, {'amount': Decimal('800.00'), 'notes': 'Revised notes'}
        )
        assert revised.status == BudgetRequestStatus.DRAFT
        assert revised.notes == 'Revised notes'

    def test_revise_raises_when_not_rejected(self, budget_request_draft):
        with pytest.raises(ValidationError, match="Only rejected or cancelled budget requests"):
            BudgetRequestService.revise_rejected_request(budget_request_draft, {})

    def test_revise_allowed_when_cancelled(self, budget_request_under_review):
        """A cancelled request can also be revised back to draft (guard mirrors the FSM)."""
        br = budget_request_under_review
        _force_status(br, BudgetRequestStatus.CANCELLED)

        revised = BudgetRequestService.revise_rejected_request(
            br, {'amount': Decimal('900.00')}
        )
        assert revised.status == BudgetRequestStatus.DRAFT
        assert revised.amount == Decimal('900.00')

    def test_revise_clears_stale_approver(self, budget_request_under_review, user2):
        """The rejecting approver must not stay assigned to the new draft."""
        br = budget_request_under_review
        _force_status(br, BudgetRequestStatus.REJECTED)
        assert br.current_approver == user2  # previous round's approver

        revised = BudgetRequestService.revise_rejected_request(br, {})

        assert revised.status == BudgetRequestStatus.DRAFT
        assert revised.current_approver is None
        persisted = BudgetRequest.objects.get(pk=br.pk)
        assert persisted.current_approver is None

    def test_stale_approver_cannot_process_revised_draft(self, budget_request_under_review, user2):
        """In the revise→resubmit window, the old approver holds no rights."""
        br = budget_request_under_review
        _force_status(br, BudgetRequestStatus.REJECTED)

        BudgetRequestService.revise_rejected_request(br, {})
        revised = BudgetRequest.objects.get(pk=br.pk)

        with pytest.raises(ValidationError):
            BudgetRequestService.process_approval(
                revised, user2, is_approved=True, comment="sneaky re-approve"
            )


# ---------------------------------------------------------------------------
# BudgetRequestService.lock_budget_request
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLockBudgetRequest:

    def test_lock_transitions_to_locked_and_deducts_pool(self, budget_request_under_review, user2, budget_pool):
        # Move to APPROVED first
        br = budget_request_under_review
        _force_status(br, BudgetRequestStatus.APPROVED)

        with patch('budget_approval.services.budget_notifications'):
            result = BudgetRequestService.lock_budget_request(br, actor_id=user2.id)

        assert result.status == BudgetRequestStatus.LOCKED
        budget_pool.refresh_from_db()
        assert budget_pool.used_amount == Decimal('1000.00')

    def test_lock_raises_when_not_approved(self, budget_request_draft):
        with pytest.raises(ValidationError, match="cannot be locked"):
            BudgetRequestService.lock_budget_request(budget_request_draft)

    def test_lock_raises_when_rejected(self, budget_request_under_review, budget_pool):
        """A REJECTED request must never reach LOCKED (governance bypass)."""
        br = budget_request_under_review
        _force_status(br, BudgetRequestStatus.REJECTED)

        with pytest.raises(ValidationError, match="cannot be locked"):
            BudgetRequestService.lock_budget_request(br)

        # Re-fetch instead of refresh_from_db(): FSMField(protected=True)
        # rejects direct attribute assignment during refresh.
        persisted = BudgetRequest.objects.get(pk=br.pk)
        assert persisted.status == BudgetRequestStatus.REJECTED
        budget_pool.refresh_from_db()
        assert budget_pool.used_amount == Decimal('0.00')

    def test_lock_raises_when_insufficient_budget(self, user1, task, user2, ad_channel, project):
        tight_pool = BudgetPool.objects.create(
            project=project,
            ad_channel=ad_channel,
            total_amount=Decimal('100.00'),
            used_amount=Decimal('0.00'),
            currency='AUD',
        )
        br = BudgetRequest.objects.create(
            task=task,
            requested_by=user1,
            amount=Decimal('500.00'),   # exceeds pool total
            currency='AUD',
            budget_pool=tight_pool,
            current_approver=user2,
            ad_channel=ad_channel,
        )
        _force_status(br, BudgetRequestStatus.APPROVED)

        with patch('budget_approval.services.budget_notifications'), \
             pytest.raises(ValidationError, match="Insufficient budget available for locking"):
            BudgetRequestService.lock_budget_request(br)


# ---------------------------------------------------------------------------
# BudgetRequestService.cancel_budget_request
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCancelBudgetRequest:

    def test_cancel_from_draft(self, budget_request_draft, user1):
        with patch('budget_approval.services.budget_notifications') as mock_notif:
            result = BudgetRequestService.cancel_budget_request(
                budget_request_draft, actor_id=user1.id
            )
        assert result.status == BudgetRequestStatus.CANCELLED
        mock_notif.notify_budget_cancelled.assert_called_once()

    def test_cancel_from_submitted(self, budget_request_submitted, user1):
        with patch('budget_approval.services.budget_notifications'):
            result = BudgetRequestService.cancel_budget_request(
                budget_request_submitted, actor_id=user1.id
            )
        assert result.status == BudgetRequestStatus.CANCELLED

    def test_cancel_from_under_review(self, budget_request_under_review, user1):
        with patch('budget_approval.services.budget_notifications'):
            result = BudgetRequestService.cancel_budget_request(
                budget_request_under_review, actor_id=user1.id
            )
        assert result.status == BudgetRequestStatus.CANCELLED

    def test_cancel_from_locked_reverses_pool_deduction(
        self, budget_request_under_review, user1, budget_pool
    ):
        br = budget_request_under_review
        # Simulate a locked request with pool already deducted
        budget_pool.used_amount = Decimal('1000.00')
        budget_pool.save()
        _force_status(br, BudgetRequestStatus.LOCKED)

        with patch('budget_approval.services.budget_notifications'):
            result = BudgetRequestService.cancel_budget_request(br, actor_id=user1.id)

        assert result.status == BudgetRequestStatus.CANCELLED
        budget_pool.refresh_from_db()
        # Lock cancellation reverses the deduction (handled inside cancel() method)
        assert budget_pool.used_amount == Decimal('0.00')


# ---------------------------------------------------------------------------
# BudgetPoolService.get_budget_pool_summary
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestGetBudgetPoolSummary:

    def test_summary_empty_pool(self, budget_pool):
        summary = BudgetPoolService.get_budget_pool_summary(budget_pool)
        assert summary['pool_id'] == budget_pool.id
        assert summary['total_amount'] == Decimal('10000.00')
        assert summary['used_amount'] == Decimal('0.00')
        assert summary['available_amount'] == Decimal('10000.00')
        assert summary['currency'] == 'AUD'
        stats = summary['statistics']
        assert stats['total_requests'] == 0
        assert stats['pending_requests'] == 0
        assert stats['approved_requests'] == 0
        assert stats['rejected_requests'] == 0
        assert stats['locked_requests'] == 0
        assert stats['total_requested_amount'] == 0

    def test_summary_with_requests(self, budget_request_draft, budget_request_under_review, budget_pool):
        # budget_request_draft is DRAFT (1000 AUD), budget_request_under_review is UNDER_REVIEW (1000 AUD)
        summary = BudgetPoolService.get_budget_pool_summary(budget_pool)
        stats = summary['statistics']
        assert stats['total_requests'] == 2
        assert stats['pending_requests'] == 1   # UNDER_REVIEW
        assert stats['approved_requests'] == 0
        assert stats['rejected_requests'] == 0
        # DRAFT + UNDER_REVIEW both count toward total_requested (not REJECTED)
        assert stats['total_requested_amount'] == Decimal('2000.00')

    def test_summary_counts_approved_and_rejected(
        self, user1, task, budget_pool, user2, ad_channel
    ):
        approved_br = BudgetRequest.objects.create(
            task=task, requested_by=user1, amount=Decimal('200.00'), currency='AUD',
            budget_pool=budget_pool, current_approver=user2, ad_channel=ad_channel,
        )
        _force_status(approved_br, BudgetRequestStatus.APPROVED)

        rejected_br = BudgetRequest.objects.create(
            task=task, requested_by=user1, amount=Decimal('300.00'), currency='AUD',
            budget_pool=budget_pool, current_approver=user2, ad_channel=ad_channel,
        )
        _force_status(rejected_br, BudgetRequestStatus.REJECTED)

        locked_br = BudgetRequest.objects.create(
            task=task, requested_by=user1, amount=Decimal('400.00'), currency='AUD',
            budget_pool=budget_pool, current_approver=user2, ad_channel=ad_channel,
        )
        _force_status(locked_br, BudgetRequestStatus.LOCKED)

        summary = BudgetPoolService.get_budget_pool_summary(budget_pool)
        stats = summary['statistics']
        assert stats['approved_requests'] == 1
        assert stats['rejected_requests'] == 1
        assert stats['locked_requests'] == 1
        # REJECTED is excluded from total_requested_amount
        assert stats['total_requested_amount'] == Decimal('600.00')  # 200 + 400 (no rejected 300)
