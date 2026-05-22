from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("task", "0012_backfill_created_by_from_history"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TaskPin",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "task",
                    models.ForeignKey(
                        help_text="Task pinned by the user",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pins",
                        to="task.task",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        help_text="User who pinned the task",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="task_pins",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="taskpin",
            index=models.Index(fields=["user", "task"], name="taskpin_user_task_idx"),
        ),
        migrations.AddConstraint(
            model_name="taskpin",
            constraint=models.UniqueConstraint(fields=("task", "user"), name="taskpin_unique_task_user"),
        ),
    ]
