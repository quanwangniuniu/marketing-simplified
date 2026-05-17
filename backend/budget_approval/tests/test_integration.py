import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.utils import timezone

from budget_approval.models import BudgetRequestStatus, BudgetRequest
from task.models import ApprovalRecord
from budget_approval.services import BudgetRequestService, BudgetPoolService

@pytest.mark.django_db
class TestThreeUserApprovalChain:
    """Test 3-user approval chain integration"""
    
    def test_three_user_approval_chain(self, user1, user2, user3, task, budget_pool, ad_channel):
        """Test complete 3-user approval chain"""
        # Create budget request
        budget_request = BudgetRequest.objects.create(
            task=task,
            requested_by=user1,
            amount=Decimal('5000.00'),
            currency='AUD',
            status=BudgetRequestStatus.DRAFT,
            budget_pool=budget_pool,
            current_approver=user2,
            ad_channel=ad_channel,
            notes="Test 3-user approval chain"
        )
        
        # Step 1: Submit the request
        BudgetRequestService.submit_budget_request(budget_request, user2)
        assert budget_request.status == BudgetRequestStatus.SUBMITTED
        assert budget_request.current_approver == user2
        
        # Start review
        budget_request = BudgetRequestService.start_review(budget_request)
        assert budget_request.status == BudgetRequestStatus.UNDER_REVIEW
        
        # Step 2: First approver (user2) approves and forwards to user3
        # Note: process_approval returns a fresh object instance from the database
        # to ensure we have the latest state after the atomic transaction
        budget_request = BudgetRequestService.process_approval(
            budget_request=budget_request,
            approver=user2,
            is_approved=True,
            comment="First approval - forwarding to next approver",
            next_approver=user3
        )
        
        # Should be back to UNDER_REVIEW with new approver
        assert budget_request.status == BudgetRequestStatus.UNDER_REVIEW
        assert budget_request.current_approver == user3
        
        # Step 3: Second approver (user3) approves and forwards to user1
        budget_request = BudgetRequestService.process_approval(
            budget_request=budget_request,
            approver=user3,
            is_approved=True,
            comment="Second approval - forwarding to final approver",
            next_approver=user1
        )
        
        # Should be back to UNDER_REVIEW with final approver
        assert budget_request.status == BudgetRequestStatus.UNDER_REVIEW
        assert budget_request.current_approver == user1
    
        # Step 4: Final approver (user1) approves - should lock
        # Ensure budget pool has sufficient funds
        budget_pool.refresh_from_db()
        assert budget_pool.available_amount >= budget_request.amount, f"Insufficient budget: available={budget_pool.available_amount}, needed={budget_request.amount}"
        
        budget_request = BudgetRequestService.process_approval(
            budget_request=budget_request,
            approver=user1,
            is_approved=True,
            comment="Final approval - locking request"
        )
        
        # Pool deduction is deferred to task lock; final approval leaves status APPROVED
        assert budget_request.status == BudgetRequestStatus.APPROVED

        # Budget pool is not updated until the task is explicitly locked
        budget_pool.refresh_from_db()
        assert budget_pool.used_amount == Decimal('0.00')

@pytest.mark.django_db
class TestRejectionResubmissionFlow:
    """Test rejection followed by resubmission flow"""
    
    def test_rejection_and_resubmission(self, user1, user2, task, budget_pool, ad_channel):
        """Test complete rejection and resubmission flow"""
        # Create budget request
        budget_request = BudgetRequest.objects.create(
            task=task,
            requested_by=user1,
            amount=Decimal('3000.00'),
            currency='AUD',
            status=BudgetRequestStatus.DRAFT,
            budget_pool=budget_pool,
            current_approver=user2,
            ad_channel=ad_channel,
            notes="Test rejection and resubmission"
        )
        
        # Step 1: Submit the request
        BudgetRequestService.submit_budget_request(budget_request, user2)
        assert budget_request.status == BudgetRequestStatus.SUBMITTED
        
        # Start review
        budget_request = BudgetRequestService.start_review(budget_request)
        assert budget_request.status == BudgetRequestStatus.UNDER_REVIEW
        
        # Step 2: Approver rejects the request
        budget_request = BudgetRequestService.process_approval(
            budget_request=budget_request,
            approver=user2,
            is_approved=False,
            comment="Request rejected - insufficient justification"
        )
        
        # Should be rejected
        assert budget_request.status == BudgetRequestStatus.REJECTED
        
        # Step 3: Revise the rejected request
        revised_data = {
            'amount': Decimal('2500.00'),  # Reduced amount
            'notes': 'Revised request with better justification'
        }
        
        BudgetRequestService.revise_rejected_request(budget_request, revised_data)
        
        # Should be back to DRAFT
        assert budget_request.status == BudgetRequestStatus.DRAFT
        assert budget_request.amount == Decimal('2500.00')
        assert budget_request.notes == 'Revised request with better justification'
        
        # Step 4: Resubmit the revised request
        BudgetRequestService.submit_budget_request(budget_request, user2)
        assert budget_request.status == BudgetRequestStatus.SUBMITTED
        
        # Start review
        budget_request = BudgetRequestService.start_review(budget_request)
        assert budget_request.status == BudgetRequestStatus.UNDER_REVIEW
        
        # Step 5: Approver approves the revised request
        # Ensure budget pool has sufficient funds
        budget_pool.refresh_from_db()
        assert budget_pool.available_amount >= budget_request.amount, f"Insufficient budget: available={budget_pool.available_amount}, needed={budget_request.amount}"
        
        budget_request = BudgetRequestService.process_approval(
            budget_request=budget_request,
            approver=user2,
            is_approved=True,
            comment="Revised request approved"
        )
        
        # Pool deduction is deferred to task lock; final approval leaves status APPROVED
        assert budget_request.status == BudgetRequestStatus.APPROVED

        # Budget pool is not updated until the task is explicitly locked
        budget_pool.refresh_from_db()
        assert budget_pool.used_amount == Decimal('0.00')


@pytest.mark.django_db
class TestPoolUnderflowDetection:
    """Test pool underflow detection"""
    
    def test_pool_underflow_detection_on_submit(self, user1, task, budget_pool, user2, ad_channel):
        """Test that submitting a request exceeding pool causes validation error"""
        # Set budget pool to have limited available amount
        budget_pool.used_amount = Decimal('9000.00')  # Only 1000 available
        budget_pool.save()
        
        # Create a request exceeding available amount (this should work)
        budget_request = BudgetRequestService.create_budget_request({
            'task': task,
            'requested_by': user1,
            'amount': Decimal('2000.00'),  # Exceeds available 1000
            'currency': 'AUD',
            'budget_pool': budget_pool,
            'current_approver': user2,
            'ad_channel': ad_channel,
            'notes': 'Test underflow'
        })
        
        # Try to submit the request (this should fail)
        with pytest.raises(ValidationError, match="Insufficient budget available in the pool"):
            BudgetRequestService.submit_budget_request(budget_request, user2)
    
    def test_pool_underflow_detection_on_lock(self, budget_request_under_review, budget_pool):
        """Test that locking a request exceeding pool causes validation error"""
        # First approve the request
        budget_request_under_review.approve()
        budget_request_under_review.save()
        assert budget_request_under_review.status == BudgetRequestStatus.APPROVED
        
        # Set budget pool to have insufficient available amount
        budget_pool.used_amount = Decimal('9500.00')  # Only 500 available
        budget_pool.save()
        
        # Try to lock the request (which requires 1000) - should fail now
        with pytest.raises(ValidationError, match="Insufficient budget available for locking"):
            BudgetRequestService.lock_budget_request(budget_request_under_review)
    
    def test_pool_exact_amount_validation_on_submit(self, user1, task, budget_pool, user2, ad_channel):
        """Test that exact available amount can be used"""
        # Set budget pool to have exactly the amount needed
        budget_pool.used_amount = Decimal('9000.00')  # Exactly 1000 available
        budget_pool.save()
        
        # Create request for exactly available amount
        budget_request = BudgetRequestService.create_budget_request({
            'task': task,
            'requested_by': user1,
            'amount': Decimal('1000.00'),  # Exactly available
            'currency': 'AUD',
            'budget_pool': budget_pool,
            'current_approver': user2,
            'ad_channel': ad_channel,
            'notes': 'Test exact amount'
        })
        
        assert budget_request is not None
        assert budget_request.amount == Decimal('1000.00')
        
        # Submit the request - should work with exact amount
        BudgetRequestService.submit_budget_request(budget_request, user2)
        assert budget_request.status == BudgetRequestStatus.SUBMITTED
        
        # Start review
        budget_request = BudgetRequestService.start_review(budget_request)
        assert budget_request.status == BudgetRequestStatus.UNDER_REVIEW
    
    def test_successful_lock_with_sufficient_budget(self, budget_request_under_review, budget_pool):
        """Test that locking succeeds when sufficient budget is available"""
        # First approve the request
        budget_request_under_review.approve()
        budget_request_under_review.save()
        assert budget_request_under_review.status == BudgetRequestStatus.APPROVED
        
        # Ensure budget pool has sufficient available amount (default fixture has 10000 total, 0 used)
        assert budget_pool.available_amount >= budget_request_under_review.amount
        
        # Lock the request - should succeed
        # Note: lock_budget_request returns a fresh object instance from the database
        budget_request_under_review = BudgetRequestService.lock_budget_request(budget_request_under_review)
        assert budget_request_under_review.status == BudgetRequestStatus.LOCKED
        
        # Verify budget pool was updated correctly
        budget_pool.refresh_from_db()
        assert budget_pool.used_amount == budget_request_under_review.amount
        assert budget_pool.available_amount == Decimal('10000.00') - budget_request_under_review.amount
    
    def test_pool_exact_amount_lock_validation(self, budget_request_under_review, budget_pool):
        """Test that locking with exactly available amount works"""
        # First approve the request
        budget_request_under_review.approve()
        budget_request_under_review.save()
        assert budget_request_under_review.status == BudgetRequestStatus.APPROVED
        
        # Set budget pool to have exactly the amount needed
        budget_pool.used_amount = Decimal('9000.00')  # Exactly 1000 available (request amount)
        budget_pool.save()
        
        # Lock the request - should succeed with exact amount
        # Note: lock_budget_request returns a fresh object instance from the database
        budget_request_under_review = BudgetRequestService.lock_budget_request(budget_request_under_review)
        assert budget_request_under_review.status == BudgetRequestStatus.LOCKED
        
        # Verify budget pool is now fully utilized
        budget_pool.refresh_from_db()
        assert budget_pool.used_amount == Decimal('10000.00')  # 9000 + 1000
        assert budget_pool.available_amount == Decimal('0.00')