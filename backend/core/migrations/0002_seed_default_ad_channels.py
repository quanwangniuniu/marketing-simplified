# Generated manually — ensures each project has TikTok + Facebook AdChannels (legacy UI parity).

from django.db import migrations

DEFAULT_AD_CHANNEL_NAMES = ('TikTok', 'Facebook')


def seed_default_ad_channels(apps, schema_editor):
    Project = apps.get_model('core', 'Project')
    AdChannel = apps.get_model('core', 'AdChannel')
    for project in Project.objects.all():
        for name in DEFAULT_AD_CHANNEL_NAMES:
            AdChannel.objects.get_or_create(project=project, name=name)


def noop_reverse(apps, schema_editor):
    # Do not delete rows — names may have been reused or edited.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_default_ad_channels, noop_reverse),
    ]
