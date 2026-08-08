from django.db import models
from django.conf import settings
from django.utils import timezone
from core.models import TimeStampedModel, Organization, Team, Role, Permission

class RolePermission(TimeStampedModel):
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="role_permissions"
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="permission_roles"
    )

    class Meta:
        unique_together = ("role", "permission")

class UserRole(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_roles"
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="user_roles"
    )
    team = models.ForeignKey(
        Team,
        null=True, blank=True,
        on_delete=models.CASCADE
    )
    valid_from = models.DateTimeField(default=timezone.now)
    valid_to = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "role", "team")

class AdminOverrideAudit(TimeStampedModel):
    OVERRIDE_TYPE_CHOICES = [
        ('SUPERUSER', 'Superuser'),
        ('ORG_ADMIN', 'Organization Admin'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="admin_override_audits",
        help_text="The superuser or org admin who bypassed the normal permission check."
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="admin_override_audits",
        help_text="Organization context for the override, if known."
    )
    override_type = models.CharField(max_length=16, choices=OVERRIDE_TYPE_CHOICES)
    module = models.CharField(max_length=32, blank=True, null=True, help_text="Module key parsed from the request path, e.g. ASSET.")
    action = models.CharField(max_length=32, blank=True, null=True, help_text="Action key mapped from the HTTP method, e.g. EDIT.")
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=500)
    reason = models.TextField(blank=True, default='', help_text="Admin-provided justification for the override.")
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.user} ({self.override_type}) → {self.method} {self.path}"

class ModuleApprover(models.Model):
    MODULE_CHOICES = [
        ('ASSET', 'Asset Management'),
        ('CAMPAIGN', 'Campaign Execution'),
        ('BUDGET', 'Budget Approval'),
        ('REPORTING', 'Reporting'),
    ]
    module = models.CharField(max_length=32, choices=MODULE_CHOICES)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('module', 'user')