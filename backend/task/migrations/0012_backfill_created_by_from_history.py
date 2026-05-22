from django.db import migrations
from django.db.models import OuterRef, Subquery


def backfill_created_by_from_history(apps, schema_editor):
    Task = apps.get_model("task", "Task")
    TaskFieldHistory = apps.get_model("task", "TaskFieldHistory")
    creator_subquery = (
        TaskFieldHistory.objects.filter(
            task_id=OuterRef("pk"),
            field_name="task_created",
            changed_by__isnull=False,
        )
        .order_by("changed_at")
        .values("changed_by_id")[:1]
    )
    Task.objects.filter(created_by__isnull=True).update(
        created_by_id=Subquery(creator_subquery)
    )


class Migration(migrations.Migration):

    dependencies = [
        ("task", "0011_task_created_by"),
    ]

    operations = [
        migrations.RunPython(
            backfill_created_by_from_history,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
