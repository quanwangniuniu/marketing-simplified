from contextlib import nullcontext
from django.db import models
from django.contrib.auth import get_user_model
from django_fsm import FSMField, transition
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.core.exceptions import ValidationError
from core.models import Project
import hashlib
from django.core.files.uploadedfile import UploadedFile

User = get_user_model()


class Task(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        LOCKED = 'LOCKED', 'Locked'
        CANCELLED = 'CANCELLED', 'Cancelled'

    # --- Core Fields ---
    summary = models.CharField(max_length=255, null=False, blank=False, help_text="The title of the task")
    description = models.TextField(null=True, blank=True)
    status = FSMField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        protected=True
    )
    owner = models.ForeignKey(
      User, 
      related_name='owned_tasks', 
      on_delete=models.SET_NULL, 
      null=True, 
      help_text="The user who owns the task"
    )
    current_approver = models.ForeignKey(
      User,
      related_name='tasks_to_approve',
      on_delete=models.SET_NULL,
      null=True,
      help_text="The user who is currently reviewing the task"
    )
    approval_chain = models.ForeignKey(
      'ApprovalChain',
      on_delete=models.SET_NULL,
      null=True,
      blank=True,
      related_name='tasks',
      help_text="The predefined approval chain assigned to this task (null = legacy single-approver mode)"
    )
    current_approval_step = models.PositiveIntegerField(
      null=True,
      blank=True,
      help_text="Current step number in the approval chain (1-based). Null if no chain is assigned."
    )
    project = models.ForeignKey(
      Project, 
      on_delete=models.CASCADE, 
      null=False, blank=False, 
      help_text="The project that the task belongs to"
    )
    due_date = models.DateField(null=True, blank=True, help_text="The due date of the task") # TODO: Modify according to escalation requirements
    planned_start_date = models.DateField(
        null=True,
        blank=True,
        help_text="The planned start date of the task",
    )
    type = models.CharField(
      max_length=50,
      choices=[
        ('budget', 'Budget'),
        ('asset', 'Asset'),
        ('retrospective', 'Retrospective'),
        ('report', 'Report'),
        ('execution', 'Execution'),
        ('scaling', 'Scaling'), 
        ('alert', 'Alert'),
        ('experiment', 'Experiment'),
        ('optimization', 'Optimization'),
        ('communication', 'Client Communication'),
        ('platform_policy_update', 'Platform Policy Update'),
      ],
      null=False,
      blank=False,
      help_text="Chosen type of the task") # For the convenience of frontend display/filtering/...

    # --- Priority Field ---
    class Priority(models.TextChoices):
        HIGHEST = 'HIGHEST', 'Highest'
        HIGH = 'HIGH', 'High'
        MEDIUM = 'MEDIUM', 'Medium'
        LOW = 'LOW', 'Low'
        LOWEST = 'LOWEST', 'Lowest'

    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        help_text="Priority level of the task"
    )

    # --- Anomaly Status ---
    anomaly_status = models.CharField(
        max_length=20,
        default='NORMAL',
        help_text='Anomaly status for the task'
    )

    # --- Start Date ---
    start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Task start date",
    )

    # --- Subtask Flag ---
    is_subtask = models.BooleanField(
        default=False,
        editable=False,
        help_text="Whether this task is a subtask. Once True, cannot be changed back."
    )

    # --- Order in Project ---
    order_in_project = models.IntegerField(
        default=0,
        help_text="Order of task within its project"
    )

    # --- Timestamps ---
    created_at = models.DateTimeField(auto_now_add=True, help_text="Task creation timestamp")
    updated_at = models.DateTimeField(auto_now=True, help_text="Task last update timestamp")
    # --- Revision Round ---
    revision_round = models.PositiveIntegerField(
        default=0,
        help_text="Tracks how many times this task has been resubmitted after rejection"
    )

    # --- Linked Task to the real model of chosen type (BudgetRequest, Asset, Retrospective, etc.) ---
    # For type "platform_policy_update", the payload is the single authoritative PlatformPolicyUpdate
    # instance, accessed via task.platform_policy_update (OneToOne reverse from policy.PlatformPolicyUpdate).
    content_type = models.ForeignKey(
      ContentType, 
      on_delete=models.CASCADE, 
      null=True, 
      blank=True, 
      help_text="Content type of the linked model"
    )
    object_id = models.CharField(
      max_length=255,
      null=True,
      blank=True,
      help_text="Id of the linked model"
    )
    linked_object = GenericForeignKey('content_type', 'object_id') # Virtual field: the instance of the linked model (BudgetRequest, Asset, Retrospective, etc.)

    # Draft-only: persisted create-panel state (frontend-owned schema)
    draft_payload = models.JSONField(
        null=True,
        blank=True,
        help_text="Draft form state captured from task create panel",
    )

    # Lineage: optional one-to-one link when this task was converted from a meeting action item.
    origin_action_item = models.OneToOneField(
        "meetings.MeetingActionItem",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="derived_task",
        help_text="Immutable lineage: meeting action item this task was converted from.",
    )

    def __str__(self):
        return f"Task #{self.id} - {self.summary} ({self.status})"

    # --- FSM Transition ---

    @transition(field=status, source=Status.DRAFT, target=Status.SUBMITTED)
    def submit(self):
        """User submits Task"""
        pass

    @transition(field=status, source=Status.SUBMITTED, target=Status.UNDER_REVIEW)
    def start_review(self):
        """Approver starts reviewing the task"""
        pass

    @transition(field=status, source=Status.UNDER_REVIEW, target=Status.APPROVED)
    def approve(self):
        """Approver approves the task"""
        pass

    @transition(field=status, source=Status.UNDER_REVIEW, target=Status.REJECTED)
    def reject(self):
        """Approver rejects the task"""
        pass

    @transition(field=status, source=Status.APPROVED, target=Status.LOCKED)
    def lock(self):
        """Approver locks the task"""
        pass

    @transition(field=status, source=Status.LOCKED, target=Status.APPROVED)
    def unlock(self):
        """Unlock a locked task, returning it to Approved"""
        pass

    @transition(field=status, source=[Status.SUBMITTED, Status.UNDER_REVIEW, Status.APPROVED, Status.REJECTED], target=Status.CANCELLED)
    def cancel(self):
        """User cancels the task"""
        pass

    @transition(field=status, source=[Status.REJECTED, Status.CANCELLED], target=Status.DRAFT)
    def revise(self):
        """Owner revises the task"""
        pass


    @transition(field=status, source=Status.APPROVED, target=Status.UNDER_REVIEW)
    def forward_to_next(self):
        """Owner forwards the task to the next approver"""
        pass

    # --- Approval Chain Helpers ---

    @staticmethod
    def find_approval_chain(project, task_type):
        """
        Find the most specific ApprovalChain for the given project and task_type.

        Matching priority (most specific first):
          1. project + task_type both match
          2. project matches, task_type is null (applies to all types in that project)
          3. task_type matches, project is null (applies to all projects)
        Returns None if no chain is configured.
        """
        return (
            ApprovalChain.objects.filter(project=project, task_type=task_type).first()
            or ApprovalChain.objects.filter(project=project, task_type__isnull=True).first()
            or ApprovalChain.objects.filter(project__isnull=True, task_type=task_type).first()
        )

    # --- Helpful Properties ---
    @property
    def is_linked(self):
        """Return True if the task is linked to a task type instance"""
        return bool(self.content_type_id and self.object_id and self.object_id.strip())

    @property
    def task_type(self):
        """Return the model name of the linked object (e.g. 'budgetRequest')"""
        if self.content_type:
            return self.content_type.model
        return None

    @property
    def linked_status(self):
        """Return the status of the linked object"""
        if self.linked_object and hasattr(self.linked_object, "status"):
            return self.linked_object.status
        return None    

    # --- Helper Methods ---

    # Link a task type instance to the task
    # by giving value to the content_type, object_id fields
    def link_to_object(self, instance):
        self.content_type = ContentType.objects.get_for_model(instance.__class__) # Bind the task type to the task
        self.object_id = str(instance.id) # The id of the task type instance (convert to string for CharField)
        self.save()
    
    # --- Task Relationship Methods ---
    
    def add_relationship(self, target_task, relationship_type):
        """Add a relationship to another task"""
        if not self.pk or not target_task.pk:
            raise ValidationError("Both tasks must be saved before creating a relationship.")
        if self.pk == target_task.pk:
            raise ValidationError("A task cannot have a relationship with itself.")
        TaskRelation.objects.get_or_create(
            source_task=self,
            target_task=target_task,
            relationship_type=relationship_type
        )
    
    def remove_relationship(self, target_task, relationship_type):
        """Remove a relationship with another task"""
        TaskRelation.objects.filter(
            source_task=self,
            target_task=target_task,
            relationship_type=relationship_type
        ).delete()
    
    def get_related_tasks(self, relationship_type, direction='outgoing'):
        """
        Get tasks related by a specific relationship type.
        
        Args:
            relationship_type: One of 'causes', 'blocks', 'clones', 'relates_to'
            direction: 'outgoing' (this task is source) or 'incoming' (this task is target)
        
        Returns:
            QuerySet of Task objects
        """
        if direction == 'outgoing':
            # This task is the source, get target tasks
            relationships = self.outgoing_relationships.filter(relationship_type=relationship_type)
            return Task.objects.filter(id__in=relationships.values_list('target_task_id', flat=True))
        else:  # incoming
            # This task is the target, get source tasks
            relationships = self.incoming_relationships.filter(relationship_type=relationship_type)
            return Task.objects.filter(id__in=relationships.values_list('source_task_id', flat=True))
    
    @property
    def causes(self):
        """Tasks that this task causes (outgoing)"""
        return self.get_related_tasks(TaskRelation.CAUSES, 'outgoing')
    
    @property
    def is_caused_by(self):
        """Tasks that cause this task (incoming)"""
        return self.get_related_tasks(TaskRelation.CAUSES, 'incoming')
    
    @property
    def blocks(self):
        """Tasks that this task blocks (outgoing)"""
        return self.get_related_tasks(TaskRelation.BLOCKS, 'outgoing')
    
    @property
    def is_blocked_by(self):
        """Tasks that block this task (incoming)"""
        return self.get_related_tasks(TaskRelation.BLOCKS, 'incoming')
    
    @property
    def clones(self):
        """Tasks that this task clones (outgoing)"""
        return self.get_related_tasks(TaskRelation.CLONES, 'outgoing')
    
    @property
    def is_cloned_by(self):
        """Tasks that clone this task (incoming)"""
        return self.get_related_tasks(TaskRelation.CLONES, 'incoming')
    
    @property
    def relates_to(self):
        """Tasks related to this task (bidirectional)"""
        # For relates_to, return both directions
        outgoing = self.get_related_tasks(TaskRelation.RELATES_TO, 'outgoing')
        incoming = self.get_related_tasks(TaskRelation.RELATES_TO, 'incoming')
        return (outgoing | incoming).distinct()
    
    # --- Task Hierarchy Methods ---
    
    def get_subtasks(self):
        """Get all subtasks of this task"""
        return Task.objects.filter(id__in=self.subtasks.values_list('child_task_id', flat=True))
    
    @property
    def parent_task(self):
        """Get the parent task of this task"""
        try:
            hierarchy = self.parent_relationship.first()
            return hierarchy.parent_task if hierarchy else None
        except AttributeError:
            return None
    
    # Note: is_subtask is now a database field, not a property
    # The field persists even if parent task is deleted
    
    @property
    def is_parent(self):
        """Check if this task has subtasks"""
        return self.subtasks.exists()
    
    def add_subtask(self, child_task):
        """Add a subtask to this task"""
        if not self.pk or not child_task.pk:
            raise ValidationError("Both tasks must be saved before creating a hierarchy relationship.")
        if self.pk == child_task.pk:
            raise ValidationError("A task cannot be a subtask of itself.")
        TaskHierarchy.objects.get_or_create(
            parent_task=self,
            child_task=child_task
        )
        # Mark child as subtask permanently
        if not child_task.is_subtask:
            child_task.is_subtask = True
            child_task.save(update_fields=['is_subtask'])
    
    def remove_subtask(self, child_task):
        """Remove a subtask relationship"""
        TaskHierarchy.objects.filter(
            parent_task=self,
            child_task=child_task
        ).delete()



class ApprovalRecord(models.Model):
    """
    Approval Record Model - Supports multi-step task approval process
    """
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='approval_records',
        help_text="Associated Task"
    )
    approved_by = models.ForeignKey(
        User,
        null=False,
        blank=False,
        on_delete=models.PROTECT, # The approver can be deleted, but the approval record should still exist
        related_name='task_approval_records',
        help_text="Approver user"
    )
    is_approved = models.BooleanField(null=False, blank=False, help_text="Whether approved")
    comment = models.TextField(null=True, blank=True, help_text="Reason for approval or rejection")
    decided_time = models.DateTimeField(auto_now_add=True, help_text="Decision timestamp")
    step_number = models.PositiveIntegerField(null=False, blank=False, help_text="Approval step number")
    # --- Revision Tracking ---
    revision_round = models.PositiveIntegerField(default=0, help_text="Revision round this approval record belongs to")
    has_rejection_history = models.BooleanField(default=False, help_text="Whether this task had prior rejections at time of this record")
    resubmitted_after_reject = models.BooleanField(default=False, help_text="Whether this record was created after a resubmission")

    class Meta:
        unique_together = ['task', 'step_number', 'revision_round']
        ordering = ['revision_round', 'step_number']


class ApprovalChain(models.Model):
    """
    Predefined approval chain configurable per project and/or task type.
    Defines the ordered sequence of approvers (e.g. Buyer → Lead → Client).

    Matching priority (most specific wins):
      1. project + task_type both match
      2. project matches, task_type is null (applies to all types in project)
      3. task_type matches, project is null (applies to all projects)
    """

    TASK_TYPE_CHOICES = [
        ('budget', 'Budget'),
        ('asset', 'Asset'),
        ('retrospective', 'Retrospective'),
        ('report', 'Report'),
        ('execution', 'Execution'),
        ('scaling', 'Scaling'),
        ('alert', 'Alert'),
        ('experiment', 'Experiment'),
        ('optimization', 'Optimization'),
        ('communication', 'Client Communication'),
        ('platform_policy_update', 'Platform Policy Update'),
    ]

    name = models.CharField(
        max_length=100,
        help_text="Display name for this approval chain (e.g. 'Buyer → Lead → Client')"
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='approval_chains',
        help_text="Project this chain applies to. Leave blank to apply across all projects."
    )
    task_type = models.CharField(
        max_length=50,
        choices=TASK_TYPE_CHOICES,
        null=True,
        blank=True,
        help_text="Task type this chain applies to. Leave blank to apply to all task types."
    )
    required_approvals = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text=(
            "Minimum number of approved ApprovalRecords required before the task can be locked. "
            "Defaults to total_steps (all steps must be approved) when null."
        )
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Note: Database-level CheckConstraint is not used here due to SQLite incompatibility
        # (isnull=False in Q objects generates invalid SQL on SQLite).
        # Validation is enforced at the application layer via clean() below.
        pass

    def clean(self):
        from django.core.exceptions import ValidationError
        if not self.project_id and not self.task_type:
            raise ValidationError(
                "An ApprovalChain must have at least one of 'project' or 'task_type' set."
            )

    @property
    def total_steps(self):
        """Total number of steps in this chain."""
        return self.steps.count()

    @property
    def effective_required_approvals(self):
        """
        The effective minimum approval count before locking is allowed.
        Falls back to total_steps when required_approvals is not explicitly set.
        """
        return self.required_approvals if self.required_approvals is not None else self.total_steps

    def get_step(self, step_number):
        """Return the ApprovalChainStep for the given 1-based step number, or None."""
        return self.steps.filter(order=step_number).first()

    def __str__(self):
        parts = []
        if self.project:
            parts.append(f"project={self.project.name}")
        if self.task_type:
            parts.append(f"type={self.task_type}")
        return f"ApprovalChain '{self.name}' ({', '.join(parts)})"


class ApprovalChainStep(models.Model):
    """
    A single step in an ApprovalChain.
    Each step specifies the approver and its position (order) in the chain.
    """

    chain = models.ForeignKey(
        ApprovalChain,
        on_delete=models.CASCADE,
        related_name='steps',
        help_text="The approval chain this step belongs to"
    )
    order = models.PositiveIntegerField(
        help_text="Position of this step in the chain (1-based, e.g. 1 = Buyer, 2 = Lead, 3 = Client)"
    )
    approver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='approval_chain_steps',
        help_text="User responsible for approving at this step"
    )

    class Meta:
        unique_together = ['chain', 'order']
        ordering = ['order']

    def __str__(self):
        return f"Step {self.order} of '{self.chain.name}': {self.approver}"


class TaskComment(models.Model):
    """
    Task-level comment model. Comments are attached directly to Task,
    regardless of the underlying type (budget, asset, retrospective, report, etc.).
    """
    id = models.AutoField(primary_key=True)
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='comments',
        help_text="Associated Task"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='task_comments',
        help_text="User who made the comment"
    )
    body = models.TextField()
    content = models.JSONField(
        blank=True,
        default=list,
        help_text="Structured JSON content for rich text comment rendering",
    )
    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='children',
        help_text="Parent comment for threaded replies",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'task_comments'
        ordering = ['-created_at']

    def __str__(self):
        return f"Comment by {self.user_id} on Task {self.task_id}"


class TaskAttachment(models.Model):
    """Task attachment model for storing files attached to tasks"""
    
    # Scan Status Constants
    PENDING = 'pending'
    SCANNING = 'scanning'
    CLEAN = 'clean'
    INFECTED = 'infected'
    ERROR_SCANNING = 'error_scanning'
    
    SCAN_STATUS_CHOICES = [
        (PENDING, 'Pending'),
        (SCANNING, 'Scanning'),
        (CLEAN, 'Clean'),
        (INFECTED, 'Infected'),
        (ERROR_SCANNING, 'Error Scanning'),
    ]
    
    id = models.AutoField(primary_key=True)
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='attachments',
        help_text="Associated Task"
    )
    file = models.FileField(
        upload_to='task/attachments/%Y/%m/%d/',
        max_length=500,
        help_text="Uploaded file"
    )
    original_filename = models.CharField(
        max_length=255,
        help_text="Original filename before upload"
    )
    file_size = models.PositiveIntegerField(
        help_text="File size in bytes"
    )
    content_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="MIME type of the file"
    )
    checksum = models.CharField(
        max_length=64,
        blank=True,
        help_text="SHA-256 checksum of the file"
    )
    scan_status = FSMField(
        max_length=20,
        choices=SCAN_STATUS_CHOICES,
        default=PENDING,
        protected=False,
        help_text="Virus scan status"
    )
    comment = models.ForeignKey(
        TaskComment,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='comment_attachments',
        help_text="Associated comment (if this is a comment attachment)",
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='task_attachments',
        help_text="User who uploaded the file"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'task_attachments'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Attachment {self.id} for Task {self.task_id}: {self.original_filename}"
    
    def save(self, *args, **kwargs):
        """Override save to compute checksum if file is provided"""
        if self.file and not self.checksum:
            # Compute checksum for new files
            self.checksum = self.compute_checksum(self.file)
        super().save(*args, **kwargs)
    
    def compute_checksum(self, file_obj: UploadedFile) -> str:
        """Calculate SHA-256 hex digest of a Django File/UploadedFile"""
        if file_obj is None:
            return ''
        file_obj.seek(0)
        sha256 = hashlib.sha256()
        for chunk in file_obj.chunks():
            sha256.update(chunk)
        file_obj.seek(0)
        return sha256.hexdigest()
    
    # Scan Status Transitions
    
    @transition(field=scan_status, source=PENDING, target=SCANNING)
    def start_scan(self):
        """Start virus scanning"""
        TaskAttachment.objects.filter(pk=self.pk).update(scan_status=TaskAttachment.SCANNING)
    
    @transition(field=scan_status, source=SCANNING, target=CLEAN)
    def mark_clean(self):
        """Mark file as clean"""
        TaskAttachment.objects.filter(pk=self.pk).update(scan_status=TaskAttachment.CLEAN)
    
    @transition(field=scan_status, source=SCANNING, target=INFECTED)
    def mark_infected(self):
        """Mark file as infected"""
        TaskAttachment.objects.filter(pk=self.pk).update(scan_status=TaskAttachment.INFECTED)
    
    @transition(field=scan_status, source=SCANNING, target=ERROR_SCANNING)
    def mark_error_scanning(self):
        """Mark scan as error"""
        TaskAttachment.objects.filter(pk=self.pk).update(scan_status=TaskAttachment.ERROR_SCANNING)


class TaskRelation(models.Model):
    """
    Task-to-task relationship model. Supports bidirectional many-to-many relationships.
    Relationships are stored in one direction and inverse relationships are derived through queries.
    """
    
    # Relationship Type Constants
    CAUSES = 'causes'
    BLOCKS = 'blocks'
    CLONES = 'clones'
    RELATES_TO = 'relates_to'
    
    RELATIONSHIP_TYPE_CHOICES = [
        (CAUSES, 'Causes'),
        (BLOCKS, 'Blocks'),
        (CLONES, 'Clones'),
        (RELATES_TO, 'Relates To'),
    ]
    
    source_task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='outgoing_relationships',
        help_text="Source task in the relationship"
    )
    target_task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='incoming_relationships',
        help_text="Target task in the relationship"
    )
    relationship_type = models.CharField(
        max_length=20,
        choices=RELATIONSHIP_TYPE_CHOICES,
        null=False,
        blank=False,
        help_text="Type of relationship"
    )
    
    class Meta:
        db_table = 'task_relations'
        unique_together = ['source_task', 'target_task', 'relationship_type']
        indexes = [
            models.Index(fields=['source_task', 'relationship_type']),
            models.Index(fields=['target_task', 'relationship_type']),
        ]
    
    def __str__(self):
        return f"Task {self.source_task_id} {self.get_relationship_type_display()} Task {self.target_task_id}"
    
    def clean(self):
        """Validate that source_task and target_task are different"""
        if self.source_task_id and self.target_task_id and self.source_task_id == self.target_task_id:
            raise ValidationError("A task cannot have a relationship with itself.")
    
    def save(self, *args, **kwargs):
        """Override save to run validation"""
        self.clean()
        super().save(*args, **kwargs)


class TaskHierarchy(models.Model):
    """
    Task hierarchy model for storing parent-subtask relationships.
    Supports only 1-level nesting (subtasks cannot have subtasks).
    """
    
    parent_task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='subtasks',
        help_text="Parent task"
    )
    child_task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='parent_relationship',
        help_text="Child task (subtask)"
    )
    
    class Meta:
        db_table = 'task_hierarchies'
        unique_together = ['parent_task', 'child_task']
        indexes = [
            models.Index(fields=['parent_task']),
            models.Index(fields=['child_task']),
        ]
    
    def __str__(self):
        return f"Task {self.parent_task_id} -> Task {self.child_task_id}"
    
    def clean(self):
        """Validate hierarchy constraints"""
        if self.parent_task_id and self.child_task_id:
            # Prevent self-reference
            if self.parent_task_id == self.child_task_id:
                raise ValidationError("A task cannot be a subtask of itself.")
            
            # Exclude current instance when checking for existing relationships
            existing_qs = TaskHierarchy.objects.exclude(pk=self.pk) if self.pk else TaskHierarchy.objects.all()
            
            # Prevent subtasks from having subtasks (1-level nesting constraint)
            # Check if child_task is already a parent in any hierarchy
            if existing_qs.filter(parent_task_id=self.child_task_id).exists():
                raise ValidationError("A subtask cannot have subtasks. Only 1 level of nesting is allowed.")
            
            # Prevent circular references
            # Check if parent_task is a subtask of child_task
            if existing_qs.filter(parent_task_id=self.child_task_id, child_task_id=self.parent_task_id).exists():
                raise ValidationError("Circular reference detected: tasks cannot be subtasks of each other.")
    
    def save(self, *args, **kwargs):
        """Override save to run validation"""
        self.clean()
        super().save(*args, **kwargs)
