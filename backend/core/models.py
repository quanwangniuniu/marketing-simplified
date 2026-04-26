from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.base_user import BaseUserManager
from django.utils.text import slugify

class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        abstract = True

class Organization(TimeStampedModel):
    name = models.CharField(max_length=200, unique=True)
    email_domain = models.CharField(max_length=100, blank=True, null=True, help_text="Email domain for SSO organization matching (e.g., 'agencyX.com')")
    parent_org = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='child_organizations'
    )
    desc = models.TextField(blank=True, null=True)
    is_parent = models.BooleanField(default=False)
    slug = models.SlugField(max_length=200, unique=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)
    
    def _generate_unique_slug(self):
        """Generate a unique slug from the organization name"""
        base_slug = slugify(self.name)
        slug = base_slug
        counter = 1
        
        # Keep checking until we find a unique slug
        while Organization.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
            
        return slug

    def __str__(self):
        return self.name

class Team(TimeStampedModel):
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name="teams"
    )
    name = models.CharField(max_length=200)
    parent = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='child_teams'
    )
    desc = models.TextField(blank=True, null=True)
    is_parent = models.BooleanField(default=False)

    class Meta:
        unique_together = ("organization", "name")

    def __str__(self):
        return f"{self.organization.name} / {self.name}"

# Team Role Constants
class TeamRole:
    """Team-level role constants"""
    LEADER = 2
    MEMBER = 3
    
    CHOICES = [
        (LEADER, 'Team Leader'),
        (MEMBER, 'Member'),
    ]
    
    @classmethod
    def get_role_name(cls, role_id):
        """Get role name by ID"""
        role_map = dict(cls.CHOICES)
        return role_map.get(role_id, 'Unknown')
    
    @classmethod
    def is_valid_role(cls, role_id):
        """Check if role ID is valid"""
        return role_id in [cls.LEADER, cls.MEMBER]
    
    @classmethod
    def can_manage_team(cls, role_id):
        """Check if role can manage team members"""
        return role_id == cls.LEADER

class TeamMember(TimeStampedModel):
    """Team membership model for managing user-team relationships"""
    user = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.CASCADE,
        related_name='team_memberships'
    )
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='members'
    )
    role_id = models.IntegerField(
        choices=TeamRole.CHOICES,
        default=TeamRole.MEMBER,
        help_text="Role of the user in this team"
    )

    class Meta:
        unique_together = ['user', 'team']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.team.name} ({TeamRole.get_role_name(self.role_id)})"

    @property
    def role_name(self):
        """Get the role name for this membership"""
        return TeamRole.get_role_name(self.role_id)

    @property
    def is_leader(self):
        """Check if this member is a team leader"""
        return self.role_id == TeamRole.LEADER

class Role(TimeStampedModel):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="roles",
        null=True,
        blank=True,
        help_text="Organization this role belongs to. Leave empty for super admin roles."
    )
    name = models.CharField(max_length=100)
    level = models.PositiveIntegerField(
        default=10,
        help_text="Lower number = higher privilege"
    )

    class Meta:
        unique_together = ("organization", "name")
        ordering = ["level"]

    def __str__(self):
        return f"{self.name} (Level {self.level})"

class Permission(TimeStampedModel):
    MODULE_CHOICES = [
        ("ASSET", "Asset"),
        ("CAMPAIGN", "Campaign"),
        ("BUDGET_REQUEST", "Budget Request"),
        ("BUDGET_POOL", "Budget Pool"),
        ("BUDGET_ESCALATION", "Budget Escalation"),
    ]
    ACTION_CHOICES = [
        ("VIEW", "View"),
        ("EDIT", "Edit"),
        ("APPROVE", "Approve"),
        ("DELETE", "Delete"),
        ("EXPORT", "Export"),
    ]

    module = models.CharField(max_length=20, choices=MODULE_CHOICES)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)

    class Meta:
        unique_together = ("module", "action")

    def __str__(self):
        return f"{self.module}:{self.action}"

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractUser):
    is_verified = models.BooleanField(default=False)
    email = models.EmailField(unique=True)
    verification_token = models.CharField(max_length=100, blank=True, null=True)
    #For password reset
    password_reset_token = models.CharField(max_length=100, blank=True, null=True)
    password_reset_token_expires_at = models.DateTimeField(blank=True, null=True)

    # For google auth
    google_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    google_registered = models.BooleanField(default=False)
    password_set = models.BooleanField(default=True)

    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    active_project = models.ForeignKey(
        'core.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='active_users',
        help_text="The currently active project for this user"
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = CustomUserManager()

    def __str__(self):
        return self.email 

class Project(TimeStampedModel):
    """
    Project model - Top-level container for all workspace activities.
    Stores media buyer configuration collected during onboarding wizard.
    """
    # SECTION 1: Project Basics
    name = models.CharField(max_length=200)
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Project description (optional)"
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="projects"
    )
    owner = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_projects',
        help_text="Project owner (defaults to creator, can be changed)"
    )
    
    # SECTION 2: Project Type & Work Model (multi-select)
    project_type = models.JSONField(
        default=list,
        blank=True,
        help_text="List of project types: ['paid_social', 'paid_search', 'programmatic', 'influencer_ugc', 'cross_channel', 'performance', 'brand_campaigns', 'app_acquisition']"
    )
    work_model = models.JSONField(
        default=list,
        blank=True,
        help_text="List of work models: ['solo_buyer', 'small_team', 'multi_team', 'external_agency']"
    )
    
    # SECTION 3: Advertising Platforms
    advertising_platforms = models.JSONField(
        default=list,
        blank=True,
        help_text="List of advertising platforms (e.g., ['meta', 'google_ads', 'tiktok', 'linkedin', 'snapchat', 'twitter', 'pinterest', 'programmatic_dsp', 'reddit'])"
    )
    
    # SECTION 4: Objectives & KPIs
    objectives = models.JSONField(
        default=list,
        blank=True,
        help_text="Multi-select objectives list (e.g., ['awareness', 'consideration'])"
    )
    kpis = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured KPI configuration: {'ctr': {'target': 0.02, 'suggested_by': ['awareness']}}"
    )
    target_kpi_value = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Target KPI value as text (e.g., 'CPA target: $65', 'ROAS target: 3.5')"
    )
    
    # SECTION 5: Budget & Pacing
    BUDGET_MANAGEMENT_CHOICES = [
        ('single_consolidated', 'Single consolidated budget'),
        ('platform_specific', 'Platform-specific budgets'),
        ('campaign_level', 'Campaign-level budgets (recommended)'),
        ('client_mandated', 'Client-mandated budget structure'),
    ]
    budget_management_type = models.CharField(
        max_length=50,
        choices=BUDGET_MANAGEMENT_CHOICES,
        null=True,
        blank=True,
        help_text="How budgets are managed in this project"
    )
    total_monthly_budget = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total expected monthly budget (used for pacing dashboards and alerts)"
    )
    pacing_enabled = models.BooleanField(
        default=False,
        help_text="Whether pacing insights and alerts are enabled"
    )
    budget_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional budget configuration (pacing settings, alerts, etc.)"
    )
    
    # SECTION 6: Audience & Targeting (Optional)
    PRIMARY_AUDIENCE_CHOICES = [
        ('broad_open', 'Broad / Open Targeting'),
        ('interests_based', 'Interests-Based Audience'),
        ('lookalike_similar', 'Lookalike / Similar Audiences'),
        ('remarketing', 'Remarketing'),
        ('custom_crm', 'Custom CRM-Based Audiences'),
        ('geographic', 'Geographic Targeting'),
    ]
    primary_audience_type = models.CharField(
        max_length=50,
        choices=PRIMARY_AUDIENCE_CHOICES,
        null=True,
        blank=True,
        help_text="Primary target audience type"
    )
    audience_targeting = models.JSONField(
        default=dict,
        blank=True,
        help_text="Audience targeting configuration: {target_regions: [...], geographic_details: {...}, etc.}"
    )

    def __str__(self):
        return self.name

class ProjectMember(TimeStampedModel):
    """Project membership model for managing user-project relationships"""
    user = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='members'
    )
    role = models.CharField(
        max_length=50,
        default='member',
        help_text="Role of the user in this project (e.g., 'owner', 'member', 'viewer')"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this membership is currently active"
    )

    class Meta:
        unique_together = ['user', 'project']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.project.name} ({self.role})"

class AdChannel(TimeStampedModel):
    name = models.CharField(max_length=200)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="ad_channels"
    )

    def __str__(self):
        return self.name


class ProjectInvitation(TimeStampedModel):
    """
    Model for storing project invitations sent to users who don't exist yet.
    When a user registers with the invited email, they'll automatically be added to the project.
    """
    email = models.EmailField(help_text="Email address of the invited user")
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='invitations',
        help_text="Project the user is being invited to"
    )
    role = models.CharField(
        max_length=50,
        default='member',
        help_text="Role the user will have in the project (e.g., 'owner', 'member', 'viewer')"
    )
    approved = models.BooleanField(
        default=False,
        help_text="Whether the invitation has been approved by a project owner"
    )
    approved_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_project_invitations',
        help_text="Owner who approved the invitation"
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the invitation was approved"
    )
    invited_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.CASCADE,
        related_name='sent_invitations',
        help_text="User who sent the invitation"
    )
    token = models.CharField(
        max_length=64,
        unique=True,
        help_text="Unique token for accepting the invitation"
    )
    accepted = models.BooleanField(
        default=False,
        help_text="Whether the invitation has been accepted"
    )
    accepted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the invitation was accepted"
    )
    expires_at = models.DateTimeField(
        help_text="When the invitation expires"
    )

    class Meta:
        unique_together = ['email', 'project', 'accepted']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'accepted']),
            models.Index(fields=['token']),
        ]

    def __str__(self):
        return f"Invitation to {self.email} for {self.project.name}"

    def is_expired(self):
        """Check if the invitation has expired"""
        from django.utils import timezone
        return timezone.now() > self.expires_at

    def is_valid(self):
        """Check if the invitation is valid (not accepted and not expired)"""
        return self.approved and not self.accepted and not self.is_expired()

