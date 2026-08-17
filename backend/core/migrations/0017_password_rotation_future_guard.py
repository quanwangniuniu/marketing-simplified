from django.db import migrations


CREATE_PASSWORD_LAST_CHANGED_GUARD = """
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

DROP TRIGGER IF EXISTS customuser_password_last_changed_not_future ON core_customuser;
CREATE TRIGGER customuser_password_last_changed_not_future
BEFORE INSERT OR UPDATE OF password_last_changed_at ON core_customuser
FOR EACH ROW
EXECUTE FUNCTION prevent_future_password_last_changed_at();
"""


DROP_PASSWORD_LAST_CHANGED_GUARD = """
DROP TRIGGER IF EXISTS customuser_password_last_changed_not_future ON core_customuser;
DROP FUNCTION IF EXISTS prevent_future_password_last_changed_at();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0016_customuser_password_last_changed_at"),
    ]

    operations = [
        migrations.RunSQL(
            sql=CREATE_PASSWORD_LAST_CHANGED_GUARD,
            reverse_sql=DROP_PASSWORD_LAST_CHANGED_GUARD,
        ),
    ]
