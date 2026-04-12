from django.db import models, transaction
from django.db.models import Max
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from django_fsm import FSMField, transition

from core.models import TimeStampedModel, Project

User = get_user_model()


class Decision(TimeStampedModel):
    class Status(models.TextChoices):
        PREDRAFT = 'PREDRAFT', 'Pre-Draft'
        DRAFT = 'DRAFT', 'Draft'
        AWAITING_APPROVAL = 'AWAITING_APPROVAL', 'Awaiting Approval'
        COMMITTED = 'COMMITTED', 'Committed'
        REVIEWED = 'REVIEWED', 'Reviewed'
        ARCHIVED = 'ARCHIVED', 'Archived'

    class RiskLevel(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'

    title = models.CharField(max_length=255, null=True, blank=True)
    context_summary = models.TextField(null=True, blank=True)
    reasoning = models.TextField(null=True, blank=True)
    risk_level = models.CharField(max_length=10, choices=RiskLevel.choices, null=True, blank=True)
    confidence = models.IntegerField(
        choices=[(1, '1'), (2, '2'), (3, '3'), (4, '4'), (5, '5')],
        null=True,
        blank=True,
    )
    status = FSMField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        protected=True,
    )

    requires_approval = models.BooleanField(default=False)
    planned_decision_date = models.DateTimeField(null=True, blank=True, help_text="The planned date for making this decision")
    committed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    is_reference_case = models.BooleanField(default=False)
    created_by_agent = models.BooleanField(default=False)
    agent_session_id = models.UUIDField(null=True, blank=True)
    is_pre_draft = models.BooleanField(default=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='decisions',
        null=True,
        blank=True,
    )
    project_seq = models.PositiveIntegerField()

    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='authored_decisions',
    )
    last_edited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='last_edited_decisions',
    )
    committed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='committed_decisions',
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_decisions',
    )

    class Meta:
        db_table = 'decisions'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'project_seq'],
                name='unique_project_decision_seq',
            ),
        ]

    def __str__(self):
        return f"Decision #{self.id}"

    def save(self, *args, **kwargs):
        if self.project_seq is None:
            if self.project_id:
                with transaction.atomic():
                    max_seq = (
                        Decision.objects.filter(project_id=self.project_id)
                        .aggregate(max_seq=Max("project_seq"))
                        .get("max_seq")
                    )
                    self.project_seq = (max_seq or 0) + 1
            else:
                # Allow decisions without a project to still satisfy NOT NULL project_seq.
                self.project_seq = 1
        super().save(*args, **kwargs)

    def _compute_requires_approval(self):
        self.requires_approval = self.risk_level == self.RiskLevel.HIGH
        return self.requires_approval

    def _build_validation_snapshot(self):
        selected_option = self.options.filter(is_selected=True).first()
        required_fields_present = all(
            [
                bool(self.context_summary),
                bool(self.reasoning),
                bool(self.risk_level),
                self.confidence is not None,
                self.signals.count() >= 1,
                self.options.count() >= 2,
                self.options.filter(is_selected=True).count() == 1,
            ]
        )
        return {
            "required_fields_present": required_fields_present,
            "selected_option_id": selected_option.id if selected_option else None,
            "risk_level": self.risk_level,
            "confidence": self.confidence,
            "context_summary_present": bool(self.context_summary),
            "signals_count": self.signals.count(),
            "options_count": self.options.count(),
            "selected_options_count": self.options.filter(is_selected=True).count(),
            "reasoning_present": bool(self.reasoning),
            "timestamp": timezone.now().isoformat(),
        }

    def validate_can_commit(self):
        if not self.pk:
            raise ValidationError("Decision must be saved before commit.")

        errors = {}
        if not self.context_summary:
            errors["context_summary"] = "Context summary is required before commit."
        if self.signals.count() < 1:
            errors["signals"] = "At least one signal is required before commit."
        if self.options.count() < 2:
            errors["options"] = "At least two options are required before commit."
        non_empty_options = self.options.exclude(text__isnull=True).exclude(text__exact="").count()
        if non_empty_options < 2:
            errors["options"] = "At least two non-empty options are required before commit."
        if self.options.filter(is_selected=True).count() != 1:
            errors["options_selected"] = "Exactly one option must be selected before commit."
        if not self.reasoning:
            errors["reasoning"] = "Reasoning is required before commit."
        if not self.risk_level:
            errors["risk_level"] = "Risk level is required before commit."
        if self.confidence is None:
            errors["confidence"] = "Confidence is required before commit."

        if errors:
            raise ValidationError(errors)

    @transition(field=status, source=Status.PREDRAFT, target=Status.DRAFT)
    def promote_to_draft(self):
        """Promote an agent-created pre-draft to a full draft."""
        pass

    @transition(
        field=status,
        source=[Status.PREDRAFT, Status.DRAFT],
        target=Status.COMMITTED,
        conditions=[lambda self: not self._compute_requires_approval()],
    )
    def commit(self, user=None):
        self.validate_can_commit()

        self.committed_at = timezone.now()
        self.committed_by = user

    @transition(
        field=status,
        source=[Status.PREDRAFT, Status.DRAFT],
        target=Status.AWAITING_APPROVAL,
        conditions=[lambda self: self._compute_requires_approval()],
    )
    def submit_for_approval(self, user=None):
        self.validate_can_commit()

        self.committed_at = timezone.now()
        self.committed_by = user

    @transition(field=status, source=Status.AWAITING_APPROVAL, target=Status.COMMITTED)
    def approve(self, user=None):
        self.validate_can_commit()

        self.approved_at = timezone.now()
        self.approved_by = user

    @transition(field=status, source=[Status.COMMITTED, Status.REVIEWED], target=Status.ARCHIVED)
    def archive(self, user=None):
        return None

    @transition(field=status, source=Status.COMMITTED, target=Status.REVIEWED)
    def mark_reviewed(self, user=None):
        return None


class DecisionEdge(TimeStampedModel):
    from_decision = models.ForeignKey(
        Decision,
        on_delete=models.CASCADE,
        related_name='outgoing_edges',
    )
    to_decision = models.ForeignKey(
        Decision,
        on_delete=models.CASCADE,
        related_name='incoming_edges',
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_decision_edges',
    )

    class Meta:
        db_table = 'decision_edges'
        constraints = [
            models.UniqueConstraint(
                fields=['from_decision', 'to_decision'],
                name='unique_decision_edge',
            ),
            models.CheckConstraint(
                check=~models.Q(from_decision=models.F('to_decision')),
                name='decision_edge_no_self_loop',
            ),
        ]


class Signal(TimeStampedModel):
    class Metric(models.TextChoices):
        ROAS = 'ROAS', 'ROAS'
        CPA = 'CPA', 'CPA'
        CONVERSION_RATE = 'CONVERSION_RATE', 'Conversion Rate'
        REVENUE = 'REVENUE', 'Revenue'
        PURCHASES = 'PURCHASES', 'Purchases'
        CTR = 'CTR', 'CTR'
        CLICKS = 'CLICKS', 'Clicks'
        IMPRESSIONS = 'IMPRESSIONS', 'Impressions'
        CPC = 'CPC', 'CPC'
        CPM = 'CPM', 'CPM'
        AD_SPEND = 'AD_SPEND', 'Ad Spend'
        AOV = 'AOV', 'AOV'

    class Movement(models.TextChoices):
        SHARP_INCREASE = 'SHARP_INCREASE', 'Sharp Increase'
        MODERATE_INCREASE = 'MODERATE_INCREASE', 'Moderate Increase'
        SLIGHT_INCREASE = 'SLIGHT_INCREASE', 'Slight Increase'
        NO_SIGNIFICANT_CHANGE = 'NO_SIGNIFICANT_CHANGE', 'No Significant Change'
        SLIGHT_DECREASE = 'SLIGHT_DECREASE', 'Slight Decrease'
        MODERATE_DECREASE = 'MODERATE_DECREASE', 'Moderate Decrease'
        SHARP_DECREASE = 'SHARP_DECREASE', 'Sharp Decrease'
        VOLATILE = 'VOLATILE', 'Volatile'
        UNEXPECTED_SPIKE = 'UNEXPECTED_SPIKE', 'Unexpected Spike'
        UNEXPECTED_DROP = 'UNEXPECTED_DROP', 'Unexpected Drop'

    class Period(models.TextChoices):
        LAST_24_HOURS = 'LAST_24_HOURS', 'Last 24 Hours'
        LAST_3_DAYS = 'LAST_3_DAYS', 'Last 3 Days'
        LAST_7_DAYS = 'LAST_7_DAYS', 'Last 7 Days'
        LAST_14_DAYS = 'LAST_14_DAYS', 'Last 14 Days'
        LAST_30_DAYS = 'LAST_30_DAYS', 'Last 30 Days'

    class Comparison(models.TextChoices):
        NONE = 'NONE', 'None'
        PREVIOUS_PERIOD = 'PREVIOUS_PERIOD', 'Previous Period'
        SAME_PERIOD_LAST_WEEK = 'SAME_PERIOD_LAST_WEEK', 'Same Period Last Week'
        SINCE_LAUNCH = 'SINCE_LAUNCH', 'Since Launch'

    class ScopeType(models.TextChoices):
        CAMPAIGN = 'CAMPAIGN', 'Campaign'
        AD_SET = 'AD_SET', 'Ad Set'
        AD = 'AD', 'Ad'
        CHANNEL = 'CHANNEL', 'Channel'
        AUDIENCE = 'AUDIENCE', 'Audience'
        REGION = 'REGION', 'Region'

    class DeltaUnit(models.TextChoices):
        PERCENT = 'PERCENT', 'Percent'
        CURRENCY = 'CURRENCY', 'Currency'
        ABSOLUTE = 'ABSOLUTE', 'Absolute'

    decision = models.ForeignKey(
        Decision,
        on_delete=models.CASCADE,
        related_name='signals',
    )
    author = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='decision_signals',
        null=True,
        blank=True,
    )
    metric = models.CharField(
        max_length=30,
        choices=Metric.choices,
        null=True,
        blank=True,
    )
    movement = models.CharField(
        max_length=30,
        choices=Movement.choices,
        null=True,
        blank=True,
    )
    period = models.CharField(
        max_length=20,
        choices=Period.choices,
        null=True,
        blank=True,
    )
    comparison = models.CharField(
        max_length=30,
        choices=Comparison.choices,
        default=Comparison.NONE,
    )
    scope_type = models.CharField(
        max_length=20,
        choices=ScopeType.choices,
        null=True,
        blank=True,
    )
    scope_value = models.CharField(max_length=255, null=True, blank=True)
    delta_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    delta_unit = models.CharField(
        max_length=20,
        choices=DeltaUnit.choices,
        null=True,
        blank=True,
    )
    display_text = models.TextField(blank=True, default="")
    display_text_override = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'decision_signals'
        ordering = ['-created_at']


class Option(TimeStampedModel):
    decision = models.ForeignKey(
        Decision,
        on_delete=models.CASCADE,
        related_name='options',
    )
    text = models.TextField()
    is_selected = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'decision_options'
        ordering = ['order', 'created_at']


class Review(TimeStampedModel):
    class DecisionQuality(models.TextChoices):
        GOOD = 'GOOD', 'Good'
        ACCEPTABLE = 'ACCEPTABLE', 'Acceptable'
        POOR = 'POOR', 'Poor'

    decision = models.ForeignKey(
        Decision,
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    reviewer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='decision_reviews',
    )
    outcome_text = models.TextField()
    reflection_text = models.TextField()
    quality = models.CharField(max_length=20, choices=DecisionQuality.choices)
    reviewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'decision_reviews'
        ordering = ['-reviewed_at']


class DecisionStateTransition(TimeStampedModel):
    decision = models.ForeignKey(
        Decision,
        on_delete=models.CASCADE,
        related_name='state_transitions',
    )
    from_status = models.CharField(max_length=20, choices=Decision.Status.choices)
    to_status = models.CharField(max_length=20, choices=Decision.Status.choices)
    transition_method = models.CharField(max_length=50)
    metadata = models.JSONField(null=True, blank=True)
    triggered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decision_transitions',
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    note = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'decision_state_transitions'
        ordering = ['-timestamp']


class CommitRecord(TimeStampedModel):
    decision = models.OneToOneField(
        Decision,
        on_delete=models.CASCADE,
        related_name='commit_record',
    )
    committed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decision_commit_records',
    )
    committed_at = models.DateTimeField(auto_now_add=True)
    validation_snapshot = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'decision_commit_records'
