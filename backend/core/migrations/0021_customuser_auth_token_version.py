from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0020_auditevent_signature_envelope"),
    ]

    operations = [
        migrations.AddField(
            model_name="customuser",
            name="auth_token_version",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Incremented to invalidate previously issued JWTs after security-sensitive changes.",
            ),
        ),
    ]
