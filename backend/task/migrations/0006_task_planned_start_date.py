# Generated manually for adding planned_start_date field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("task", "0005_alter_approvalrecord_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="planned_start_date",
            field=models.DateField(
                blank=True,
                help_text="The planned start date of the task",
                null=True,
            ),
        ),
    ]
