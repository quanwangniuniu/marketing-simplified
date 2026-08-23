from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0019_refine_password_rotation_future_guard"),
    ]

    operations = [
        migrations.AlterField(
            model_name="auditevent",
            name="signature_version",
            field=models.CharField(default="v2", max_length=20),
        ),
        migrations.AddField(
            model_name="auditevent",
            name="signature_key_id",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="auditevent",
            name="signature_algorithm",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
    ]
