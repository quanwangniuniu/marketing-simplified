import pytest
from django.db import DatabaseError, connection, transaction
from django.test import override_settings

from core.models import AuditEvent
from core.services.audit_events import (
    REDACTED_VALUE,
    emit_audit_event,
    safe_emit_audit_event,
    verify_audit_event_signature,
)


@pytest.mark.django_db
def test_emit_audit_event_generates_signature_and_verifies(user, project):
    event = emit_audit_event(
        event_type="security.test_event",
        actor=user,
        organization=project.organization,
        project=project,
        target_type="project",
        target_id=project.id,
        after={"status": "created"},
        context={"source": "test"},
    )

    assert event.signature
    assert event.signature_version == AuditEvent.SIGNATURE_VERSION
    assert event.signature_key_id == "default"
    assert event.signature_algorithm == "HMAC-SHA256"
    assert event.verify_signature() is True
    assert verify_audit_event_signature(event) is True


@pytest.mark.django_db
def test_audit_event_signature_detects_payload_tampering(user, project):
    event = emit_audit_event(
        event_type="security.test_event",
        actor=user,
        organization=project.organization,
        project=project,
        target_type="project",
        target_id=project.id,
        after={"status": "created"},
    )

    event.after = {"status": "tampered"}

    assert event.verify_signature() is False


@pytest.mark.django_db(transaction=True)
def test_safe_emit_audit_event_waits_for_commit_and_skips_rollback(user):
    with pytest.raises(RuntimeError):
        with transaction.atomic():
            safe_emit_audit_event(
                event_type="security.rollback_event",
                actor=user,
                target_type="user",
                target_id=user.id,
            )
            assert not AuditEvent.objects.filter(event_type="security.rollback_event").exists()
            raise RuntimeError("rollback")

    assert not AuditEvent.objects.filter(event_type="security.rollback_event").exists()

    with transaction.atomic():
        safe_emit_audit_event(
            event_type="security.committed_event",
            actor=user,
            target_type="user",
            target_id=user.id,
        )
        assert not AuditEvent.objects.filter(event_type="security.committed_event").exists()

    assert AuditEvent.objects.filter(event_type="security.committed_event").exists()


@pytest.mark.django_db
def test_audit_event_redacts_secret_fields_before_storage(user):
    event = emit_audit_event(
        event_type="security.redaction_event",
        actor=user,
        target_type="user",
        target_id=user.id,
        before={
            "password": "CurrentPassword123!",
            "nested": {"refresh_token": "secret-refresh-token"},
        },
        after={
            "api_key": "secret-api-key",
            "safe_field": "safe value",
        },
        context={"authorization": "Bearer secret-token"},
    )

    assert event.before["password"] == REDACTED_VALUE
    assert event.before["nested"]["refresh_token"] == REDACTED_VALUE
    assert event.after["api_key"] == REDACTED_VALUE
    assert event.after["safe_field"] == "safe value"
    assert event.context["authorization"] == REDACTED_VALUE
    assert event.verify_signature() is True


@pytest.mark.django_db
@override_settings(
    AUDIT_EVENT_ACTIVE_KEY_ID="kid-2",
    AUDIT_EVENT_SIGNATURE_KEYS={
        "kid-1": "old-secret",
        "kid-2": "new-secret",
    },
)
def test_audit_event_signature_uses_key_id_and_rotation_window(user):
    event = emit_audit_event(
        event_type="security.rotation_event",
        actor=user,
        target_type="user",
        target_id=user.id,
    )

    assert event.signature_key_id == "kid-2"
    assert event.signature_algorithm == "HMAC-SHA256"
    assert event.verify_signature() is True


@pytest.mark.django_db
def test_audit_event_model_blocks_django_updates(user):
    event = emit_audit_event(
        event_type="security.test_event",
        actor=user,
        target_type="user",
        target_id=user.id,
    )

    event.context = {"tampered": True}

    with pytest.raises(ValueError):
        event.save()


@pytest.mark.django_db(transaction=True)
def test_audit_event_database_rejects_update(user):
    if connection.vendor != "postgresql":
        pytest.skip("AuditEvent database immutability trigger is PostgreSQL-specific.")

    event = emit_audit_event(
        event_type="security.test_event",
        actor=user,
        target_type="user",
        target_id=user.id,
    )

    with pytest.raises(DatabaseError):
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE core_auditevent SET event_type = %s WHERE id = %s",
                    ["security.tampered", str(event.id)],
                )

    event.refresh_from_db()
    assert event.event_type == "security.test_event"
    assert event.verify_signature() is True


@pytest.mark.django_db(transaction=True)
def test_audit_event_database_rejects_delete(user):
    if connection.vendor != "postgresql":
        pytest.skip("AuditEvent database immutability trigger is PostgreSQL-specific.")

    event = emit_audit_event(
        event_type="security.test_event",
        actor=user,
        target_type="user",
        target_id=user.id,
    )

    with pytest.raises(DatabaseError):
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM core_auditevent WHERE id = %s", [str(event.id)])

    assert AuditEvent.objects.filter(id=event.id).exists()
    event.refresh_from_db()
    assert event.verify_signature() is True
