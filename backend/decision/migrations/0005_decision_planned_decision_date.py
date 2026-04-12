# Generated manually for adding planned_decision_date field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('decision', '0004_merge_predraft_migrations'),
    ]

    operations = [
        migrations.AddField(
            model_name='decision',
            name='planned_decision_date',
            field=models.DateTimeField(blank=True, help_text='The planned date for making this decision', null=True),
        ),
    ]