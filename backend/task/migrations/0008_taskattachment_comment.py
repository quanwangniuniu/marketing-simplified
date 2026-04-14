import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("task", "0007_taskcomment_structured_content"),
    ]

    operations = [
        migrations.AddField(
            model_name="taskattachment",
            name="comment",
            field=models.ForeignKey(
                blank=True,
                help_text="Associated comment (if this is a comment attachment)",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comment_attachments",
                to="task.taskcomment",
            ),
        ),
    ]
