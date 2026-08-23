"""
Tests for budget_approval/serializers.py
Covers: BudgetRequestSerializer, ApprovalDecisionSerializer, BudgetPoolSerializer

Uses only safe fixtures (no tenant_schema, user_role*, role_permissions).
"""
import pytest
from decimal import Decimal

from budget_approval.models import BudgetPool, BudgetRequest, BudgetRequestStatus
from budget_approval.serializers import (
    BudgetRequestSerializer,
    BudgetPoolSerializer,
    ApprovalDecisionSerializer,
)


# ---------------------------------------------------------------------------
# BudgetRequestSerializer — read / SerializerMethodField tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBudgetRequestSerializerRead:

    def test_serializes_draft_request(self, budget_request_draft, user1, budget_pool, ad_channel):
        s = BudgetRequestSerializer(budget_request_draft)
        d = s.data
        assert d['id'] == budget_request_draft.id
        assert d['amount'] == '1000.00'
        assert d['currency'] == 'AUD'
        assert d['status'] == BudgetRequestStatus.DRAFT
        assert d['is_escalated'] is False
        assert d['is_admin_override'] is False
        assert d['admin_override'] is None

    def test_get_requested_by_returns_username(self, budget_request_draft, user1):
        s = BudgetRequestSerializer(budget_request_draft)
        # user1 has no first/last name → falls back to username
        assert s.data['requested_by'] == user1.username

    def test_get_requested_by_returns_full_name(self, budget_request_draft, user1):
        user1.first_name = 'Alice'
        user1.last_name = 'Smith'
        user1.save()
        budget_request_draft.requested_by = user1
        s = BudgetRequestSerializer(budget_request_draft)
        assert s.data['requested_by'] == 'Alice Smith'

    def test_get_budget_pool_dict(self, budget_request_draft, budget_pool, ad_channel):
        s = BudgetRequestSerializer(budget_request_draft)
        pool_data = s.data['budget_pool']
        assert pool_data is not None
        assert pool_data['id'] == budget_pool.id
        assert pool_data['currency'] == 'AUD'
        assert pool_data['total_amount'] == '10000.00'
        assert pool_data['available_amount'] == '10000.00'
        assert pool_data['ad_channel'] == ad_channel.name
        assert pool_data['ad_channel_id'] == ad_channel.id

    def test_get_current_approver_name_returns_username(self, budget_request_draft, user2):
        s = BudgetRequestSerializer(budget_request_draft)
        assert s.data['current_approver_name'] == user2.username

    def test_get_ad_channel_name(self, budget_request_draft, ad_channel):
        s = BudgetRequestSerializer(budget_request_draft)
        assert s.data['ad_channel_name'] == ad_channel.name


# ---------------------------------------------------------------------------
# BudgetRequestSerializer — validate() with task provided
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBudgetRequestSerializerValidateWithTask:

    def test_valid_with_explicit_budget_pool_id(self, user1, user2, task, budget_pool, ad_channel):
        data = {
            'task': task.id,
            'amount': '500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            'budget_pool_id': budget_pool.id,
        }
        s = BudgetRequestSerializer(data=data)
        assert s.is_valid(), s.errors
        assert s.validated_data['budget_pool'] == budget_pool

    def test_valid_auto_finds_pool_by_task_project(self, user1, user2, task, budget_pool, ad_channel):
        # Only one pool for (task.project, ad_channel, currency) → auto-find
        data = {
            'task': task.id,
            'amount': '500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
        }
        s = BudgetRequestSerializer(data=data)
        assert s.is_valid(), s.errors
        assert s.validated_data['budget_pool'] == budget_pool

    def test_invalid_pool_id_not_matching_ad_channel(
        self, user1, user2, task, budget_pool, ad_channel, project
    ):
        # Create another ad_channel and pass wrong budget_pool_id
        from core.models import AdChannel
        other_channel = AdChannel.objects.create(name="Other Channel", project=project)
        data = {
            'task': task.id,
            'amount': '500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': other_channel.id,
            'budget_pool_id': budget_pool.id,   # pool belongs to ad_channel, not other_channel
        }
        s = BudgetRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'budget_pool_id' in s.errors

    def test_auto_find_raises_when_no_pool_found(
        self, user1, user2, task, budget_pool, ad_channel, project
    ):
        # currency mismatch → no pool found
        data = {
            'task': task.id,
            'amount': '500.00',
            'currency': 'USD',   # pool is AUD
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
        }
        s = BudgetRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'budget_pool_id' in s.errors

    def test_auto_find_raises_when_multiple_pools_found(
        self, user1, user2, task, budget_pool, ad_channel, project
    ):
        # Create a second pool with the same (project, ad_channel, currency)
        BudgetPool.objects.create(
            project=project,
            ad_channel=ad_channel,
            total_amount=Decimal('5000.00'),
            used_amount=Decimal('0.00'),
            currency='AUD',
        )
        data = {
            'task': task.id,
            'amount': '500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
        }
        s = BudgetRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'budget_pool_id' in s.errors


# ---------------------------------------------------------------------------
# BudgetRequestSerializer — validate() without task
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBudgetRequestSerializerValidateWithoutTask:

    def test_valid_with_explicit_pool_id_no_task(self, user1, user2, budget_pool, ad_channel):
        data = {
            'amount': '500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            'budget_pool_id': budget_pool.id,
        }
        s = BudgetRequestSerializer(data=data)
        assert s.is_valid(), s.errors
        assert s.validated_data['budget_pool'] == budget_pool

    def test_raises_when_no_pool_and_no_task(self, user1, user2, ad_channel):
        data = {
            'amount': '500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            # No budget_pool_id and no task
        }
        s = BudgetRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'budget_pool_id' in s.errors

    def test_raises_when_pool_ad_channel_mismatch(
        self, user1, user2, budget_pool, ad_channel, project
    ):
        from core.models import AdChannel
        other_channel = AdChannel.objects.create(name="Mismatch Channel", project=project)
        data = {
            'amount': '500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': other_channel.id,
            'budget_pool_id': budget_pool.id,
        }
        s = BudgetRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'budget_pool_id' in s.errors

    def test_raises_when_pool_currency_mismatch(self, user1, user2, budget_pool, ad_channel):
        data = {
            'amount': '500.00',
            'currency': 'USD',   # pool is AUD
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            'budget_pool_id': budget_pool.id,
        }
        s = BudgetRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'budget_pool_id' in s.errors

    def test_raises_when_pool_id_not_found(self, user1, user2, ad_channel):
        data = {
            'amount': '500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            'budget_pool_id': 99999,
        }
        s = BudgetRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'budget_pool_id' in s.errors


# ---------------------------------------------------------------------------
# BudgetRequestSerializer — partial update (PATCH)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBudgetRequestSerializerPartialUpdate:

    def test_partial_update_skips_pool_validation(self, budget_request_draft):
        # Patch only notes — pool-related fields not provided
        s = BudgetRequestSerializer(
            budget_request_draft,
            data={'notes': 'New notes'},
            partial=True,
        )
        assert s.is_valid(), s.errors

    def test_partial_update_validates_when_pool_field_provided(
        self, budget_request_draft, budget_pool, ad_channel
    ):
        # When budget_pool_id is included in a PATCH, validation still runs
        s = BudgetRequestSerializer(
            budget_request_draft,
            data={
                'budget_pool_id': budget_pool.id,
                'ad_channel': ad_channel.id,
                'currency': 'AUD',
            },
            partial=True,
        )
        assert s.is_valid(), s.errors


# ---------------------------------------------------------------------------
# BudgetRequestSerializer — create()
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBudgetRequestSerializerCreate:

    def test_create_pops_budget_pool_id(self, user1, user2, task, budget_pool, ad_channel):
        data = {
            'task': task.id,
            'amount': '500.00',
            'currency': 'AUD',
            'current_approver': user2.id,
            'ad_channel': ad_channel.id,
            'budget_pool_id': budget_pool.id,
        }
        s = BudgetRequestSerializer(data=data)
        assert s.is_valid(), s.errors
        # Inject required requested_by field (done by view's perform_create in production)
        br = s.save(requested_by=user1)
        assert isinstance(br, BudgetRequest)
        assert br.budget_pool == budget_pool
        assert br.status == BudgetRequestStatus.DRAFT


# ---------------------------------------------------------------------------
# ApprovalDecisionSerializer
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestApprovalDecisionSerializer:

    def test_valid_approve_decision(self, user2):
        data = {
            'decision': 'approve',
            'comment': 'Approved!',
        }
        s = ApprovalDecisionSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_valid_reject_decision(self, user2):
        data = {
            'decision': 'reject',
            'comment': 'Not acceptable',
        }
        s = ApprovalDecisionSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_invalid_decision_choice(self):
        data = {
            'decision': 'hold',
            'comment': 'Waiting',
        }
        s = ApprovalDecisionSerializer(data=data)
        assert not s.is_valid()
        assert 'decision' in s.errors

    def test_comment_required(self):
        data = {
            'decision': 'approve',
        }
        s = ApprovalDecisionSerializer(data=data)
        assert not s.is_valid()
        assert 'comment' in s.errors

    def test_comment_cannot_be_blank(self):
        data = {
            'decision': 'approve',
            'comment': '',
        }
        s = ApprovalDecisionSerializer(data=data)
        assert not s.is_valid()
        assert 'comment' in s.errors

    def test_valid_with_next_approver(self, user2, user3):
        data = {
            'decision': 'approve',
            'comment': 'Forwarding',
            'next_approver': user3.id,
        }
        s = ApprovalDecisionSerializer(data=data)
        assert s.is_valid(), s.errors
        assert s.validated_data['next_approver'] == user3


# ---------------------------------------------------------------------------
# BudgetPoolSerializer
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBudgetPoolSerializer:

    def test_serializes_budget_pool(self, budget_pool, project, ad_channel):
        s = BudgetPoolSerializer(budget_pool)
        d = s.data
        assert d['id'] == budget_pool.id
        assert str(d['total_amount']) == '10000.00'
        assert str(d['used_amount']) == '0.00'
        assert str(d['available_amount']) == '10000.00'
        assert d['currency'] == 'AUD'
        assert d['ad_channel_name'] == ad_channel.name

    def test_creates_budget_pool(self, project, ad_channel):
        data = {
            'project': project.id,
            'ad_channel': ad_channel.id,
            'total_amount': '5000.00',
            'currency': 'USD',
        }
        s = BudgetPoolSerializer(data=data)
        assert s.is_valid(), s.errors
        pool = s.save()
        assert pool.pk is not None
        assert pool.used_amount == Decimal('0.00')
        assert pool.available_amount == Decimal('5000.00')

    def test_validate_used_amount_exceeds_total_raises(self, project, ad_channel):
        data = {
            'project': project.id,
            'ad_channel': ad_channel.id,
            'total_amount': '1000.00',
            'used_amount': '1500.00',   # > total_amount
            'currency': 'USD',
        }
        s = BudgetPoolSerializer(data=data)
        assert not s.is_valid()
        assert 'used_amount' in s.errors

    def test_validate_used_amount_equal_to_total_is_valid(self, project, ad_channel):
        data = {
            'project': project.id,
            'ad_channel': ad_channel.id,
            'total_amount': '1000.00',
            'used_amount': '1000.00',
            'currency': 'USD',
        }
        s = BudgetPoolSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_partial_update_validates_used_vs_total(self, budget_pool):
        # On PATCH, used_amount can't exceed existing total (10000)
        s = BudgetPoolSerializer(
            budget_pool,
            data={'used_amount': '99999.00'},
            partial=True,
        )
        assert not s.is_valid()
        assert 'used_amount' in s.errors

    def test_partial_update_valid(self, budget_pool):
        s = BudgetPoolSerializer(
            budget_pool,
            data={'used_amount': '5000.00'},
            partial=True,
        )
        assert s.is_valid(), s.errors
