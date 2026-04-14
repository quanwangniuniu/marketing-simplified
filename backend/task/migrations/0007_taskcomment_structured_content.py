import django.db.models.deletion
from django.db import migrations, models


def _paragraph(text):
    return [{"type": "paragraph", "children": [{"text": text}]}]


def _backfill_comment_content(apps, schema_editor):
    TaskComment = apps.get_model("task", "TaskComment")

    for comment in TaskComment.objects.all().iterator():
        changed_fields = []

        if not comment.content:
            body_text = (comment.body or "").strip()
            comment.content = _paragraph(body_text) if body_text else []
            changed_fields.append("content")

        if comment.updated_at is None:
            comment.updated_at = comment.created_at
            changed_fields.append("updated_at")

        if changed_fields:
            comment.save(update_fields=changed_fields)


class Migration(migrations.Migration):

    dependencies = [
        ("task", "0006_task_planned_start_date"),
    ]

    operations = [
        # Use SeparateDatabaseAndState so the ORM state is always updated,
        # but the DDL uses IF NOT EXISTS to be safe when columns were already
        # added by a previously-applied (now-deleted) 0006_taskcomment_structured_content.
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="taskcomment",
                    name="content",
                    field=models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Structured JSON content for rich text comment rendering",
                    ),
                ),
                migrations.AddField(
                    model_name="taskcomment",
                    name="parent",
                    field=models.ForeignKey(
                        blank=True,
                        help_text="Parent comment for threaded replies",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="children",
                        to="task.taskcomment",
                    ),
                ),
                migrations.AddField(
                    model_name="taskcomment",
                    name="updated_at",
                    field=models.DateTimeField(auto_now=True, null=True),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '[]'::jsonb",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS parent_id integer REFERENCES task_comments(id) ON DELETE CASCADE",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS updated_at timestamptz",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
        ),
        migrations.RunPython(_backfill_comment_content, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="taskcomment",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
