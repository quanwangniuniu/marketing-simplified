# Ticket Resolution Report

---

## Ticket Overview

| Field      | Details                                      |
|------------|----------------------------------------------|
| Ticket ID  | MED-344                                      |
| Title      | Admin Audit Log — Before/After Diff Viewer   |
| Assignee   | yulinliu                                     |
| Sprint     | TBD                                          |
| Status     | In Progress                                  |

---

## Problem Description

### Background

Admin actions that modify roles, projects, or org settings are currently not tracked in any way. When a role is updated, permissions are changed, or an org setting is modified, there is no record of what changed, who changed it, or when it happened. Other admins have no way to review what happened or why.

### Impact

- No auditability for sensitive admin operations (role changes, permission updates, org settings)
- No way to investigate incidents or unauthorized changes
- No before/after record to understand what was modified

### Related Modules

- `access_control` — role and permission management views
- `core` — project and organization management views
- `audit` — new module created

---

## Resolution Summary

### Approach

**Utility Function** — Created a standalone `audit` Django app containing an `AdminAuditEvent` model and helper utility functions (`capture_snapshot`, `record_audit_entry`). These functions are called explicitly inside each of the ~14 affected admin endpoints. Business write and audit write are wrapped in `transaction.atomic()` to guarantee atomicity.

### Why Utility Function

- ~14 endpoints in scope — a Mixin or event-driven approach would be over-engineering
- Explicit calls are transparent and easy to trace during debugging
- `transaction.atomic()` ensures audit record and business record are always consistent
- Follows the same pattern already used in `meetings/audit.py`
- Standalone `audit` app can evolve into a Mixin or Kafka-based solution later without touching the audit core logic

### Multi-tenant Design Decision

`AdminAuditEvent` is registered in `core/tenant_config.py` so the table is created inside each org's PostgreSQL schema, not in public. This ensures complete data isolation between organizations — one org's admins cannot see another org's audit log.

### Affected Endpoints

| Endpoint | Method | Action |
|----------|--------|--------|
| `/api/access_control/roles/` | POST | `role.created` |
| `/api/access_control/roles/<id>/` | PUT | `role.updated` |
| `/api/access_control/roles/<id>/` | DELETE | `role.deleted` |
| `/api/access_control/roles/<id>/permissions/` | POST | `role.permissions_updated` |
| `/api/access_control/roles/<id>/copy-permissions/` | POST | `role.permissions_copied` |
| `/api/access_control/users/<id>/roles/` | POST | `user_role.assigned` |
| `/api/access_control/users/<id>/roles/<id>/` | DELETE | `user_role.removed` |
| `/api/core/projects/<id>/` | PATCH | `project.updated` |
| `/api/core/projects/<id>/` | DELETE | `project.deleted` |
| `/api/core/projects/<id>/decision-topic-labels/` | PATCH | `project.labels_updated` |
| `/api/core/organizations/<id>/slug/` | PATCH | `org.slug_updated` |
| `/api/core/organizations/<id>/` | DELETE | `org.deleted` |
| `/api/core/admin/organizations/<id>/assign-admin/` | POST | `org.admin_assigned` |
| `/api/core/admin/organizations/<id>/remove-admin/` | POST | `org.admin_removed` |

### Database Migrations

No migrations. `AdminAuditEvent` table is created per-org schema via `provision_tenant_schema` (registered in `core/tenant_config.py`). No migration files are committed for the `audit` app.

---

## Code Logic

### New Files

<details>
<summary>audit/models.py — AdminAuditEvent model</summary>

```python
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
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="admin_audit_events")
    action      = models.CharField(max_length=64, choices=ACTION_CHOICES, db_index=True)
    target_type = models.CharField(max_length=64)
    target_id   = models.CharField(max_length=64)
    target_name = models.CharField(max_length=255, blank=True)
    before      = models.JSONField(null=True, blank=True)
    after       = models.JSONField(null=True, blank=True)
    timestamp   = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
```

</details>

<details>
<summary>audit/utils.py — capture_snapshot() and record_audit_entry()</summary>

```python
from typing import Any, Dict, Optional
from django.forms.models import model_to_dict
from .models import AdminAuditEvent, ACTION_CHOICES

def capture_snapshot(instance) -> Dict[str, Any]:
    """Serialize a Django model instance to a JSON-safe dict for before/after storage."""
    data = model_to_dict(instance)
    for field in ("id", "created_at", "updated_at"):
        if hasattr(instance, field):
            value = getattr(instance, field)
            data[field] = str(value) if value is not None else None
    return data

def record_audit_entry(actor, action: str, target, before=None, after=None) -> AdminAuditEvent:
    """Write one immutable audit record. Must be called inside transaction.atomic()."""
    valid_actions = {code for code, _ in ACTION_CHOICES}
    if action not in valid_actions:
        raise ValueError(f"Invalid action: '{action}'. Valid: {valid_actions}")
    return AdminAuditEvent.objects.create(
        actor=actor,
        action=action,
        target_type=target.__class__.__name__,
        target_id=str(target.pk),
        target_name=getattr(target, 'name', str(target.pk)),
        before=before,
        after=after,
    )
```

</details>

<details>
<summary>audit/serializers.py — AdminAuditEventSerializer</summary>

```python
# To be filled in during development
```

</details>

<details>
<summary>audit/views.py — AdminAuditEventListView</summary>

```python
# To be filled in during development
```

</details>

<details>
<summary>audit/urls.py — routing</summary>

```python
# To be filled in during development
```

</details>

### Modified Files

<details>
<summary>core/tenant_config.py — register AdminAuditEvent in tenant schema</summary>

Added `AdminAuditEvent` import and added it to the `get_tenant_models()` return list so the table is created inside every org's PostgreSQL schema on provisioning.

</details>

<details>
<summary>access_control/views.py — role and permission endpoints</summary>

```python
# To be filled in during development
```

</details>

<details>
<summary>core/views.py — project and org endpoints</summary>

```python
# To be filled in during development
```

</details>

<details>
<summary>backend/settings.py — register audit app</summary>

Added `'audit.apps.AuditConfig'` to `INSTALLED_APPS`.

</details>

<details>
<summary>backend/urls.py — register audit routes</summary>

```python
# To be filled in during development
```

</details>

---

## Testing

### Manual Test Scenarios

| Scenario | Steps | Expected Result | Status |
|----------|-------|-----------------|--------|
| Create role | POST /roles/ with valid data | AuditEvent created with before=null, after=role snapshot | ⬜ |
| Update role | PUT /roles/<id>/ with new name | AuditEvent created with before/after snapshots | ⬜ |
| Delete role | DELETE /roles/<id>/ | AuditEvent created with before=role snapshot, after=null | ⬜ |
| Update permissions | POST /roles/<id>/permissions/ | AuditEvent created with permission diff | ⬜ |
| Assign user role | POST /users/<id>/roles/ | AuditEvent created | ⬜ |
| Remove user role | DELETE /users/<id>/roles/<id>/ | AuditEvent created | ⬜ |
| Update project | PATCH /projects/<id>/ | AuditEvent created with before/after | ⬜ |
| Update org slug | PATCH /organizations/<id>/slug/ | AuditEvent created | ⬜ |
| DB rollback | Trigger exception mid-request | Neither business record nor AuditEvent created | ⬜ |
| Query audit log | GET /api/audit/events/ | Returns paginated list of AuditEvents | ⬜ |

### Automated Test Results

| Test File | Coverage | Status |
|-----------|----------|--------|
| `audit/tests/test_utils.py` | `capture_snapshot`, `record_audit_entry` (11 cases) | ✅ Passing |
| `audit/tests/test_models.py` | AdminAuditEvent model constraints | ⬜ |
| `audit/tests/test_views.py` | List API, filtering | ⬜ |

---

## Unresolved Issue: Audit Log Schema Storage

### Current Data Storage Situation

During development, the following data storage inconsistency was identified:

| Entity | Schema | Reason |
|--------|--------|--------|
| Role | `public` | `permissionApi.ts` is missing `Authorization` and `X-Organization-Token` headers, causing `TenantSchemaMiddleware` to fall back to public |
| Org | `public` | By design — org is the root tenant entity and cannot live inside its own schema |
| Project | `org schema` | Correct — `projectApi.ts` uses the shared Axios instance which sends correct headers |

This means audit logs for different entity types end up in different schemas, making unified querying inconsistent.

### Trade-off Analysis

| | Option A | Option B |
|---|---|---|
| **Approach** | Fix `permissionApi.ts` headers + migrate Role data from `public` to org schema | Move audit table to `public` schema with `organization_id` field |
| **Data isolation** | Full isolation — each org's data fully self-contained in its own schema | Incomplete — all orgs share one table in `public`, separated by `organization_id` only |
| **Architectural correctness** | Aligns with existing schema-per-tenant design principle | Violates schema-per-tenant principle |
| **Implementation complexity** | High — Role is referenced by Permission, UserRole, RolePermission, and authorization middleware; migration may have wide impact | Low — no data migration needed |
| **Risk** | Higher — requires thorough testing across permission and authentication flow | Lower — no impact on existing functionality |
| **Org-level audit support** | Not supported — org data is in `public` by design and cannot move to org schema | Naturally supported — everything lives in `public` |

### My Recommendation

Personally I lean towards **Option A** as the long-term correct approach, since it maintains the schema-per-tenant design principle and provides true data isolation. However, given that this is my first issue and I am not fully familiar with the scope of impact that migrating Role data might have on the permission and authentication system, I would appreciate guidance from the team before proceeding. If the migration risk is considered too high at this stage, Option B is a reasonable short-term solution that can be revisited later.

### Status

Pending team input from Ray on which direction to proceed.

---

## Lessons Learned

- `AdminAuditEvent` must be registered in `core/tenant_config.py` to be created in tenant schemas. Tables not in this registry only exist in public schema and are invisible to tenant-scoped requests.
- When testing tenant-scoped models, `event.actor` triggers a cross-schema JOIN to `core_customuser` (public schema) which fails under `TenantTestCase`. Use `event.actor_id` instead to avoid the JOIN.

---

## References

| Resource | Link |
|----------|------|
| Jira Ticket | MED-344 |
| Pull Request | TBD |
| MeetingAuditLog reference | `backend/meetings/audit.py` |
| Implementation Plan | `backend/audit/AUDIT_PLAN.md` |
| Tenant model registry | `backend/core/tenant_config.py` |
