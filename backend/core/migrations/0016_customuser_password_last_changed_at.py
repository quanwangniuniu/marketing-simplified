from django.db import migrations, models
from django.utils import timezone


def backfill_password_last_changed_at(apps, schema_editor):
    CustomUser = apps.get_model("core", "CustomUser")
    CustomUser.objects.filter(
        password_last_changed_at__isnull=True,
        password_set=True,
    ).update(password_last_changed_at=timezone.now())


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0015_auditevent"),
    ]

    operations = [
        migrations.AddField(
            model_name="customuser",
            name="password_last_changed_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Timestamp used by elevated-role password rotation policy.",
                null=True,
            ),
        ),
        migrations.RunPython(backfill_password_last_changed_at, migrations.RunPython.noop),
    ]
