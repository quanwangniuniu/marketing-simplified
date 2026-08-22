import itertools

import pytest
from django.utils import timezone
from django_fsm import TransitionNotAllowed, can_proceed
from freezegun import freeze_time
from budget_approval.models import BudgetRequest, BudgetRequestStatus


def _force_status(budget_request, new_status):
    """Bypass FSMField(protected=True) and set status directly in DB."""
    BudgetRequest.objects.filter(pk=budget_request.pk).update(status=new_status)
    budget_request.__dict__['status'] = new_status
    return budget_request


ALL_STATUSES = [
    BudgetRequestStatus.DRAFT,
    BudgetRequestStatus.SUBMITTED,
    BudgetRequestStatus.UNDER_REVIEW,
    BudgetRequestStatus.APPROVED,
    BudgetRequestStatus.REJECTED,
    BudgetRequestStatus.LOCKED,
    BudgetRequestStatus.CANCELLED,
]

# The complete FSM graph: every transition and its legal source states.
# Governance invariant: APPROVED is reachable only from UNDER_REVIEW, and a
# REJECTED request must go back through DRAFT (revise) to ever be approved.
LEGAL_SOURCES = {
    'submit': {BudgetRequestStatus.DRAFT},
    'send_for_review': {BudgetRequestStatus.SUBMITTED},
    'approve': {BudgetRequestStatus.UNDER_REVIEW},
    'reject': {BudgetRequestStatus.UNDER_REVIEW},
    'lock': {BudgetRequestStatus.APPROVED},
    'revise': {BudgetRequestStatus.REJECTED, BudgetRequestStatus.CANCELLED},
    'forward_to_next': {BudgetRequestStatus.APPROVED},
    'cancel': {
        BudgetRequestStatus.DRAFT,
        BudgetRequestStatus.SUBMITTED,
        BudgetRequestStatus.UNDER_REVIEW,
        BudgetRequestStatus.APPROVED,
        BudgetRequestStatus.REJECTED,
        BudgetRequestStatus.LOCKED,
    },
}

@pytest.mark.django_db
@pytest.mark.timeout(600)
class TestBudgetRequestFSM:
    """Test BudgetRequest FSM transitions"""
    
    def test_draft_to_submitted_transition(self, budget_request_draft):
        """Test DRAFT -> SUBMITTED transition"""
        assert budget_request_draft.status == BudgetRequestStatus.DRAFT
        assert budget_request_draft.can_submit() is True
        
        budget_request_draft.submit()
        assert budget_request_draft.status == BudgetRequestStatus.SUBMITTED
        assert budget_request_draft.submitted_at is not None
    
    def test_submitted_to_under_review_transition(self, budget_request_submitted):
        """Test SUBMITTED -> UNDER_REVIEW transition"""
        assert budget_request_submitted.status == BudgetRequestStatus.SUBMITTED
        assert budget_request_submitted.can_approve() is False
        
        budget_request_submitted.send_for_review()
        assert budget_request_submitted.status == BudgetRequestStatus.UNDER_REVIEW
        assert budget_request_submitted.can_approve() is True
    
    def test_under_review_to_approved_transition(self, budget_request_under_review):
        """Test UNDER_REVIEW -> APPROVED transition"""
        assert budget_request_under_review.status == BudgetRequestStatus.UNDER_REVIEW
        assert budget_request_under_review.can_approve() is True
        
        budget_request_under_review.approve()
        assert budget_request_under_review.status == BudgetRequestStatus.APPROVED
    
    def test_under_review_to_rejected_transition(self, budget_request_under_review):
        """Test UNDER_REVIEW -> REJECTED transition"""
        assert budget_request_under_review.status == BudgetRequestStatus.UNDER_REVIEW
        assert budget_request_under_review.can_reject() is True
        
        budget_request_under_review.reject()
        assert budget_request_under_review.status == BudgetRequestStatus.REJECTED
    
    def test_approved_to_locked_transition(self, budget_request_under_review, budget_pool):
        """Test APPROVED -> LOCKED transition with budget deduction"""
        # First approve the request
        budget_request_under_review.approve()
        assert budget_request_under_review.status == BudgetRequestStatus.APPROVED
        
        # Check initial budget pool state
        initial_used = budget_pool.used_amount
        request_amount = budget_request_under_review.amount
        
        # Lock the request
        budget_request_under_review.lock()
        assert budget_request_under_review.status == BudgetRequestStatus.LOCKED
        
        # Verify budget pool was updated
        budget_pool.refresh_from_db()
        assert budget_pool.used_amount == initial_used + request_amount
    
    def test_rejected_to_draft_transition(self, budget_request_under_review):
        """Test REJECTED -> DRAFT transition (revision)"""
        # First reject the request
        budget_request_under_review.reject()
        assert budget_request_under_review.status == BudgetRequestStatus.REJECTED
        assert budget_request_under_review.can_revise() is True
        
        # Revise the request
        budget_request_under_review.revise()
        assert budget_request_under_review.status == BudgetRequestStatus.DRAFT
    
    def test_approved_to_under_review_transition(self, budget_request_under_review):
        """Test APPROVED -> UNDER_REVIEW transition (forward to next approver)"""
        # First approve the request
        budget_request_under_review.approve()
        assert budget_request_under_review.status == BudgetRequestStatus.APPROVED
        assert budget_request_under_review.can_forward() is True
        
        # Forward to next approver
        budget_request_under_review.forward_to_next()
        assert budget_request_under_review.status == BudgetRequestStatus.UNDER_REVIEW
    
    def test_invalid_transitions(self, budget_request_draft):
        """Test invalid FSM transitions"""
        # Cannot approve from DRAFT
        assert budget_request_draft.can_approve() is False
        
        # Cannot reject from DRAFT
        assert budget_request_draft.can_reject() is False
        
        # Cannot lock from DRAFT
        assert budget_request_draft.can_lock() is False
    
    @freeze_time("2024-01-01 10:00:00")
    def test_submit_sets_timestamp(self, budget_request_draft):
        """Test that submit() sets the submitted_at timestamp"""
        assert budget_request_draft.submitted_at is None

        budget_request_draft.submit()
        assert budget_request_draft.submitted_at == timezone.now()


@pytest.mark.django_db
@pytest.mark.timeout(600)
class TestFSMSourceStateMatrix:
    """Pin the complete FSM graph: every (state, transition) pair.

    MED-238 acceptance criterion — in particular, no path may take a
    REJECTED request to APPROVED or LOCKED without passing through DRAFT.
    """

    @pytest.mark.parametrize(
        "source_status,transition_name",
        list(itertools.product(ALL_STATUSES, sorted(LEGAL_SOURCES))),
    )
    def test_transition_legality(self, budget_request_draft, source_status, transition_name):
        br = _force_status(budget_request_draft, source_status)
        transition_method = getattr(br, transition_name)
        is_legal = source_status in LEGAL_SOURCES[transition_name]

        assert can_proceed(transition_method) is is_legal

        if not is_legal:
            with pytest.raises(TransitionNotAllowed):
                transition_method()

    def test_rejected_cannot_be_approved_directly(self, budget_request_draft):
        """The headline governance rule: rejected → approved does not exist."""
        br = _force_status(budget_request_draft, BudgetRequestStatus.REJECTED)

        assert br.can_approve() is False
        assert br.can_lock() is False
        with pytest.raises(TransitionNotAllowed):
            br.approve()
        with pytest.raises(TransitionNotAllowed):
            br.lock()

    def test_revise_clears_stale_approver(self, budget_request_draft):
        """REJECTED → DRAFT resets the approver along with the state."""
        br = _force_status(budget_request_draft, BudgetRequestStatus.REJECTED)
        assert br.current_approver is not None

        br.revise()

        assert br.status == BudgetRequestStatus.DRAFT
        assert br.current_approver is None