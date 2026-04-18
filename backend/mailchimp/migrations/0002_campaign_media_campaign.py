from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('campaign', '0003_initial'),
        ('mailchimp', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='campaign',
            name='media_campaign',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='mailchimp_drafts',
                to='campaign.campaign',
            ),
        ),
    ]
