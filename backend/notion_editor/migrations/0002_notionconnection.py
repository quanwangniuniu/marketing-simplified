from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("notion_editor", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="NotionConnection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("workspace_id", models.CharField(blank=True, max_length=128, null=True)),
                ("workspace_name", models.CharField(blank=True, max_length=255, null=True)),
                ("workspace_icon", models.URLField(blank=True, null=True)),
                ("bot_id", models.CharField(blank=True, max_length=128, null=True)),
                ("bot_name", models.CharField(blank=True, max_length=255, null=True)),
                ("encrypted_access_token", models.TextField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=False)),
                ("connected_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notion_connection",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "notion_connections",
            },
        ),
        migrations.AddIndex(
            model_name="notionconnection",
            index=models.Index(fields=["is_active"], name="notion_edit_is_acti_17cc2f_idx"),
        ),
        migrations.AddIndex(
            model_name="notionconnection",
            index=models.Index(fields=["workspace_id"], name="notion_edit_workspa_ebaf36_idx"),
        ),
    ]

