import pytest
from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.conf import settings
from budget_approval.models import BudgetRequestStatus
from budget_approval.permissions import (
    BudgetRequestPermission, ApprovalPermission, BudgetPoolPermission, EscalationPermission
)


@pytest.mark.django_db
class TestBudgetRequestPermissions:
    """Test budget request permissions"""
    
    def test_can_view_own_request(self, api_client, user1, budget_request_draft, team, user_role1, role_permissions):
        """Test user can view their own budget request"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_draft.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_can_view_as_approver(self, api_client, user2, budget_request_under_review, team, user_role2, role_permissions):
        """Test approver can view budget request"""
        api_client.force_authenticate(user=user2)
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_under_review.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_user_without_permission_cannot_view_request(self, api_client, user3, budget_request_draft, team):
        """Test user without VIEW permission cannot view budget request"""
        # Create user3 without any role permissions
        api_client.force_authenticate(user=user3)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_draft.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_can_create_own_request(self, api_client, user1, task, budget_pool, user2, ad_channel, team, user_role1, role_permissions):
        """Test user can create their own budget request"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'task': task.id,
            'amount': '1000.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            'notes': 'Test permission'
        }
        
        url = reverse('budget-request-list')
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
    
    def test_can_update_own_draft_request(self, api_client, user1, budget_request_draft, user2, ad_channel, team, user_role1, role_permissions):
        """Test user can update their own draft request"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'task': budget_request_draft.task.id,
            'amount': '1500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            'notes': 'Updated by owner'
        }
        
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_draft.id})
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_super_admin_has_all_permissions(self, api_client, superuser, budget_request_draft, team):
        """Test super admin has all permissions"""
        api_client.force_authenticate(user=superuser)
        # Super admin doesn't need team context
        api_client.credentials(HTTP_X_USER_ROLE='admin')
        
        # Test can view any request
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_draft.id})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        
        # Test can update any request
        data = {
            'task': budget_request_draft.task.id,
            'amount': '2000.00',
            'currency': 'AUD',
            'current_approver': budget_request_draft.current_approver.id,
            'ad_channel': budget_request_draft.ad_channel.id,
            'notes': 'Updated by super admin'
        }
        response = api_client.patch(url, data, format='json')
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestBudgetRequestApprovalPermissions:
    """Test budget request approval permissions"""
    
    def test_approver_can_approve(self, api_client, user2, budget_request_under_review, team, user_role2, role_permissions):
        """Test approver can approve budget request"""
        api_client.force_authenticate(user=user2)
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        data = {
            'decision': 'approve',
            'comment': 'Approved by approver'
        }
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_wrong_approver_cannot_approve(self, api_client, user3, budget_request_under_review, team, user_role3, role_permissions):
        """Test wrong approver cannot approve budget request"""
        api_client.force_authenticate(user=user3)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        data = {
            'decision': 'approve',
            'comment': 'Should not be allowed'
        }
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_request_owner_cannot_approve(self, api_client, user1, budget_request_under_review, team, user_role1, role_permissions):
        """Test request owner cannot approve their own request"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        data = {
            'decision': 'approve',
            'comment': 'Should not be allowed'
        }
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_approver_can_reject(self, api_client, user2, budget_request_under_review, team, user_role2, role_permissions):
        """Test approver can reject budget request"""
        api_client.force_authenticate(user=user2)
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        data = {
            'decision': 'reject',
            'comment': 'Rejected by approver'
        }
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
    

    
    def test_super_admin_can_approve_any_request(self, api_client, superuser, budget_request_under_review, team):
        """Test super admin can approve any request"""
        api_client.force_authenticate(user=superuser)
        # Super admin doesn't need team context
        api_client.credentials(HTTP_X_USER_ROLE='admin')
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        data = {
            'decision': 'approve',
            'comment': 'Approved by super admin'
        }
        response = api_client.patch(url, data, format='json')
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestBudgetPoolPermissions:
    """Test budget pool permissions"""
    
    def test_user_can_view_budget_pool(self, api_client, user1, budget_pool, team, user_role1, role_permissions):
        """Test user can view budget pool"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-pool-detail', kwargs={'pk': budget_pool.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_authenticated_user_can_create_budget_pool_without_pool_edit_role(
        self, api_client, user3, project, ad_channel, team
    ):
        """Any authenticated user may create a pool; RBAC EDIT is not required for POST."""
        api_client.force_authenticate(user=user3)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))

        data = {
            'project': project.id,
            'ad_channel': ad_channel.id,
            'total_amount': '5000.00',
            'currency': 'AUD',
        }

        url = reverse('budget-pool-list')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED

    def test_user_without_pool_view_can_list_pools_for_their_org_project(
        self, api_client, user3, budget_pool, team
    ):
        """GET list is allowed without BUDGET_POOL VIEW; queryset is scoped by org / membership."""
        api_client.force_authenticate(user=user3)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))

        url = reverse('budget-pool-list')
        response = api_client.get(url, {'project_id': budget_pool.project.id})

        assert response.status_code == status.HTTP_200_OK
        ids = (
            [item['id'] for item in response.data['results']]
            if isinstance(response.data, dict) and 'results' in response.data
            else [item['id'] for item in response.data]
        )
        assert budget_pool.id in ids

    def test_user_cannot_update_budget_pool(self, api_client, user3, budget_pool, team):
        """Test user cannot update budget pool (permission denied)"""
        # user3 has no role permissions, so should be denied
        api_client.force_authenticate(user=user3)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'project': budget_pool.project.id,
            'ad_channel': budget_pool.ad_channel.id,
            'total_amount': '15000.00',
            'currency': 'AUD'
        }
        
        url = reverse('budget-pool-detail', kwargs={'pk': budget_pool.id})
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_super_admin_has_budget_pool_permissions(self, api_client, superuser, budget_pool, team):
        """Test super admin has budget pool permissions"""
        api_client.force_authenticate(user=superuser)
        # Super admin doesn't need team context
        api_client.credentials(HTTP_X_USER_ROLE='admin')
        
        # Test can view any budget pool
        url = reverse('budget-pool-detail', kwargs={'pk': budget_pool.id})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        
        # Test can update any budget pool
        data = {
            'project': budget_pool.project.id,
            'ad_channel': budget_pool.ad_channel.id,
            'total_amount': '20000.00',
            'used_amount': '0.00',
            'currency': 'AUD'
        }
        response = api_client.patch(url, data, format='json')
        assert response.status_code == status.HTTP_200_OK

@pytest.mark.django_db
class TestUnauthenticatedAccess:
    """Test unauthenticated access"""
    
    def test_unauthenticated_cannot_create_request(self, api_client, task, budget_pool, user2, ad_channel, team):
        """Test unauthenticated user cannot create request"""
        api_client.force_authenticate(user=None) # Force unauthenticate
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'task': task.id,
            'amount': '1000.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            'notes': 'Should not be allowed'
        }
        
        url = reverse('budget-request-list')
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_unauthenticated_cannot_view_request(self, api_client, budget_request_draft, team):
        """Test unauthenticated user cannot view request"""
        api_client.force_authenticate(user=None) # Force unauthenticate
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_draft.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_unauthenticated_cannot_approve_request(self, api_client, budget_request_under_review, team):
        """Test unauthenticated user cannot approve request"""
        api_client.force_authenticate(user=None) # Force unauthenticate
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        data = {
            'decision': 'approve',
            'comment': 'Should not be allowed'
        }
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_unauthenticated_cannot_view_budget_pool(self, api_client, budget_pool, team):
        """Test unauthenticated user cannot view budget pool"""
        api_client.force_authenticate(user=None) # Force unauthenticate
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-pool-detail', kwargs={'pk': budget_pool.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_unauthenticated_cannot_list_budget_pools(self, api_client, team):
        """Test unauthenticated user cannot list budget pools"""
        api_client.force_authenticate(user=None) # Force unauthenticate
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-pool-list')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestCrossOrganizationPermissions:
    """Test permissions across different organizations"""
    
    def test_cannot_access_different_organization(self, api_client, user3, budget_request_different_org, team):
        """Test user cannot access budget request from different organization"""
        # user3 has no role permissions, so should be denied
        api_client.force_authenticate(user=user3)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        # Test cannot view request from different organization
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_different_org.id})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        # Test cannot update request from different organization
        data = {
            'task': budget_request_different_org.task.id,
            'amount': '1500.00',
            'currency': 'AUD',
            'current_approver': budget_request_different_org.current_approver.id,
            'ad_channel': budget_request_different_org.ad_channel.id,
            'notes': 'Should not be allowed'
        }
        response = api_client.patch(url, data, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_cannot_approve_different_organization(self, api_client, user3, budget_request_different_org, team):
        """Test approver cannot approve request from different organization"""
        # user3 has no role permissions, so should be denied
        api_client.force_authenticate(user=user3)
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id))
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_different_org.id})
        data = {
            'decision': 'approve',
            'comment': 'Should not be allowed'
        }
        response = api_client.patch(url, data, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestEscalationPermission:
    """Test EscalationPermission for internal webhook access"""
    
    def test_valid_token_grants_access(self, api_client, monkeypatch):
        """Test that valid internal token grants access"""
        # Set a test token for this test
        test_token = 'test_token_for_this_test'
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_TOKEN', test_token)
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_ENABLED', True)
        
        permission = EscalationPermission()
        
        # Create a mock request with the test token
        class MockHeaders:
            def __init__(self, token):
                self.token = token
            
            def get(self, key, default=None):
                if key == 'X-Internal-Token':
                    return self.token
                return default
        
        mock_headers = MockHeaders(test_token)
        request = type('MockRequest', (), {
            'headers': mock_headers,
            'META': {}
        })()
        
        assert permission.has_permission(request, None) is True
    
    def test_invalid_token_denies_access(self, api_client, monkeypatch):
        """Test that invalid internal token denies access"""
        
        # Set a test token for this test
        test_token = 'valid_test_token'
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_TOKEN', test_token)
        
        permission = EscalationPermission()
        
        # Create a mock request with invalid token
        class MockHeadersInvalid:
            def get(self, key, default=None):
                if key == 'X-Internal-Token':
                    return 'invalid_token'
                return default
        
        mock_headers = MockHeadersInvalid()
        request = type('MockRequest', (), {
            'headers': mock_headers,
            'META': {}
        })()
        
        assert permission.has_permission(request, None) is False
    
    def test_missing_token_denies_access(self, api_client, monkeypatch):
        """Test that missing internal token denies access"""
        
        # Set a test token for this test
        test_token = 'valid_test_token'
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_TOKEN', test_token)
        
        permission = EscalationPermission()
        
        # Create a mock request without token
        class MockHeadersNone:
            def get(self, key, default=None):
                return default
        
        mock_headers = MockHeadersNone()
        request = type('MockRequest', (), {
            'headers': mock_headers,
            'META': {}
        })()
        
        assert permission.has_permission(request, None) is False
    
    def test_disabled_feature_denies_access(self, api_client, monkeypatch):
        """Test that disabled feature denies access even with valid token"""
        
        permission = EscalationPermission()
        
        # Mock settings to disable the feature
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_ENABLED', False)
        
        # Create a mock request with valid token
        class MockHeadersAny:
            def get(self, key, default=None):
                if key == 'X-Internal-Token':
                    return 'any_token'
                return default
        
        mock_headers = MockHeadersAny()
        request = type('MockRequest', (), {
            'headers': mock_headers,
            'META': {}
        })()
        
        assert permission.has_permission(request, None) is False
    
    def test_missing_token_config_denies_access(self, api_client, monkeypatch):
        """Test that missing token configuration denies access"""
        
        permission = EscalationPermission()
        
        # Mock settings to remove token configuration
        monkeypatch.setattr('django.conf.settings.INTERNAL_WEBHOOK_TOKEN', None)
        
        # Create a mock request with valid token
        class MockHeadersAny2:
            def get(self, key, default=None):
                if key == 'X-Internal-Token':
                    return 'any_token'
                return default
        
        mock_headers = MockHeadersAny2()
        request = type('MockRequest', (), {
            'headers': mock_headers,
            'META': {}
        })()
        
        assert permission.has_permission(request, None) is False
    
    def test_object_permission_always_false(self, api_client):
        """Test that object permission always returns False for internal webhooks"""
        
        permission = EscalationPermission()
        
        # Object permission should always be False for internal webhooks
        assert permission.has_object_permission(None, None, None) is False 