import uuid
from django.db import models
from django.conf import settings

ACTION_CHOICES = [
    ('role.created',              'Role Created'),
    ('role.updated',              'Role Updated'),
    ('role.deleted',              'Role Deleted'),
    ('role.permissions_updated',  'Role Permissions Updated'),
    ('role.permissions_copied',   'Role Permissions Copied'),
    ('user_role.assigned',        'User Role Assigned'),
    ('user_role.removed',         'User Role Removed'),
    ('project.updated',           'Project Updated'),
    ('project.deleted',           'Project Deleted'),
    ('project.labels_updated',    'Project Labels Updated'),
    ('org.slug_updated',          'Org Slug Updated'),
    ('org.deleted',               'Org Deleted'),
    ('org.admin_assigned',        'Org Admin Assigned'),
    ('org.admin_removed',         'Org Admin Removed'),
]


class AdminAuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="admin_audit_events"
    )
    action      = models.CharField(max_length=64, choices=ACTION_CHOICES, db_index=True)
    target_type = models.CharField(max_length=64)
    target_id   = models.CharField(max_length=64)
    target_name = models.CharField(max_length=255, blank=True)
    before      = models.JSONField(null=True, blank=True)
    after       = models.JSONField(null=True, blank=True)
    timestamp   = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
