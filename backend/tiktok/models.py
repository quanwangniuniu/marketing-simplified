import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django_fsm import FSMField, transition
from django.utils import timezone
from django.db.models import Max
import re


class TikTokCreative(models.Model):
    """
    Model for TikTok creative content (images, videos, music).
    """
    CREATIVE_TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Video'),
        ('music', 'Music'),
    ]
    
    # File status for virus scanning (same as metric_upload)
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
    type = models.CharField(max_length=10, choices=CREATIVE_TYPE_CHOICES)
    name = models.CharField(max_length=255)
    storage_path = models.CharField(max_length=500)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    size_bytes = models.BigIntegerField()
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_sec = models.FloatField(null=True, blank=True)
    md5 = models.CharField(max_length=32, unique=True)
    preview_url = models.URLField(max_length=1000)
    scan_status = FSMField(max_length=20, choices=STATUS_CHOICES, default=INCOMING, protected=True)
    uploaded_by = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='uploaded_tiktok_creatives')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'tiktok_creative'
        verbose_name = 'TikTok Creative'
        verbose_name_plural = 'TikTok Creatives'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.type})"
    
    # FSM Transitions for virus scanning
    @transition(field=scan_status, source=INCOMING, target=SCANNING)
    def start_scan(self):
        """Start virus scanning process"""
        self.updated_at = timezone.now()
    
    @transition(field=scan_status, source=SCANNING, target=READY)
    def mark_clean(self):
        """Mark file as clean after successful virus scan"""
        self.updated_at = timezone.now()
    
    @transition(field=scan_status, source=SCANNING, target=INFECTED)
    def mark_infected(self):
        """Mark file as infected after virus scan"""
        self.updated_at = timezone.now()
    
    @transition(field=scan_status, source=SCANNING, target=MISSING)
    def mark_missing(self):
        """Mark file as missing from storage"""
        self.updated_at = timezone.now()

    @transition(field=scan_status, source=SCANNING, target=ERROR_SCANNING)
    def mark_error_scanning(self):
        """Mark file as scanner error"""
        self.updated_at = timezone.now()


class AdGroup(models.Model):
    """
    Model for TikTok Ad Group.
    Groups multiple ad drafts together.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gid = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        blank=True,
        null=True,
        help_text="External display ID (e.g., G-2025-0001)"
    )
    name = models.CharField(max_length=255, help_text="Group name")
    created_by = models.ForeignKey(
        get_user_model(),
        on_delete=models.CASCADE,
        related_name='tiktok_ad_groups'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'tiktok_ad_group'
        verbose_name = 'TikTok Ad Group'
        verbose_name_plural = 'TikTok Ad Groups'
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"AdGroup: {self.name} ({self.gid})"
    
    @staticmethod
    def generate_gid():
        """Generate a new unique gid in format G-YYYY-NNNN"""
        current_year = timezone.now().year
        # Find the max gid for current year
        max_gid = AdGroup.objects.filter(gid__startswith=f"G-{current_year}-").aggregate(
            Max('gid')
        )['gid__max']
        
        if max_gid:
            # Extract the sequence number
            match = re.match(rf'G-{current_year}-(\d+)', max_gid)
            if match:
                next_seq = int(match.group(1)) + 1
            else:
                next_seq = 1
        else:
            next_seq = 1
        
        return f"G-{current_year}-{next_seq:04d}"
    
    def save(self, *args, **kwargs):
        if not self.gid:
            self.gid = AdGroup.generate_gid()
        super().save(*args, **kwargs)


class AdDraft(models.Model):
    """
    Model for saving TikTok ad draft information.
    Stores ad details that can be edited and previewed in the UI.
    """
    CTA_MODE_CHOICES = [
        ('dynamic', 'Dynamic'),
        ('standard', 'Standard'),
    ]
    
    CREATIVE_TYPE_CHOICES = [
        ('SINGLE_VIDEO', 'Single Video'),
        ('SINGLE_IMAGE', 'Single Image'),
        ('CAROUSEL_VIDEO', 'Carousel Video'),
        ('CAROUSEL_IMAGE', 'Carousel Image'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    aid = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        db_index=True,
        help_text="External display ID (e.g., AD-2025-001001)"
    )
    name = models.CharField(max_length=255, blank=True, null=True, help_text="Ad internal name")
    ad_text = models.TextField(blank=True, null=True, help_text="Ad text/copy")
    # Unified CTA as single string: None (disabled) | '' (dynamic) | 'Sign up' (standard label)
    call_to_action = models.CharField(
        max_length=100,
        null=True,
        blank=True, 
        help_text="CTA as single value: None=OFF, ''=DYNAMIC, non-empty=STANDARD label"
    )
    creative_type = models.CharField(
        max_length=20,
        choices=CREATIVE_TYPE_CHOICES,
        blank=True,
        null=True,
        help_text="Creative type (e.g., SINGLE_VIDEO, SINGLE_IMAGE)"
    )
    opt_status = models.IntegerField(
        default=0,
        help_text="Optimization status"
    )
    # Assets stored as JSON: { primaryCreative: { id, type, ... }, images: [{ id, type, ... }] }
    assets = models.JSONField(
        default=dict, 
        blank=True,
        help_text="Asset information including primary creative and image list"
    )
    ad_group = models.ForeignKey(
        'AdGroup',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ad_drafts',
        help_text="Ad group this draft belongs to"
    )
    created_by = models.ForeignKey(
        get_user_model(), 
        on_delete=models.CASCADE, 
        related_name='tiktok_ad_drafts'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    media_campaign = models.ForeignKey(
        'campaign.Campaign',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='tiktok_ad_drafts',
    )

    class Meta:
        db_table = 'tiktok_ad_draft'
        verbose_name = 'TikTok Ad Draft'
        verbose_name_plural = 'TikTok Ad Drafts'
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"AdDraft: {self.name or 'Unnamed'} ({self.aid or self.id})"
    
    @staticmethod
    def generate_aid():
        """Generate a new unique aid in format AD-YYYY-NNNNNN"""
        current_year = timezone.now().year
        # Find the max aid for current year
        max_aid = AdDraft.objects.filter(aid__startswith=f"AD-{current_year}-").aggregate(
            Max('aid')
        )['aid__max']
        
        if max_aid:
            # Extract the sequence number
            match = re.match(rf'AD-{current_year}-(\d+)', max_aid)
            if match:
                next_seq = int(match.group(1)) + 1
            else:
                next_seq = 1
        else:
            next_seq = 1
        
        return f"AD-{current_year}-{next_seq:06d}"
    
    def save(self, *args, **kwargs):
        if not self.aid:
            self.aid = AdDraft.generate_aid()
        super().save(*args, **kwargs)
    
    def infer_creative_type_from_assets(self):
        """Infer creative_type from assets JSON field"""
        if not self.assets:
            return None
        
        primary_creative = self.assets.get('primaryCreative')
        images = self.assets.get('images', [])
        
        if primary_creative:
            creative_type_str = primary_creative.get('type', '').lower()
            if creative_type_str == 'video':
                if images and len(images) > 0:
                    return 'CAROUSEL_VIDEO'
                return 'SINGLE_VIDEO'
            elif creative_type_str == 'image':
                if images and len(images) > 0:
                    return 'CAROUSEL_IMAGE'
                return 'SINGLE_IMAGE'
        
        return None


class PublicPreview(models.Model):
    """Publicly shareable snapshot of an AdDraft."""
    id = models.AutoField(primary_key=True)
    slug = models.CharField(max_length=64, unique=True, db_index=True)
    ad_draft = models.ForeignKey('AdDraft', on_delete=models.CASCADE, related_name='public_previews')
    version_id = models.CharField(max_length=64, help_text="Version identifier at time of snapshot")
    snapshot_json = models.JSONField(help_text="Minimal state to render preview, including signed media URLs")
    expires_at = models.DateTimeField(null=False, blank=False, help_text="Expiration date of the preview")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tiktok_public_preview'
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['ad_draft', 'created_at']),
            models.Index(fields=['expires_at']),  # Add index for cleanup queries
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Preview {self.slug} for {self.ad_draft_id}"
