from django.db import models
from django.contrib.auth import get_user_model
from django_fsm import FSMField, transition
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal
from core.models import Project, AdChannel
from task.models import Task
from access_control.models import Role, UserRole
from django.core.exceptions import ValidationError

User = get_user_model()


class BudgetRequestStatus(models.TextChoices):
    """Budget request status choices"""
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    LOCKED = 'LOCKED', 'Locked'
    CANCELLED = 'CANCELLED', 'Cancelled'


class BudgetPool(models.Model):
    """
    Budget Pool Model - Budget pool for specific 
    projects, advertising channels, and currency
    """
    name = models.CharField(max_length=200, blank=True, default='', help_text="Optional label to distinguish pools with the same channel/currency")
    project = models.ForeignKey(
      Project,
      on_delete=models.CASCADE,
      related_name='budget_pools',
      help_text="Associated project ID"
    )
    ad_channel = models.ForeignKey(
        AdChannel,
        on_delete=models.CASCADE,
        related_name='budget_pools',
        help_text="Advertising channel"
    )
    total_amount = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Total budget pool amount"
    )
    used_amount = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.00'))],
        default=Decimal('0.00'), 
        help_text="Amount of budget used from this pool"
    )
    currency = models.CharField(max_length=3, help_text="Currency code (e.g., AUD, USD)")
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        # Removed unique_together constraint to allow multiple pools with same (project, ad_channel, currency)
        verbose_name = "Budget Pool"
        verbose_name_plural = "Budget Pools"
        db_table = 'budget_pool'

    def __str__(self):
        return f"Budget Pool - Project {self.project.name}, Advertising Channel {self.ad_channel.name}, Currency {self.currency})"

    @property
    def available_amount(self):
        """Available budget amount"""
        return self.total_amount - self.used_amount

    def clean(self):
        """Validate budget pool fields"""
        super().clean()
        
        # Validate total_amount
        if self.total_amount < 0:
            raise ValidationError({
                'total_amount': 'Total amount cannot be negative.'
            })
        
        # Validate used_amount
        if self.used_amount < 0:
            raise ValidationError({
                'used_amount': 'Used amount cannot be negative.'
            })
        
        # Validate used_amount doesn't exceed total_amount
        if self.used_amount > self.total_amount:
            raise ValidationError({
                'used_amount': 'Used amount cannot exceed total amount.'
            })

    def can_allocate(self, amount):
        """Check if can allocate the specified amount"""
        return self.available_amount >= amount

    def allocate(self, amount):
        """Allocate amount from budget pool"""
        if not self.can_allocate(amount):
            raise ValidationError(f'Insufficient budget. Available: {self.available_amount}, Requested: {amount}')
        
        self.used_amount += amount
        self.save()


class BudgetRequest(models.Model):
    """
    Budget Request Model - Uses FSM for state management
    """
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='budget_requests',
        null=True,
        blank=True,
        help_text="Associated task ID"
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_budget_requests',
        help_text="Requesting user"
    )
    amount = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Requested budget amount"
    )
    currency = models.CharField(max_length=3, help_text="Currency code")
    status = FSMField(
        default=BudgetRequestStatus.DRAFT,
        choices=BudgetRequestStatus.choices,
        protected=True,
        help_text="Current status of the budget request"
    )
    submitted_at = models.DateTimeField(null=True, blank=True, help_text="Submission timestamp")
    is_escalated = models.BooleanField(default=False, help_text="Whether the request has been escalated")
    budget_pool = models.ForeignKey(
        BudgetPool,
        on_delete=models.PROTECT,
        related_name='budget_requests',
        help_text="Associated budget pool"
    )
    notes = models.TextField(blank=True, null=True, help_text="Additional notes")
    current_approver = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='pending_budget_requests',
        null=True,
        blank=True,
        help_text="Current approver assigned to this request"
    )
    ad_channel = models.ForeignKey(
        AdChannel,
        on_delete=models.CASCADE,
        related_name='budget_requests',
        help_text="Associated ad channel ID"
    )
    

    class Meta:
        verbose_name = "Budget Request"
        verbose_name_plural = "Budget Requests"
        db_table = 'budget_request'
        ordering = ['-submitted_at']

    def __str__(self):
        return f"Budget Request #{self.id} - {self.amount} {self.currency} ({self.get_status_display()})"

    # FSM state transition methods
    @transition(field=status, source=BudgetRequestStatus.DRAFT, target=BudgetRequestStatus.SUBMITTED)
    def submit(self):
        """Transition from DRAFT to SUBMITTED state"""
        self.submitted_at = timezone.now()

    @transition(field=status, source=BudgetRequestStatus.SUBMITTED, target=BudgetRequestStatus.UNDER_REVIEW)
    def send_for_review(self):
        """Transition from SUBMITTED to UNDER_REVIEW state"""
        pass

    @transition(field=status, source=BudgetRequestStatus.UNDER_REVIEW, target=BudgetRequestStatus.APPROVED)
    def approve(self):
        """Transition from UNDER_REVIEW to APPROVED state"""
        pass

    @transition(field=status, source=BudgetRequestStatus.UNDER_REVIEW, target=BudgetRequestStatus.REJECTED)
    def reject(self):
        """Transition from UNDER_REVIEW to REJECTED state"""
        pass

    @transition(field=status, source=BudgetRequestStatus.APPROVED, target=BudgetRequestStatus.LOCKED)
    def lock(self):
        """Transition from APPROVED to LOCKED state (after budget deduction)"""
        # Deduct amount from budget pool
        self.budget_pool.used_amount += self.amount
        self.budget_pool.save()

    @transition(field=status, source=[BudgetRequestStatus.REJECTED, BudgetRequestStatus.CANCELLED], target=BudgetRequestStatus.DRAFT)
    def revise(self):
        """Transition from REJECTED or CANCELLED back to DRAFT for revision"""
        pass

    @transition(
        field=status,
        source=[
            BudgetRequestStatus.DRAFT,
            BudgetRequestStatus.SUBMITTED,
            BudgetRequestStatus.UNDER_REVIEW,
            BudgetRequestStatus.APPROVED,
            BudgetRequestStatus.REJECTED,
            BudgetRequestStatus.LOCKED,
        ],
        target=BudgetRequestStatus.CANCELLED,
    )
    def cancel(self):
        """Cancel the budget request. If already locked, reverses the pool deduction."""
        if self.status == BudgetRequestStatus.LOCKED and self.budget_pool:
            self.budget_pool.used_amount = max(
                Decimal('0'), self.budget_pool.used_amount - self.amount
            )
            self.budget_pool.save()

    @transition(field=status, source=BudgetRequestStatus.APPROVED, target=BudgetRequestStatus.UNDER_REVIEW)
    def forward_to_next(self):
        """Transition from APPROVED to UNDER_REVIEW state for next approver"""
        pass


    def can_submit(self):
        """Check if can submit"""
        return self.status == BudgetRequestStatus.DRAFT

    def can_approve(self):
        """Check if can approve"""
        return self.status == BudgetRequestStatus.UNDER_REVIEW

    def can_reject(self):
        """Check if can reject"""
        return self.status == BudgetRequestStatus.UNDER_REVIEW

    def can_lock(self):
        """Check if can lock"""
        return self.status == BudgetRequestStatus.APPROVED or self.status == BudgetRequestStatus.REJECTED
    
    def can_revise(self):
        """Check if can revise"""
        return self.status == BudgetRequestStatus.REJECTED
    
    def can_forward(self):
        """Check if can forward to next approver"""
        return self.status == BudgetRequestStatus.APPROVED

    def clean(self):
        """Validate model fields"""
        super().clean()
        if self.amount <= 0:
            raise ValidationError({
                'amount': 'Amount must be greater than zero.'
            })


class BudgetEscalationRule(models.Model):
    """
    Budget Escalation Rule Model - Defines escalation rules for budget requests based on specific criteria
    """
    budget_pool = models.ForeignKey(
        BudgetPool,
        on_delete=models.CASCADE,
        related_name='budget_escalation_rules',
        help_text="Associated budget pool"
    )
    threshold_amount = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Escalation threshold amount"
    )
    threshold_currency = models.CharField(max_length=3, help_text="Threshold currency code")
    escalate_to_role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name='budget_escalation_rules',
        help_text="Target user role ID for escalation"
    )
    is_active = models.BooleanField(default=True, help_text="Whether this rule is active")

    class Meta:
        unique_together = ('budget_pool', 'threshold_currency')
        verbose_name = "Budget Escalation Rule"
        verbose_name_plural = "Budget Escalation Rules"
        db_table = 'budget_escalation_rule'

    def __str__(self):
        return (f"Escalation Rule - Budget Pool {self.budget_pool.id}, "
                f"Threshold: {self.threshold_amount} {self.threshold_currency}")

    def should_escalate(self, amount, currency):
        """Check if should escalate"""
        if currency != self.threshold_currency:
            print(f"Invalid currency: {currency} != {self.threshold_currency}")
            return False
        if not self.is_active:
            print(f"Rule is not active: {self.is_active}")
            return False
        return (currency == self.threshold_currency and 
                amount >= self.threshold_amount)

    def get_escalation_approvers(self):
        """Get list of users who can approve escalated budget requests based on the target role"""
        return list(UserRole.objects.filter(
            role=self.escalate_to_role,
            valid_to__isnull=True
        ).values_list('user', flat=True))

    def clean(self):
        """Validate model fields"""
        super().clean()
        if self.threshold_amount <= 0:
            raise ValidationError({
                'threshold_amount': 'Threshold amount must be greater than zero.'
            })
  