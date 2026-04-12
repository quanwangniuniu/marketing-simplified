# Generated manually: encrypt Zoom OAuth tokens at rest.

from django.db import migrations, models


def encrypt_existing_tokens(apps, schema_editor):
    from zoom_integration.crypto import encrypt_token

    ZoomCredential = apps.get_model("zoom_integration", "ZoomCredential")
    for row in ZoomCredential.objects.all():
        row.encrypted_access_token = encrypt_token(row.access_token)
        row.encrypted_refresh_token = encrypt_token(row.refresh_token)
        row.save(
            update_fields=["encrypted_access_token", "encrypted_refresh_token"],
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("zoom_integration", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="zoomcredential",
            name="encrypted_access_token",
            field=models.TextField(null=True),
        ),
        migrations.AddField(
            model_name="zoomcredential",
            name="encrypted_refresh_token",
            field=models.TextField(null=True),
        ),
        migrations.RunPython(encrypt_existing_tokens, noop_reverse),
        migrations.RemoveField(
            model_name="zoomcredential",
            name="access_token",
        ),
        migrations.RemoveField(
            model_name="zoomcredential",
            name="refresh_token",
        ),
        migrations.AlterField(
            model_name="zoomcredential",
            name="encrypted_access_token",
            field=models.TextField(help_text="Encrypted short-lived OAuth access token."),
        ),
        migrations.AlterField(
            model_name="zoomcredential",
            name="encrypted_refresh_token",
            field=models.TextField(help_text="Encrypted OAuth refresh token."),
        ),
    ]
