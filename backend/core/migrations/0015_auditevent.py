import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def install_audit_event_immutability(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP RULE IF EXISTS prevent_core_auditevent_update ON core_auditevent;")
        cursor.execute("DROP RULE IF EXISTS prevent_core_auditevent_delete ON core_auditevent;")
        cursor.execute(
            """
            CREATE OR REPLACE FUNCTION prevent_core_auditevent_mutation()
            RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'core_auditevent is append-only';
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        cursor.execute(
            """
            DROP TRIGGER IF EXISTS core_auditevent_immutable
            ON core_auditevent;
            """
        )
        cursor.execute(
            """
            CREATE TRIGGER core_auditevent_immutable
            BEFORE UPDATE OR DELETE ON core_auditevent
            FOR EACH ROW EXECUTE FUNCTION prevent_core_auditevent_mutation();
            """
        )


def remove_audit_event_immutability(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP TRIGGER IF EXISTS core_auditevent_immutable ON core_auditevent;")
        cursor.execute("DROP FUNCTION IF EXISTS prevent_core_auditevent_mutation();")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0014_dataexportrequest"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditEvent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("occurred_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("event_type", models.CharField(db_index=True, max_length=120)),
                ("actor_email", models.EmailField(blank=True, default="", max_length=254)),
                ("target_type", models.CharField(blank=True, db_index=True, default="", max_length=120)),
                ("target_id", models.CharField(blank=True, default="", max_length=120)),
                ("before", models.JSONField(blank=True, null=True)),
                ("after", models.JSONField(blank=True, null=True)),
                ("context", models.JSONField(blank=True, default=dict)),
                ("request_id", models.CharField(blank=True, default="", max_length=120)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.TextField(blank=True, default="")),
                ("signature_version", models.CharField(default="v1", max_length=20)),
                ("signature", models.CharField(editable=False, max_length=128)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="audit_events",
                        to="core.organization",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        related_name="audit_events",
                        to="core.project",
                    ),
                ),
            ],
            options={
                "ordering": ["-occurred_at", "-id"],
                "indexes": [
                    models.Index(fields=["organization", "-occurred_at"], name="core_audite_organiz_f1a0f6_idx"),
                    models.Index(fields=["project", "-occurred_at"], name="core_audite_project_683d15_idx"),
                    models.Index(fields=["actor", "-occurred_at"], name="core_audite_actor_i_4bc827_idx"),
                    models.Index(fields=["event_type", "-occurred_at"], name="core_audite_event_t_a98e56_idx"),
                ],
            },
        ),
        migrations.RunPython(install_audit_event_immutability, remove_audit_event_immutability),
    ]
