from rest_framework import serializers
from django.contrib.auth import get_user_model
from decimal import Decimal
from .models import BudgetRequest, BudgetPool
from core.models import Project, AdChannel
from task.models import Task

User = get_user_model()


class BudgetRequestSerializer(serializers.ModelSerializer):
    """Budget Request Serializer"""
    task = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all(), required=False, allow_null=True)
    requested_by = serializers.SerializerMethodField()
    amount = serializers.DecimalField(max_digits=15, decimal_places=2, min_value=Decimal('0.01'))
    currency = serializers.CharField(max_length=3, min_length=3)
    status = serializers.ReadOnlyField()
    submitted_at = serializers.ReadOnlyField()
    is_escalated = serializers.SerializerMethodField()
    budget_pool_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    budget_pool = serializers.SerializerMethodField()
    current_approver = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)
    current_approver_name = serializers.SerializerMethodField()
    ad_channel = serializers.PrimaryKeyRelatedField(queryset=AdChannel.objects.all(), write_only=True)
    ad_channel_name = serializers.SerializerMethodField()

    class Meta:
        model = BudgetRequest
        fields = [
            'id', 'task', 'requested_by', 'amount', 'currency', 'status',
            'submitted_at', 'is_escalated', 'budget_pool', 'budget_pool_id',
            'notes', 'current_approver', 'current_approver_name', 'ad_channel', 'ad_channel_name',
        ]
        read_only_fields = ['id', 'requested_by', 'status', 'submitted_at', 'is_escalated', 'budget_pool']

    def get_requested_by(self, obj):
        u = obj.requested_by
        if not u:
            return None
        return u.get_full_name().strip() or u.username or u.email

    def get_is_escalated(self, obj):
        return obj.is_escalated

    def get_budget_pool(self, obj):
        p = obj.budget_pool
        if not p:
            return None
        return {
            'id': p.id,
            'name': p.name or None,
            'ad_channel': p.ad_channel.name if p.ad_channel else None,
            'ad_channel_id': p.ad_channel.id if p.ad_channel else None,
            'currency': p.currency,
            'total_amount': str(p.total_amount),
            'available_amount': str(p.available_amount),
        }

    def get_current_approver_name(self, obj):
        u = obj.current_approver
        if not u:
            return None
        return u.get_full_name().strip() or u.username or u.email

    def get_ad_channel_name(self, obj):
        return obj.ad_channel.name if obj.ad_channel else None
    
    def validate(self, attrs):
        """Validate budget request"""
        # On partial updates (PATCH), skip pool validation if none of the pool-related
        # fields are being changed.
        if self.partial and 'budget_pool_id' not in attrs and 'ad_channel' not in attrs and 'currency' not in attrs:
            return attrs

        # Extract budget_pool_id if provided
        budget_pool_id = attrs.get('budget_pool_id')
        task = attrs.get('task')
        ad_channel = attrs.get('ad_channel')
        currency = attrs.get('currency')

        # BudgetRequest Creation Logic
        if task:
            # Task exists: validate pool matches (ad_channel, currency)
            # Note: No longer require budget pool project to match task project
            if budget_pool_id:
                # Budget pool explicitly provided - validate it matches ad_channel and currency
                try:
                    budget_pool = BudgetPool.objects.get(
                        id=budget_pool_id,
                        ad_channel=ad_channel,
                        currency=currency
                    )
                    attrs['budget_pool'] = budget_pool
                except BudgetPool.DoesNotExist:
                    raise serializers.ValidationError({
                        'budget_pool_id': f'Budget pool with id {budget_pool_id} does not exist or does not match the ad channel and currency.'
                    })
            else:
                # Auto-find pool by (task.project, ad_channel, currency)
                # Note: Since multiple pools with same combination are allowed, this will raise error if multiple exist
                try:
                    budget_pool = self.find_budget_pool(task, ad_channel, currency)
                    attrs['budget_pool'] = budget_pool
                except BudgetPool.DoesNotExist:
                    raise serializers.ValidationError({
                        'budget_pool_id': 'No budget pool found for this task project, ad channel, and currency combination. Please select or create a budget pool first.'
                    })
                except BudgetPool.MultipleObjectsReturned:
                    raise serializers.ValidationError({
                        'budget_pool_id': 'Multiple budget pools found for this combination. Please explicitly select one by providing budget_pool_id.'
                    })
        else:
            # Task does not exist: budget_pool must be explicitly provided
            if not budget_pool_id:
                raise serializers.ValidationError({
                    'budget_pool_id': 'Budget pool is required when task is not provided.'
                })

            # Validate pool matches (ad_channel, currency)
            try:
                budget_pool = BudgetPool.objects.get(id=budget_pool_id)

                # Validate budget_pool matches ad_channel and currency
                if budget_pool.ad_channel != ad_channel:
                    raise serializers.ValidationError({
                        'budget_pool_id': f'Budget pool ad channel does not match. Pool has {budget_pool.ad_channel.name}, but request specifies {ad_channel.name}.'
                    })

                if budget_pool.currency != currency:
                    raise serializers.ValidationError({
                        'budget_pool_id': f'Budget pool currency does not match. Pool has {budget_pool.currency}, but request specifies {currency}.'
                    })

                attrs['budget_pool'] = budget_pool
            except BudgetPool.DoesNotExist:
                raise serializers.ValidationError({
                    'budget_pool_id': f'Budget pool with id {budget_pool_id} does not exist.'
                })

        return attrs

    def create(self, validated_data):
        """Create budget request - requested_by MUST be injected by View layer, not serializer"""
        # Remove budget_pool_id from validated_data (already resolved to budget_pool in validate())
        validated_data.pop('budget_pool_id', None)

        # CRITICAL: requested_by MUST NOT be set here
        # It MUST be injected by the View layer via perform_create()
        # This ensures separation of concerns and proper request context handling

        return super().create(validated_data)
    
    def find_budget_pool(self, task, ad_channel, currency):
        # Find the budget pool for this budget request via associated task and currency
        budget_pool = BudgetPool.objects.get(
            project=task.project,
            ad_channel=ad_channel,
            currency=currency
        )
        return budget_pool


class ApprovalDecisionSerializer(serializers.Serializer):
    """Approval Decision Serializer"""
    decision = serializers.ChoiceField(choices=['approve', 'reject'])
    comment = serializers.CharField(required=True, allow_blank=False)
    next_approver = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        required=False, 
        help_text="ID of next approver"
    )


class BudgetPoolSerializer(serializers.ModelSerializer):
    """Budget Pool Serializer"""
    name = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())
    ad_channel = serializers.PrimaryKeyRelatedField(queryset=AdChannel.objects.all())
    ad_channel_name = serializers.SerializerMethodField(read_only=True)
    total_amount = serializers.DecimalField(max_digits=15, decimal_places=2, min_value=Decimal('0.01'))
    used_amount = serializers.DecimalField(max_digits=15, decimal_places=2, min_value=Decimal('0.00'), default=Decimal('0.00'))
    currency = serializers.CharField(max_length=3, min_length=3)
    available_amount = serializers.ReadOnlyField()

    class Meta:
        model = BudgetPool
        fields = [
            'id', 'name', 'project', 'ad_channel', 'ad_channel_name', 'total_amount',
            'used_amount', 'available_amount', 'currency', 'created_at'
        ]
        read_only_fields = ['id', 'available_amount', 'ad_channel_name', 'created_at']

    def get_ad_channel_name(self, obj):
        return obj.ad_channel.name if obj.ad_channel else None

    def validate(self, attrs):
        """Validate budget pool constraints"""
        # Validate total_amount > 0 (handled by field validator)
        # Validate used_amount >= 0 (handled by field validator)

        # Validate used_amount <= total_amount
        total_amount = attrs.get('total_amount', self.instance.total_amount if self.instance else None)
        used_amount = attrs.get('used_amount', self.instance.used_amount if self.instance else Decimal('0.00'))

        if used_amount > total_amount:
            raise serializers.ValidationError({
                'used_amount': 'Used amount cannot exceed total amount.'
            })

        # Note: No validation between project and ad_channel relationship
        # Note: Multiple budget pools with the same (project, ad_channel, currency) combination are allowed

        return attrs

    def create(self, validated_data):
        """Create budget pool with default used_amount if not provided"""
        # Set used_amount to 0 if not provided
        if 'used_amount' not in validated_data:
            validated_data['used_amount'] = Decimal('0.00')

        return super().create(validated_data)




