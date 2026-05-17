from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agent', '0013_agentsession_approval_required_and_external_approval'),
    ]

    operations = [
        migrations.AddField(
            model_name='agentsession',
            name='is_pinned',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='agentsession',
            name='last_read_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='User read cursor; unread when assistant messages exist after this time.',
            ),
        ),
    ]
