from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('spreadsheet', '0010_spreadsheet_slug'),
    ]

    operations = [
        migrations.AddField(
            model_name='sheet',
            name='revision',
            field=models.PositiveBigIntegerField(
                default=0,
                help_text='Monotonic coordinate-structure revision for collaboration conflict checks',
            ),
        ),
    ]
