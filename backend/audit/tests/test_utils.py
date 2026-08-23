"""
Tests for audit/utils.py

Covers:
  - capture_snapshot()   : serializes a model instance to a JSON-safe dict
  - record_audit_entry() : writes an AdminAuditEvent row to the database
"""
from django.db import transaction

from core.test_utils import TenantTestCase
from core.models import Role
from audit.models import AdminAuditEvent
from audit.utils import capture_snapshot, record_audit_entry


class CaptureSnapshotTest(TenantTestCase):
    """Tests for capture_snapshot()"""

    def setUp(self):
        super().setUp()
        self.role = Role.objects.create(
            organization=self.test_org,
            name='Editor',
            level=10,
        )

    def test_returns_dict(self):
        """capture_snapshot should return a dict"""
        snapshot = capture_snapshot(self.role)
        self.assertIsInstance(snapshot, dict)

    def test_contains_name_and_level(self):
        """Snapshot should include the model's editable fields"""
        snapshot = capture_snapshot(self.role)
        self.assertEqual(snapshot['name'], 'Editor')
        self.assertEqual(snapshot['level'], 10)

    def test_id_is_string(self):
        """id field should be serialized to a string for JSON compatibility"""
        snapshot = capture_snapshot(self.role)
        self.assertIn('id', snapshot)
        self.assertIsInstance(snapshot['id'], str)

    def test_created_at_is_string(self):
        """created_at should be serialized to a string"""
        snapshot = capture_snapshot(self.role)
        self.assertIn('created_at', snapshot)
        self.assertIsInstance(snapshot['created_at'], str)

    def test_snapshot_is_independent_copy(self):
        """Modifying the instance after snapshot should not affect the snapshot"""
        snapshot = capture_snapshot(self.role)
        self.role.name = 'Senior Editor'
        self.role.save()
        # Snapshot captured the old value
        self.assertEqual(snapshot['name'], 'Editor')


class RecordAuditEntryTest(TenantTestCase):
    """Tests for record_audit_entry()"""

    def setUp(self):
        super().setUp()
        self.user = self.create_user(
            username='admin',
            email='admin@test.com',
            password='pw',
        )
        self.role = Role.objects.create(
            organization=self.test_org,
            name='Editor',
            level=10,
        )

    def test_creates_audit_event(self):
        """record_audit_entry should create one AdminAuditEvent row"""
        before = capture_snapshot(self.role)
        self.role.name = 'Senior Editor'
        self.role.save()
        after = capture_snapshot(self.role)

        record_audit_entry(
            actor=self.user,
            action='role.updated',
            target=self.role,
            before=before,
            after=after,
        )

        self.assertEqual(AdminAuditEvent.objects.count(), 1)

    def test_event_fields_are_correct(self):
        """The created event should store the correct field values"""
        before = capture_snapshot(self.role)
        self.role.name = 'Senior Editor'
        self.role.save()
        after = capture_snapshot(self.role)

        record_audit_entry(
            actor=self.user,
            action='role.updated',
            target=self.role,
            before=before,
            after=after,
        )

        event = AdminAuditEvent.objects.first()
        self.assertEqual(event.actor_id, self.user.id)
        self.assertEqual(event.action, 'role.updated')
        self.assertEqual(event.target_type, 'Role')
        self.assertEqual(event.target_id, str(self.role.pk))
        self.assertEqual(event.target_name, 'Senior Editor')
        self.assertEqual(event.before['name'], 'Editor')
        self.assertEqual(event.after['name'], 'Senior Editor')

    def test_create_action_before_is_none(self):
        """For create actions, before should be None"""
        record_audit_entry(
            actor=self.user,
            action='role.created',
            target=self.role,
            before=None,
            after=capture_snapshot(self.role),
        )

        event = AdminAuditEvent.objects.first()
        self.assertIsNone(event.before)
        self.assertIsNotNone(event.after)

    def test_delete_action_after_is_none(self):
        """For delete actions, after should be None"""
        record_audit_entry(
            actor=self.user,
            action='role.deleted',
            target=self.role,
            before=capture_snapshot(self.role),
            after=None,
        )

        event = AdminAuditEvent.objects.first()
        self.assertIsNotNone(event.before)
        self.assertIsNone(event.after)

    def test_invalid_action_raises_value_error(self):
        """record_audit_entry should raise ValueError for unknown action strings"""
        with self.assertRaises(ValueError):
            record_audit_entry(
                actor=self.user,
                action='role.nonexistent',
                target=self.role,
            )

    def test_rolls_back_with_transaction(self):
        """
        If the outer transaction is rolled back, the audit event should also be rolled back.
        This verifies atomicity: business write and audit write succeed or fail together.
        """
        try:
            with transaction.atomic():
                record_audit_entry(
                    actor=self.user,
                    action='role.updated',
                    target=self.role,
                    before=capture_snapshot(self.role),
                    after=capture_snapshot(self.role),
                )
                # Force a rollback
                raise Exception('simulated failure')
        except Exception:
            pass

        # Audit event must not exist after rollback
        self.assertEqual(AdminAuditEvent.objects.count(), 0)

    def test_actor_can_be_none(self):
        """actor=None should be accepted (system-triggered events)"""
        record_audit_entry(
            actor=None,
            action='role.updated',
            target=self.role,
        )

        event = AdminAuditEvent.objects.first()
        self.assertIsNone(event.actor)
