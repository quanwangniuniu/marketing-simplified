from django.db import migrations


REFINE_PASSWORD_LAST_CHANGED_GUARD = """
CREATE OR REPLACE FUNCTION prevent_future_password_last_changed_at()
RETURNS trigger AS $$
BEGIN
    IF NEW.password_last_changed_at IS NOT NULL
       AND NEW.password_last_changed_at IS DISTINCT FROM OLD.password_last_changed_at
       AND NEW.password_last_changed_at > CURRENT_TIMESTAMP + INTERVAL '1 minute' THEN
        RAISE EXCEPTION 'password_last_changed_at cannot be more than 1 minute in the future';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


RESTORE_PASSWORD_LAST_CHANGED_GUARD = """
CREATE OR REPLACE FUNCTION prevent_future_password_last_changed_at()
RETURNS trigger AS $$
BEGIN
    IF NEW.password_last_changed_at IS NOT NULL
       AND NEW.password_last_changed_at > CURRENT_TIMESTAMP + INTERVAL '1 minute' THEN
        RAISE EXCEPTION 'password_last_changed_at cannot be more than 1 minute in the future';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0018_auditevent_reject_mutation_rules"),
    ]

    operations = [
        migrations.RunSQL(
            sql=REFINE_PASSWORD_LAST_CHANGED_GUARD,
            reverse_sql=RESTORE_PASSWORD_LAST_CHANGED_GUARD,
        ),
    ]
