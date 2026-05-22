from django.conf import settings
from django.db import migrations, models
from django.db.models import F
import django.db.models.deletion


def backfill_created_by_from_owner(apps, schema_editor):
    Task = apps.get_model("task", "Task")
    Task.objects.filter(
        created_by__isnull=True,
        owner__isnull=False,
    ).update(created_by_id=F("owner_id"))


class Migration(migrations.Migration):

    dependencies = [
        ("task", "0010_taskfieldhistory"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                help_text="The user who originally created the task",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="created_tasks",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(
            backfill_created_by_from_owner,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
