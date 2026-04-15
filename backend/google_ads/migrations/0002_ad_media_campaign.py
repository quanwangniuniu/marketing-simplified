from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('campaign', '0003_initial'),
        ('google_ads', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='ad',
            name='media_campaign',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='google_ads',
                to='campaign.campaign',
            ),
        ),
    ]
