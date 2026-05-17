import pytest
from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from budget_approval.models import BudgetRequestStatus


@pytest.mark.django_db
class TestBudgetRequestViews:
    """Test BudgetRequest API views"""
    
    def test_create_budget_request(self, api_client, user1, task, budget_pool, user2, ad_channel, team, user_role1, role_permissions):
        """Test creating a new budget request"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'task': task.id,
            'amount': '1000.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'budget_pool': budget_pool.id,
            'ad_channel': ad_channel.id,
            'notes': 'Test budget request'
        }
        
        url = reverse('budget-request-list')
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['amount'] == '1000.00'
        assert response.data['currency'] == 'AUD'
        # Task is DRAFT so BudgetRequest stays DRAFT; submission is deferred to task submission
        assert response.data['status'] == BudgetRequestStatus.DRAFT
        # requested_by now returns username/name string instead of ID
        assert response.data['requested_by'] == user1.username
    
    def test_create_budget_request_invalid_amount(self, api_client, user1, task, budget_pool, user2, ad_channel, team, user_role1, role_permissions):
        """Test creating a budget request with invalid amount"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'task': task.id,
            'amount': '-100.00',  # Negative amount
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            'notes': 'Test invalid amount'
        }
        
        url = reverse('budget-request-list')
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_get_budget_request(self, api_client, user1, budget_request_draft, team, user_role1, role_permissions):
        """Test retrieving a budget request"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_draft.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == budget_request_draft.id
        assert response.data['amount'] == '1000.00'
        assert response.data['status'] == BudgetRequestStatus.DRAFT
    
    def test_update_budget_request(self, api_client, user1, budget_request_draft, user2, ad_channel, team, user_role1, role_permissions):
        """Test updating a budget request"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'task': budget_request_draft.task.id,
            'amount': '1500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            'notes': 'Updated budget request'
        }
        
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_draft.id})
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['amount'] == '1500.00'
        assert response.data['notes'] == 'Updated budget request'
    
    def test_list_budget_requests(self, api_client, user1, budget_request_draft, team, user_role1, role_permissions):
        """Test listing budget requests"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-list')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        # Check that the specific budget request is in the list
        # response.data might be a dict with 'results' key for pagination
        if isinstance(response.data, dict) and 'results' in response.data:
            budget_request_ids = [item['id'] for item in response.data['results']]
        else:
            budget_request_ids = [item['id'] for item in response.data]
        assert budget_request_draft.id in budget_request_ids
    
    def test_unauthorized_access(self, api_client, budget_request_draft):
        """Test unauthorized access to budget request"""
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_draft.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestBudgetRequestDecisionView:
    """Test BudgetRequest decision endpoint"""
    
    def test_approve_budget_request(self, api_client, user2, budget_request_under_review, team, user_role2, role_permissions):
        """Test approving a budget request"""
        api_client.force_authenticate(user=user2)
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'decision': 'approve',
            'comment': 'Approved for testing'
        }
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        # Pool deduction is deferred to task lock; final approval leaves status APPROVED
        assert response.data['status'] == BudgetRequestStatus.APPROVED
    
    def test_reject_budget_request(self, api_client, user2, budget_request_under_review, team, user_role2, role_permissions):
        """Test rejecting a budget request"""
        api_client.force_authenticate(user=user2)
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'decision': 'reject',
            'comment': 'Rejected for testing'
        }
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == BudgetRequestStatus.REJECTED
    
    def test_approve_with_next_approver(self, api_client, user2, budget_request_under_review, user3, team, user_role2, role_permissions):
        """Test approving and forwarding to next approver"""
        api_client.force_authenticate(user=user2)
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'decision': 'approve',
            'comment': 'Approved and forwarding',
            'next_approver': user3.id
        }
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        # After forwarding to next approver, status should be changed to UNDER_REVIEW again
        assert response.data['status'] == BudgetRequestStatus.UNDER_REVIEW
        # Check that the budget_request data is included in response
        assert 'budget_request' in response.data
    
    def test_decision_invalid_status(self, api_client, user2, budget_request_draft, team, user_role2, role_permissions):
        """Test making decision on request in invalid status"""
        api_client.force_authenticate(user=user2)
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'decision': 'approve',
            'comment': 'Should fail'
        }
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_draft.id})
        response = api_client.patch(url, data, format='json')
        
        # Should return 400 because the request is not in UNDER_REVIEW status (business logic error)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_decision_wrong_approver(self, api_client, user1, budget_request_under_review, team, user_role1, role_permissions):
        """Test making decision with wrong approver"""
        api_client.force_authenticate(user=user1)  # user1 is not the current approver
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'decision': 'approve',
            'comment': 'Should fail'
        }
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        response = api_client.patch(url, data, format='json')
        
        # Should return 403 because user1 is not the current approver
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestBudgetPoolViews:
    """Test BudgetPool API views"""
    
    def test_get_budget_pool(self, api_client, user1, budget_pool, team, user_role1, role_permissions):
        """Test retrieving a budget pool"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-pool-detail', kwargs={'pk': budget_pool.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == budget_pool.id
        # Serializer returns string format for decimal fields
        assert str(response.data['total_amount']) == '10000.00'
        assert str(response.data['used_amount']) == '0.00'
        assert str(response.data['available_amount']) == '10000.00'
    
    
    def test_list_budget_pools(self, api_client, user1, budget_pool, team, user_role1, role_permissions):
        """Test listing budget pools"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-pool-list')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        # Check that the specific budget pool is in the list
        # response.data might be a dict with 'results' key for pagination
        if isinstance(response.data, dict) and 'results' in response.data:
            budget_pool_ids = [item['id'] for item in response.data['results']]
        else:
            budget_pool_ids = [item['id'] for item in response.data]
        assert budget_pool.id in budget_pool_ids


@pytest.mark.django_db
class TestBudgetEscalationView:
    """Test BudgetEscalation webhook endpoint"""
    
    def test_escalation_webhook(self, api_client, user1, task, budget_pool, user2, ad_channel, escalation_rule, monkeypatch):
        """Test escalation webhook endpoint"""
        # Set up internal webhook token
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_TOKEN', 'test-token')
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_ENABLED', True)
        
        # Mock the trigger_escalation task to avoid Redis connection issues
        class MockTaskResult:
            def __init__(self):
                self.id = 'test-task-id'
        
        class MockTask:
            def __call__(self, budget_request_id):
                return {'success': True, 'budget_request_id': budget_request_id}
            
            def delay(self, budget_request_id):
                return MockTaskResult()
        
        mock_task = MockTask()
        monkeypatch.setattr('budget_approval.tasks.trigger_escalation', mock_task)
        
        # Create an escalated budget request
        from budget_approval.models import BudgetRequest
        budget_request = BudgetRequest.objects.create(
            task=task,
            requested_by=user1,
            amount=Decimal('6000.00'),
            currency='AUD',
            status=BudgetRequestStatus.DRAFT,
            budget_pool=budget_pool,
            current_approver=user2,
            ad_channel=ad_channel,
            is_escalated=True,
            notes='Test escalation webhook'
        )
        
        data = {
            'budget_request_id': budget_request.id,
            'triggered_at': '2024-01-01T10:00:00Z'
        }
        
        url = reverse('budget-escalation')
        response = api_client.post(url, data, format='json', HTTP_X_INTERNAL_TOKEN='test-token')
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_escalation_webhook_invalid_request(self, api_client, monkeypatch):
        """Test escalation webhook with invalid request ID"""
        # Set up internal webhook token
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_TOKEN', 'test-token')
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_ENABLED', True)
        
        data = {
            'budget_request_id': 99999,  # Non-existent ID
            'triggered_at': '2024-01-01T10:00:00Z'
        }
        
        url = reverse('budget-escalation')
        response = api_client.post(url, data, format='json', HTTP_X_INTERNAL_TOKEN='test-token')
        
        # Should return 404 because the budget request doesn't exist
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_escalation_webhook_missing_data(self, api_client, monkeypatch):
        """Test escalation webhook with missing data"""
        # Set up internal webhook token
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_TOKEN', 'test-token')
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_ENABLED', True)
        
        data = {
            'triggered_at': '2024-01-01T10:00:00Z'
            # Missing budget_request_id
        }
        
        url = reverse('budget-escalation')
        response = api_client.post(url, data, format='json', HTTP_X_INTERNAL_TOKEN='test-token')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST 