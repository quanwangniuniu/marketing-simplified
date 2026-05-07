from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("decision", "0005_decision_planned_decision_date"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                """
                ALTER TABLE decisions
                ADD COLUMN IF NOT EXISTS project_id bigint NULL
                """,
                """
                ALTER TABLE decisions
                ADD COLUMN IF NOT EXISTS project_seq integer
                """,
                """
                UPDATE decisions
                SET project_seq = 1
                WHERE project_seq IS NULL
                """,
                """
                ALTER TABLE decisions
                ALTER COLUMN project_seq SET NOT NULL
                """,
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
