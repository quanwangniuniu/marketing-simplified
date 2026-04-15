from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("google_docs_integration", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="googledocsconnection",
            old_name="access_token",
            new_name="encrypted_access_token",
        ),
        migrations.RenameField(
            model_name="googledocsconnection",
            old_name="refresh_token",
            new_name="encrypted_refresh_token",
        ),
    ]
