# Generated manually for SMP-489

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("meetings", "0008_meetingactionitem"),
        ("task", "0005_alter_approvalrecord_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="origin_action_item",
            field=models.OneToOneField(
                blank=True,
                help_text="Immutable lineage: meeting action item this task was converted from.",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="derived_task",
                to="meetings.meetingactionitem",
            ),
        ),
    ]
