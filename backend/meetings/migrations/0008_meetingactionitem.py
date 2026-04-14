# Generated manually for SMP-489

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("meetings", "0007_merge_20260407_0521"),
        ("meetings", "0006_merge_meetingactionitem_and_document_chain"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="meetingactionitem",
            options={"ordering": ["order_index", "id"]},
        ),
        migrations.AlterUniqueTogether(
            name="meetingactionitem",
            unique_together=set(),
        ),
        migrations.AlterField(
            model_name="meetingactionitem",
            name="order_index",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="meetingactionitem",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="meetingactionitem",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddIndex(
            model_name="meetingactionitem",
            index=models.Index(fields=["meeting", "order_index"], name="mtgs_actitem_meet_ord"),
        ),
    ]
