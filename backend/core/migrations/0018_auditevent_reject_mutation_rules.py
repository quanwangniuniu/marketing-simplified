from django.db import migrations


def reject_audit_event_mutations(apps, schema_editor):
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


def restore_audit_event_mutation_noop_rules(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP TRIGGER IF EXISTS core_auditevent_immutable ON core_auditevent;")
        cursor.execute(
            """
            CREATE OR REPLACE RULE prevent_core_auditevent_update AS
            ON UPDATE TO core_auditevent DO INSTEAD NOTHING;
            """
        )
        cursor.execute(
            """
            CREATE OR REPLACE RULE prevent_core_auditevent_delete AS
            ON DELETE TO core_auditevent DO INSTEAD NOTHING;
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0017_password_rotation_future_guard"),
    ]

    operations = [
        migrations.RunPython(reject_audit_event_mutations, restore_audit_event_mutation_noop_rules),
    ]
