from django.db import models
from django.contrib.auth import get_user_model
from django_fsm import FSMField, transition

from core.models import TimeStampedModel  # Base model with created_at / updated_at fields
from django.utils import timezone

User = get_user_model()


class EmailDraft(TimeStampedModel):
    """
    Represents an editable email draft before sending or scheduling.
    Stores metadata (name, subject, status) and links to structured content blocks.
    """

    # Status choices for email draft lifecycle
    STATUS_DRAFT = "draft"
    STATUS_READY = "ready"  
    STATUS_SCHEDULED = "scheduled"
    STATUS_SENT = "sent"
    STATUS_ARCHIVED = "archived"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_READY, "Ready"),
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_SENT, "Sent"),
        (STATUS_ARCHIVED, "Archived"),
    ]

    # (Optional) The user who owns or created this draft
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="klaviyo_email_drafts",
    )

    # Internal name for identifying the email draft within the system
    name = models.CharField(max_length=255, blank=True)

    # Actual email subject line
    subject = models.CharField(max_length=255)

    # Current status of the email draft (draft, scheduled, sent, archived)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
    )
    media_campaign = models.ForeignKey(
        'campaign.Campaign',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='klaviyo_drafts',
    )

    def __str__(self) -> str:
        """
        Returns a readable representation for admin or debugging.
        Prefer showing the internal name if available.
        """
        if self.name:
            return f"{self.name} ({self.subject})"
        return self.subject


class ContentBlock(models.Model):
    """
    Represents a modular content block belonging to an EmailDraft.
    Each block may be text, image, button, header, divider, etc.
    Blocks are ordered to reconstruct full email content.
    """

    # Link back to the parent email draft
    email_draft = models.ForeignKey(
        EmailDraft,
        on_delete=models.CASCADE,
        related_name="blocks",
    )

    # Type of content (e.g. "header", "text", "image", "button")
    block_type = models.CharField(max_length=50)

    # JSON data for flexible block storage (text, options, layout metadata)
    content = models.JSONField(blank=True, null=True)

    # Render order within the email body
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        """
        Readable representation showing block type and order.
        """
        return f"{self.block_type} #{self.order} for draft {self.email_draft_id}"


class Workflow(TimeStampedModel):
    """
    Simple placeholder model representing a Klaviyo-like workflow.
    Triggers, actions, and automation logic may be added later.
    """

    # Human-readable workflow name
    name = models.CharField(max_length=255)

    # Whether the workflow is currently active
    is_active = models.BooleanField(default=True)

    email_drafts = models.ManyToManyField(
        EmailDraft,
        related_name="workflows",
        blank=True,
        help_text="Email drafts that can trigger this workflow when their status changes.",
    )

    trigger_draft_status = models.CharField(
        max_length=32,
        choices=EmailDraft.STATUS_CHOICES,
        default=EmailDraft.STATUS_READY,
        help_text="EmailDraft status that will trigger this workflow.",
    )

    def __str__(self) -> str:
        return self.name

class WorkflowExecutionLog(TimeStampedModel):
    """
    Stores execution records whenever a workflow is triggered by an EmailDraft status change.
    """

    TRIGGER_TYPE_DRAFT_STATUS_CHANGE = "draft_status_change"

    TRIGGER_TYPE_CHOICES = [
        (TRIGGER_TYPE_DRAFT_STATUS_CHANGE, "Draft Status Change"),
    ]

    STATUS_PENDING = "pending"
    STATUS_EXECUTED = "executed"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_EXECUTED, "Executed"),
        (STATUS_FAILED, "Failed"),
    ]

    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name="execution_logs",
    )
    email_draft = models.ForeignKey(
        EmailDraft,
        on_delete=models.CASCADE,
        related_name="execution_logs",
    )
    trigger_type = models.CharField(
        max_length=64,
        choices=TRIGGER_TYPE_CHOICES,
        default=TRIGGER_TYPE_DRAFT_STATUS_CHANGE,
    )
    trigger_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Snapshot of data when the trigger fired.",
    )
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )
    executed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)

    def mark_executed(self):
        self.status = self.STATUS_EXECUTED
        self.executed_at = timezone.now()
        self.save(update_fields=["status", "executed_at"])

    def mark_failed(self, error_message: str):
        self.status = self.STATUS_FAILED
        self.error_message = error_message
        self.executed_at = timezone.now()
        self.save(update_fields=["status", "error_message", "executed_at"])

    def __str__(self):
        return f"WorkflowExecutionLog(workflow={self.workflow_id}, draft={self.email_draft_id}, status={self.status})"


class KlaviyoImage(models.Model):
    """
    Model for Klaviyo email image assets.
    Stores uploaded images with metadata and handles virus scanning.
    """
    
    # File status for virus scanning
    INCOMING = 'incoming'
    SCANNING = 'scanning'
    READY = 'ready'
    INFECTED = 'infected'
    MISSING = 'missing'
    ERROR_SCANNING = 'error_scanning'
    
    STATUS_CHOICES = [
        (INCOMING, 'Incoming - File just uploaded'),
        (SCANNING, 'Scanning - Virus scan in progress'),
        (READY, 'Ready - File is safe and available'),
        (INFECTED, 'Infected - File contains virus/malware'),
        (MISSING, 'Missing - File missing from storage'),
        (ERROR_SCANNING, 'ErrorScanning - Scanner error occurred'),
    ]
    
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    storage_path = models.CharField(max_length=500)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    size_bytes = models.BigIntegerField()
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    md5 = models.CharField(max_length=32, unique=True)
    preview_url = models.URLField(max_length=1000)
    scan_status = FSMField(max_length=20, choices=STATUS_CHOICES, default=INCOMING, protected=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploaded_klaviyo_images')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'klaviyo_image'
        verbose_name = 'Klaviyo Image'
        verbose_name_plural = 'Klaviyo Images'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.original_filename})"
    
    # FSM Transitions for virus scanning
    @transition(field=scan_status, source=INCOMING, target=SCANNING)
    def start_scan(self):
        """Start virus scanning process"""
        self.updated_at = timezone.now()
    
    @transition(field=scan_status, source=SCANNING, target=READY)
    def mark_ready(self):
        """Mark file as safe and ready"""
        self.updated_at = timezone.now()
    
    @transition(field=scan_status, source=SCANNING, target=INFECTED)
    def mark_infected(self):
        """Mark file as infected"""
        self.updated_at = timezone.now()
    
    @transition(field=scan_status, source=[INCOMING, SCANNING], target=ERROR_SCANNING)
    def mark_error(self):
        """Mark scanning error"""
        self.updated_at = timezone.now()

