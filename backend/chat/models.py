from django.db import models
from django.conf import settings
from core.models import TimeStampedModel, Project, Team


class ChatType:
    """Chat type constants"""
    PRIVATE = 'private'
    GROUP = 'group'
    
    CHOICES = [
        (PRIVATE, 'Private Chat'),
        (GROUP, 'Group Chat'),
    ]


class Chat(TimeStampedModel):
    """
    Chat model representing a conversation between users.
    All chats must be associated with a project.
    
    Access Rules:
    - Private Chat: Users can chat if they are in the same Team OR same Project
    - Group Chat: All participants must be members of the associated Project
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='chats',
        help_text="Project this chat belongs to (required)"
    )
    type = models.CharField(
        max_length=20,
        choices=ChatType.CHOICES,
        default=ChatType.PRIVATE,
        help_text="Type of chat: private (1-on-1) or group"
    )
    name = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Name for group chats (optional for private chats)"
    )
    
    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['project', '-updated_at']),
            models.Index(fields=['type', '-updated_at']),
        ]
    
    def __str__(self):
        if self.type == ChatType.GROUP:
            return f"Group: {self.name or 'Unnamed'} (Project: {self.project.name})"
        return f"Private Chat (Project: {self.project.name})"
    
    def get_participant_users(self):
        """Get all active participant users in this chat"""
        return [p.user for p in self.participants.filter(is_active=True).select_related('user')]
    
    def is_user_participant(self, user):
        """Check if a user is an active participant in this chat"""
        return self.participants.filter(user=user, is_active=True).exists()
    
    @staticmethod
    def can_users_chat(user1, user2):
        """
        Check if two users can create a private chat.
        
        Rules:
        - Same Team: Users are in the same Team (via TeamMember)
        - OR Same Project: Users are in the same Project (via ProjectMember)
        
        Returns: (can_chat: bool, reason: str)
        """
        from core.models import TeamMember, ProjectMember
        
        # Check if users are in the same team
        user1_teams = set(TeamMember.objects.filter(user=user1).values_list('team_id', flat=True))
        user2_teams = set(TeamMember.objects.filter(user=user2).values_list('team_id', flat=True))
        
        if user1_teams & user2_teams:  # Intersection - same team
            return True, "same_team"
        
        # Check if users are in the same project
        user1_projects = set(ProjectMember.objects.filter(user=user1, is_active=True).values_list('project_id', flat=True))
        user2_projects = set(ProjectMember.objects.filter(user=user2, is_active=True).values_list('project_id', flat=True))
        
        if user1_projects & user2_projects:  # Intersection - same project
            return True, "same_project"
        
        return False, "no_common_team_or_project"
    
    def can_user_join(self, user):
        """
        Check if a user can join this chat.
        
        For group chats: User must be a member of the associated project
        For private chats: Check via can_users_chat with existing participants
        """
        from core.models import ProjectMember
        
        if self.type == ChatType.GROUP:
            # Group chat: Must be project member
            return ProjectMember.objects.filter(
                user=user,
                project=self.project,
                is_active=True
            ).exists()
        else:
            # Private chat: Check with existing participant
            participants = self.get_participant_users()
            if participants:
                can_chat, _ = self.can_users_chat(user, participants[0])
                return can_chat
            return False


class ChatStar(TimeStampedModel):
    """
    User-starred chat for sidebar ordering (Slack-style).
    Scoped per user; position orders stars within a project (via chat.project).
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_stars',
    )
    chat = models.ForeignKey(
        Chat,
        on_delete=models.CASCADE,
        related_name='stars',
    )
    position = models.PositiveIntegerField(
        default=0,
        help_text='Order within starred list for this user in the chat project',
    )

    class Meta:
        unique_together = [('user', 'chat')]
        ordering = ['position', 'id']
        indexes = [
            models.Index(fields=['user', 'position']),
            models.Index(fields=['user', 'chat']),
        ]

    def __str__(self):
        return f'{self.user_id} * {self.chat_id} @ {self.position}'


class ChatParticipant(TimeStampedModel):
    """
    Model representing a user's participation in a chat.
    Tracks join time, last read time, and activity status.
    """
    chat = models.ForeignKey(
        Chat,
        on_delete=models.CASCADE,
        related_name='participants'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_participations'
    )
    joined_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the user joined this chat"
    )
    last_read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time the user read messages in this chat (for quick unread count)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this user is still active in the chat"
    )
    
    class Meta:
        unique_together = ['chat', 'user']
        ordering = ['joined_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['chat', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.user.email} in {self.chat}"
    
    def get_unread_count(self):
        """
        Get count of unread messages for this participant.
        Uses last_read_at for quick calculation.
        
        NOTE: This is the SINGLE SOURCE OF TRUTH for unread count calculation.
        All serializers and services should delegate to this method.
        """
        if not self.last_read_at:
            # Never read, count all messages except own
            return self.chat.messages.filter(
                is_deleted=False
            ).exclude(sender=self.user).count()
        
        return self.chat.messages.filter(
            created_at__gt=self.last_read_at,
            is_deleted=False
        ).exclude(sender=self.user).count()


class AttachmentType:
    """Attachment type constants"""
    IMAGE = 'image'
    VIDEO = 'video'
    DOCUMENT = 'document'
    
    CHOICES = [
        (IMAGE, 'Image'),
        (VIDEO, 'Video'),
        (DOCUMENT, 'Document'),
    ]


def attachment_upload_path(instance, filename):
    """Generate upload path for attachments: chat/attachments/{chat_id}/{year}/{month}/{filename}"""
    from django.utils import timezone
    now = timezone.now()
    return f"chat/attachments/{instance.message.chat_id}/{now.year}/{now.month:02d}/{filename}"


class Message(TimeStampedModel):
    """
    Message model representing a text message in a chat.
    Once created, messages are persisted and accessible to all participants.
    """
    chat = models.ForeignKey(
        Chat,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
        help_text="User who sent this message"
    )
    content = models.TextField(
        blank=True,
        default='',
        help_text="Text content of the message"
    )
    has_attachments = models.BooleanField(
        default=False,
        help_text="Whether this message has attachments (for optimization)"
    )
    forwarded_from_message = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        related_name='forwarded_messages',
        null=True,
        blank=True,
        db_index=True,
        help_text="Original message that this message was forwarded from"
    )
    forwarded_from_sender_display = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Snapshot of original sender display name at forward time"
    )
    forwarded_from_created_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Snapshot of original message creation time at forward time"
    )
    is_deleted = models.BooleanField(default=False, help_text="Soft delete flag")
    deleted_at = models.DateTimeField(null=True, blank=True, help_text="When the message was soft deleted")

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['chat', 'created_at']),
            models.Index(fields=['sender', 'created_at']),
            models.Index(fields=['chat', '-created_at']),  # For latest messages
            models.Index(fields=['chat', 'is_deleted']),
        ]
    
    def __str__(self):
        preview = self.content[:50] + '...' if len(self.content) > 50 else self.content
        return f"{self.sender.email}: {preview}"
    
    def get_status_for_user(self, user):
        """Get the status of this message for a specific user"""
        try:
            status = self.statuses.get(user=user)
            return status.status
        except MessageStatus.DoesNotExist:
            return None


class MessageStatus(TimeStampedModel):
    """
    Tracks the delivery and read status of messages for each recipient.
    
    Status Flow:
    - sent: Message created (default)
    - delivered: Message delivered via WebSocket or user came online
    - read: User has read the message
    
    This enables:
    - "✓" (sent)
    - "✓✓" (delivered) 
    - "✓✓" blue (read)
    - Group chat: "Read by 3 of 5"
    """
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='statuses',
        help_text="The message this status refers to"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='message_statuses',
        help_text="The recipient user"
    )
    
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='sent',
        help_text="Current status of the message for this user"
    )
    
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the message was delivered to the user"
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the user read the message"
    )
    
    class Meta:
        unique_together = ['message', 'user']
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['message', 'status']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['message', 'user']),
        ]
        verbose_name_plural = 'Message statuses'
    
    def __str__(self):
        return f"{self.message.id} - {self.user.email}: {self.status}"
    
    def mark_as_delivered(self):
        """Mark message as delivered"""
        from django.utils import timezone
        if self.status == 'sent':
            self.status = 'delivered'
            self.delivered_at = timezone.now()
            self.save(update_fields=['status', 'delivered_at', 'updated_at'])
    
    def mark_as_read(self):
        """Mark message as read"""
        from django.utils import timezone
        if self.status in ['sent', 'delivered']:
            self.status = 'read'
            self.read_at = timezone.now()
            if not self.delivered_at:
                self.delivered_at = self.read_at
            self.save(update_fields=['status', 'delivered_at', 'read_at', 'updated_at'])


def temp_attachment_upload_path(instance, filename):
    """Generate upload path for temporary attachments before message is created"""
    from django.utils import timezone
    import uuid
    now = timezone.now()
    unique_id = uuid.uuid4().hex[:8]
    return f"chat/temp_attachments/{now.year}/{now.month:02d}/{unique_id}_{filename}"


class MessageAttachment(TimeStampedModel):
    """
    Attachment model for files attached to messages.
    Supports images, videos, and documents.
    
    Upload Flow:
    1. User selects file in frontend
    2. Frontend uploads file to /api/chat/attachments/ (creates temp attachment)
    3. User sends message with attachment IDs
    4. Backend links attachments to message
    """
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='attachments',
        null=True,
        blank=True,
        help_text="The message this attachment belongs to (null for temp uploads)"
    )
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='uploaded_attachments',
        help_text="User who uploaded this attachment"
    )
    file = models.FileField(
        upload_to=temp_attachment_upload_path,
        help_text="The uploaded file"
    )
    file_type = models.CharField(
        max_length=20,
        choices=AttachmentType.CHOICES,
        default=AttachmentType.DOCUMENT,
        help_text="Type of attachment: image, video, or document"
    )
    file_size = models.PositiveIntegerField(
        default=0,
        help_text="File size in bytes"
    )
    original_filename = models.CharField(
        max_length=255,
        help_text="Original filename as uploaded"
    )
    mime_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="MIME type of the file"
    )
    # Optional thumbnail for images/videos
    thumbnail = models.ImageField(
        upload_to='chat/thumbnails/',
        null=True,
        blank=True,
        help_text="Thumbnail for images and videos"
    )
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['message', 'created_at']),
            models.Index(fields=['uploader', 'created_at']),
            models.Index(fields=['file_type']),
        ]
    
    def __str__(self):
        return f"{self.original_filename} ({self.file_type})"
    
    @property
    def file_url(self):
        """Get the URL for the file"""
        if self.file:
            return self.file.url
        return None
    
    @property
    def thumbnail_url(self):
        """Get the URL for the thumbnail"""
        if self.thumbnail:
            return self.thumbnail.url
        return None
    
    @property
    def file_size_display(self):
        """Human-readable file size"""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
    
    @classmethod
    def get_file_type_from_mime(cls, mime_type):
        """Determine file type from MIME type"""
        if not mime_type:
            return AttachmentType.DOCUMENT
        
        mime_lower = mime_type.lower()
        if mime_lower.startswith('image/'):
            return AttachmentType.IMAGE
        elif mime_lower.startswith('video/'):
            return AttachmentType.VIDEO
        else:
            return AttachmentType.DOCUMENT
    
    @classmethod
    def validate_file(cls, file, file_type=None):
        """
        Validate file size and type.
        Returns (is_valid, error_message)
        """
        # File size limits in bytes
        SIZE_LIMITS = {
            AttachmentType.IMAGE: 10 * 1024 * 1024,     # 10 MB
            AttachmentType.VIDEO: 25 * 1024 * 1024,    # 25 MB
            AttachmentType.DOCUMENT: 20 * 1024 * 1024, # 20 MB
        }
        
        # Allowed MIME types
        ALLOWED_MIMES = {
            AttachmentType.IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            AttachmentType.VIDEO: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
            AttachmentType.DOCUMENT: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'text/plain',
                'text/csv',
            ],
        }
        
        # Determine file type from content type if not provided
        content_type = getattr(file, 'content_type', '')
        if not file_type:
            file_type = cls.get_file_type_from_mime(content_type)
        
        # Check file size
        max_size = SIZE_LIMITS.get(file_type, SIZE_LIMITS[AttachmentType.DOCUMENT])
        if file.size > max_size:
            max_mb = max_size / (1024 * 1024)
            return False, f"File too large. Maximum size for {file_type} is {max_mb:.0f} MB"
        
        # Check MIME type
        allowed = ALLOWED_MIMES.get(file_type, ALLOWED_MIMES[AttachmentType.DOCUMENT])
        if content_type and content_type.lower() not in allowed:
            return False, f"File type '{content_type}' is not allowed for {file_type}"
        
        return True, None
