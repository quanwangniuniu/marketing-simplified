from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agent', '0009_metadata_driven_schema'),
    ]

    operations = [
        migrations.AddField(
            model_name='agentworkflowrun',
            name='success_criteria',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
