import pytest
from django.db import DatabaseError, connection, transaction

from core.models import AuditEvent
from core.services.audit_events import emit_audit_event, verify_audit_event_signature


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
