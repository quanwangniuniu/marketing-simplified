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
@pytest.mark.timeout(600)
class TestBudgetRequestPermissions:
    """Test budget request permissions"""
    
    def test_can_view_own_request(self, api_client, user1, budget_request_draft, team, user_role1, role_permissions):
        """Test user can view their own budget request"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id), HTTP_X_ORGANIZATION_SLUG=team.organization.slug)
        
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_draft.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_can_view_as_approver(self, api_client, user2, budget_request_under_review, team, user_role2, role_permissions):
        """Test approver can view budget request"""
        api_client.force_authenticate(user=user2)
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id), HTTP_X_ORGANIZATION_SLUG=team.organization.slug)
        
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_under_review.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_user_without_permission_cannot_view_request(self, api_client, user3, budget_request_draft, team):
        """Test user without VIEW permission cannot view budget request"""
        # Create user3 without any role permissions
        api_client.force_authenticate(user=user3)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id), HTTP_X_ORGANIZATION_SLUG=team.organization.slug)
        
        url = reverse('budget-request-detail', kwargs={'pk': budget_request_draft.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_can_create_own_request(self, api_client, user1, task, budget_pool, user2, ad_channel, team, user_role1, role_permissions):
        """Test user can create their own budget request"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id), HTTP_X_ORGANIZATION_SLUG=team.organization.slug)
        
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
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id), HTTP_X_ORGANIZATION_SLUG=team.organization.slug)
        
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
        # Super admin doesn't need team context but does need org slug for schema routing
        api_client.credentials(HTTP_X_USER_ROLE='admin', HTTP_X_ORGANIZATION_SLUG=team.organization.slug)
        
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
@pytest.mark.timeout(600)
class TestBudgetRequestApprovalPermissions:
    """Test budget request approval permissions"""
    
    def test_approver_can_approve(self, api_client, user2, budget_request_under_review, team, user_role2, role_permissions):
        """Test approver can approve budget request"""
        api_client.force_authenticate(user=user2)
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id), HTTP_X_ORGANIZATION_SLUG=team.organization.slug)

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
        api_client.credentials(HTTP_X_USER_ROLE='team_leader', HTTP_X_TEAM_ID=str(team.id), HTTP_X_ORGANIZATION_SLUG=team.organization.slug)

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
        # Super admin doesn't need team context but does need org slug for schema routing
        api_client.credentials(HTTP_X_USER_ROLE='admin', HTTP_X_ORGANIZATION_SLUG=team.organization.slug)
        
        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        data = {
            'decision': 'approve',
            'comment': 'Approved by super admin'
        }
        response = api_client.patch(url, data, format='json')
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
@pytest.mark.timeout(600)
class TestOrgAdminApprovalOverridePermissions:
    """MED-240: org-admin can approve outside the chain; non-admins unchanged.

    Matrix:
      - chain approver (user2)     → already covered above (can approve)
      - non-chain member (user3)   → already covered (403)
      - request owner (user1)      → already covered (403)
      - org-admin (not approver)   → MUST be allowed (this class)
      - superuser                  → already covered
    """

    def test_team_member_cannot_approve_via_decision_api(
        self, api_client, user3, budget_request_under_review, team, user_role3, role_permissions
    ):
        """MED-240: non-approver team member → PATCH decision is 403 (API enforcement)."""
        assert budget_request_under_review.current_approver_id != user3.id

        api_client.force_authenticate(user=user3)
        api_client.credentials(
            HTTP_X_USER_ROLE='team_member',
            HTTP_X_TEAM_ID=str(team.id),
            HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
        )

        url = reverse(
            'budget-request-decision',
            kwargs={'pk': budget_request_under_review.id},
        )
        response = api_client.patch(
            url,
            {'decision': 'approve', 'comment': 'Member must not approve'},
            format='json',
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_team_member_cannot_make_approval_on_budget_task(
        self, api_client, user3, budget_request_under_review, team, user2, project, user_role3
    ):
        """MED-240: non-approver team member → POST make-approval is 403."""
        from core.models import ProjectMember
        from django.contrib.contenttypes.models import ContentType
        from budget_approval.models import BudgetRequest
        from task.models import Task

        br = budget_request_under_review
        assert br.current_approver_id == user2.id
        assert user3.id != user2.id

        task = br.task
        task.current_approver = user2
        task.content_type = ContentType.objects.get_for_model(BudgetRequest)
        task.object_id = br.id
        task.save(update_fields=['current_approver', 'content_type', 'object_id'])
        if task.status == Task.Status.DRAFT:
            task.submit()
            task.start_review()
            task.save()
        elif task.status == Task.Status.SUBMITTED:
            task.start_review()
            task.save()
        assert task.status == Task.Status.UNDER_REVIEW

        ProjectMember.objects.get_or_create(
            user=user3,
            project=project,
            defaults={'is_active': True},
        )

        api_client.force_authenticate(user=user3)
        api_client.credentials(
            HTTP_X_USER_ROLE='team_member',
            HTTP_X_TEAM_ID=str(team.id),
            HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
        )

        url = reverse('task-make-approval', kwargs={'pk': task.slug})
        response = api_client.post(
            url,
            {'action': 'approve', 'comment': 'Member must not approve'},
            format='json',
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'designated approver' in (response.data.get('error') or '').lower()

    def test_org_admin_can_approve_via_task_make_approval(
        self, api_client, org_admin, budget_request_under_review, team, user2, project
    ):
        """UI path: TaskAPI.makeApproval must allow same-org org-admin override (MED-240)."""
        from core.models import ProjectMember
        from django.contrib.contenttypes.models import ContentType
        from budget_approval.approver_access import (
            ORG_ADMIN_OVERRIDE_PREFIX,
            budget_request_has_admin_override,
        )
        from budget_approval.models import BudgetRequest
        from task.models import Task

        br = budget_request_under_review
        assert br.current_approver_id == user2.id
        assert org_admin.id != user2.id

        task = br.task
        task.current_approver = user2
        task.content_type = ContentType.objects.get_for_model(br)
        task.object_id = br.id
        task.save(update_fields=['current_approver', 'content_type', 'object_id'])
        # FSM protected field — walk transitions instead of assigning status.
        if task.status == Task.Status.DRAFT:
            task.submit()
            task.start_review()
            task.save()
        elif task.status == Task.Status.SUBMITTED:
            task.start_review()
            task.save()
        assert task.status == Task.Status.UNDER_REVIEW

        ProjectMember.objects.get_or_create(
            user=org_admin,
            project=project,
            defaults={'is_active': True},
        )

        api_client.force_authenticate(user=org_admin)
        api_client.credentials(
            HTTP_X_USER_ROLE='org_admin',
            HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
        )

        url = reverse('task-make-approval', kwargs={'pk': task.slug})
        response = api_client.post(
            url,
            {'action': 'approve', 'comment': 'Org-admin UI override'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        # Task endpoint may leave search_path on the tenant schema used by middleware;
        # assert from the response (and restore path before any ORM refresh).
        assert response.data['task']['status'] in (
            Task.Status.APPROVED,
            Task.Status.UNDER_REVIEW,
        )
        assert ORG_ADMIN_OVERRIDE_PREFIX in (
            response.data.get('approval_record', {}).get('comment') or ''
        )
        linked = response.data['task'].get('linked_object') or {}
        assert linked.get('is_admin_override') is True
        audit = linked.get('admin_override') or {}
        assert audit.get('override_by_user_id') == org_admin.id
        assert audit.get('override_type') == 'org_admin'
        assert audit.get('final_outcome') == 'approve'
        assert audit.get('replaced_step') is not None
        assert audit.get('override_timestamp')

        from django.db import connection
        from core.services.tenant import slug_to_schema_name

        schema = slug_to_schema_name(team.organization.slug)
        with connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO {schema}, public')
        # FSM protected status: refresh_from_db() setattr fails — re-fetch instead.
        br = BudgetRequest.objects.get(pk=br.pk)
        assert br.status == BudgetRequestStatus.APPROVED
        assert budget_request_has_admin_override(br) is True

    def test_org_admin_can_approve_outside_chain(
        self, api_client, org_admin, budget_request_under_review, team, user2
    ):
        """Org-admin who is NOT current_approver can still approve (override)."""
        assert budget_request_under_review.current_approver_id == user2.id
        assert org_admin.id != user2.id

        api_client.force_authenticate(user=org_admin)
        api_client.credentials(
            HTTP_X_USER_ROLE='org_admin',
            HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
        )

        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        response = api_client.patch(
            url,
            {'decision': 'approve', 'comment': 'Org-admin override'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == BudgetRequestStatus.APPROVED
        assert response.data['budget_request']['is_admin_override'] is True
        audit = response.data['budget_request']['admin_override']
        assert audit['override_by_user_id'] == org_admin.id
        assert audit['override_type'] == 'org_admin'
        assert audit['final_outcome'] == 'approve'
        assert audit['override_timestamp']

    def test_second_decision_returns_409_conflict(
        self, api_client, org_admin, budget_request_under_review, team, user2
    ):
        """Duplicate decision after a final override is 409, not 400."""
        api_client.force_authenticate(user=org_admin)
        api_client.credentials(
            HTTP_X_USER_ROLE='org_admin',
            HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
        )
        url = reverse(
            'budget-request-decision',
            kwargs={'pk': budget_request_under_review.id},
        )
        first = api_client.patch(
            url,
            {'decision': 'approve', 'comment': 'First override'},
            format='json',
        )
        assert first.status_code == status.HTTP_200_OK, first.data

        second = api_client.patch(
            url,
            {'decision': 'approve', 'comment': 'Duplicate click'},
            format='json',
        )
        assert second.status_code == status.HTTP_409_CONFLICT
        assert 'already been decided' in (second.data.get('error') or '').lower()

    def test_get_detail_after_override_returns_structured_admin_override(
        self, api_client, org_admin, budget_request_under_review, team, user1, user2
    ):
        """PATCH decision then GET detail: structured audit is readable on the resource."""
        task = budget_request_under_review.task
        task.current_approval_step = 1
        task.save(update_fields=['current_approval_step'])

        api_client.force_authenticate(user=org_admin)
        api_client.credentials(
            HTTP_X_USER_ROLE='org_admin',
            HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
        )
        decision_url = reverse(
            'budget-request-decision',
            kwargs={'pk': budget_request_under_review.id},
        )
        decide = api_client.patch(
            decision_url,
            {'decision': 'approve', 'comment': 'Org-admin override'},
            format='json',
        )
        assert decide.status_code == status.HTTP_200_OK, decide.data

        api_client.force_authenticate(user=user1)
        api_client.credentials(
            HTTP_X_USER_ROLE='team_member',
            HTTP_X_TEAM_ID=str(team.id),
            HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
        )
        detail_url = reverse(
            'budget-request-detail',
            kwargs={'pk': budget_request_under_review.id},
        )
        response = api_client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data['is_admin_override'] is True
        audit = response.data['admin_override']
        assert audit['override_by_user_id'] == org_admin.id
        assert audit['override_type'] == 'org_admin'
        assert audit['replaced_step'] == 1
        assert audit['final_outcome'] == 'approve'
        assert audit['override_timestamp']

    def test_org_admin_can_reject_outside_chain(
        self, api_client, org_admin, budget_request_under_review, team, user2
    ):
        """Org-admin who is NOT current_approver can reject (override)."""
        assert budget_request_under_review.current_approver_id == user2.id

        api_client.force_authenticate(user=org_admin)
        api_client.credentials(
            HTTP_X_USER_ROLE='org_admin',
            HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
        )

        url = reverse('budget-request-decision', kwargs={'pk': budget_request_under_review.id})
        response = api_client.patch(
            url,
            {'decision': 'reject', 'comment': 'Org-admin override reject'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == BudgetRequestStatus.REJECTED
        assert response.data['budget_request']['is_admin_override'] is True
        audit = response.data['budget_request']['admin_override']
        assert audit['override_by_user_id'] == org_admin.id
        assert audit['final_outcome'] == 'reject'

    def test_approval_permission_object_allows_org_admin(
        self, org_admin, budget_request_under_review, user2
    ):
        """Unit: ApprovalPermission.has_object_permission is True for org-admin."""
        assert budget_request_under_review.current_approver_id == user2.id
        assert org_admin.id != user2.id

        permission = ApprovalPermission()
        request = type('Req', (), {
            'user': org_admin,
            'method': 'PATCH',
            'headers': {'x-user-role': 'org_admin'},
        })()
        assert permission.has_object_permission(
            request, None, budget_request_under_review
        ) is True

    def test_approval_permission_object_denies_non_chain_non_admin(
        self, user3, budget_request_under_review, user2, user_role3, role_permissions
    ):
        """Unit: non-admin who is not current_approver is still denied."""
        assert budget_request_under_review.current_approver_id == user2.id
        assert user3.id != user2.id

        permission = ApprovalPermission()
        request = type('Req', (), {
            'user': user3,
            'method': 'PATCH',
            'headers': {'x-user-role': 'team_member', 'x-team-id': '1'},
        })()
        assert permission.has_object_permission(
            request, None, budget_request_under_review
        ) is False

    def test_org_admin_of_other_org_cannot_process_approval(
        self, org_admin, budget_request_different_org, user2
    ):
        """Unit: org-admin of org A cannot override a request owned by org B."""
        from budget_approval.approver_access import (
            is_org_admin_override_action,
            user_is_org_admin_for_budget_request,
            user_may_process_budget_approval,
        )

        assert budget_request_different_org.current_approver_id == user2.id
        assert org_admin.id != user2.id
        assert user_is_org_admin_for_budget_request(
            org_admin, budget_request_different_org
        ) is False
        assert user_may_process_budget_approval(
            org_admin, budget_request_different_org
        ) is False
        assert is_org_admin_override_action(
            org_admin, budget_request_different_org
        ) is False

        permission = ApprovalPermission()
        request = type('Req', (), {
            'user': org_admin,
            'method': 'PATCH',
            'headers': {'x-user-role': 'org_admin'},
        })()
        assert permission.has_object_permission(
            request, None, budget_request_different_org
        ) is False

    def test_org_admin_cannot_approve_different_organization(
        self, api_client, budget_request_under_review, team, user2, different_organization
    ):
        """API: org-admin of org B cannot approve a request owned by org A (403).

        The request is fetched in org A's tenant (so this is not a 404 from
        schema isolation); ApprovalPermission then denies the override.
        """
        import uuid
        from django.contrib.auth import get_user_model
        from core.admin_utils import assign_org_admin

        User = get_user_model()
        uid = uuid.uuid4().hex[:8]
        other_admin = User.objects.create_user(
            username=f'otheradmin_{uid}',
            email=f'otheradmin_{uid}@test.com',
            password='testpass123',
            organization=different_organization,
            current_organization=different_organization,
        )
        assign_org_admin(other_admin, different_organization)

        assert budget_request_under_review.current_approver_id == user2.id
        assert other_admin.id != user2.id

        api_client.force_authenticate(user=other_admin)
        api_client.credentials(
            HTTP_X_USER_ROLE='org_admin',
            HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
        )

        url = reverse(
            'budget-request-decision',
            kwargs={'pk': budget_request_under_review.id},
        )
        response = api_client.patch(
            url,
            {'decision': 'approve', 'comment': 'Cross-org should be denied'},
            format='json',
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_org_admin_who_is_current_approver_is_not_override(
        self, org_admin, budget_request_under_review
    ):
        """Unit: org-admin on the chain is a normal approval, not an override."""
        from budget_approval.approver_access import (
            is_org_admin_override_action,
            user_may_process_budget_approval,
        )

        budget_request_under_review.current_approver = org_admin
        budget_request_under_review.save(update_fields=['current_approver'])

        assert user_may_process_budget_approval(
            org_admin, budget_request_under_review
        ) is True
        assert is_org_admin_override_action(
            org_admin, budget_request_under_review
        ) is False

    def test_org_admin_as_current_approver_make_approval_is_not_override(
        self, api_client, org_admin, budget_request_under_review, team, project
    ):
        """UI path: org-admin who IS current_approver must not get override audit."""
        from core.models import ProjectMember
        from django.contrib.contenttypes.models import ContentType
        from budget_approval.approver_access import (
            ORG_ADMIN_OVERRIDE_PREFIX,
            budget_request_has_admin_override,
        )
        from budget_approval.models import BudgetRequest
        from task.models import Task

        br = budget_request_under_review
        br.current_approver = org_admin
        br.save(update_fields=['current_approver'])

        task = br.task
        task.current_approver = org_admin
        task.content_type = ContentType.objects.get_for_model(br)
        task.object_id = br.id
        task.save(update_fields=['current_approver', 'content_type', 'object_id'])
        if task.status == Task.Status.DRAFT:
            task.submit()
            task.start_review()
            task.save()
        elif task.status == Task.Status.SUBMITTED:
            task.start_review()
            task.save()
        assert task.status == Task.Status.UNDER_REVIEW

        ProjectMember.objects.get_or_create(
            user=org_admin,
            project=project,
            defaults={'is_active': True},
        )

        api_client.force_authenticate(user=org_admin)
        api_client.credentials(
            HTTP_X_USER_ROLE='org_admin',
            HTTP_X_ORGANIZATION_SLUG=team.organization.slug,
        )

        url = reverse('task-make-approval', kwargs={'pk': task.slug})
        response = api_client.post(
            url,
            {'action': 'approve', 'comment': 'Admin is the assigned approver'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert ORG_ADMIN_OVERRIDE_PREFIX not in (
            response.data.get('approval_record', {}).get('comment') or ''
        )
        linked = response.data['task'].get('linked_object') or {}
        assert linked.get('is_admin_override') is False
        assert linked.get('admin_override') in (None, {})

        from django.db import connection
        from core.services.tenant import slug_to_schema_name

        schema = slug_to_schema_name(team.organization.slug)
        with connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO {schema}, public')
        br = BudgetRequest.objects.get(pk=br.pk)
        assert br.status == BudgetRequestStatus.APPROVED
        assert budget_request_has_admin_override(br) is False


@pytest.mark.django_db
@pytest.mark.timeout(600)
class TestBudgetPoolPermissions:
    """Test budget pool permissions"""
    
    def test_user_can_view_budget_pool(self, api_client, user1, budget_pool, team, user_role1, role_permissions):
        """Test user can view budget pool"""
        api_client.force_authenticate(user=user1)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id), HTTP_X_ORGANIZATION_SLUG=team.organization.slug)

        url = reverse('budget-pool-detail', kwargs={'pk': budget_pool.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_user_cannot_create_budget_pool(self, api_client, user3, project, ad_channel, team):
        """Test user cannot create budget pool (permission denied)"""
        # user3 has no role permissions, so should be denied
        api_client.force_authenticate(user=user3)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id))
        
        data = {
            'project': project.id,
            'ad_channel': ad_channel.id,
            'total_amount': '5000.00',
            'currency': 'AUD'
        }
        
        url = reverse('budget-pool-list')
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_user_cannot_update_budget_pool(self, api_client, user3, budget_pool, team):
        """Test user cannot update budget pool (permission denied)"""
        # user3 has no role permissions, so should be denied
        api_client.force_authenticate(user=user3)
        api_client.credentials(HTTP_X_USER_ROLE='team_member', HTTP_X_TEAM_ID=str(team.id), HTTP_X_ORGANIZATION_SLUG=team.organization.slug)
        
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
        # Super admin doesn't need team context but does need org slug for schema routing
        api_client.credentials(HTTP_X_USER_ROLE='admin', HTTP_X_ORGANIZATION_SLUG=team.organization.slug)
        
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
@pytest.mark.timeout(600)
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
@pytest.mark.timeout(600)
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