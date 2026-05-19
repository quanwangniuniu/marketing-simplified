from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support_channels', '0001_initial'),
        ('experience_group', '0003_unique_name_per_project'),
    ]

    operations = [
        # Drop the M2M to our old ExperienceGroup, recreate pointing to Yan's
        migrations.AlterField(
            model_name='supportchannel',
            name='experience_groups',
            field=models.ManyToManyField(
                blank=True,
                help_text='Experience Groups this channel is assigned to',
                related_name='channels',
                to='experience_group.experiencegroup',
            ),
        ),
        # Delete our own ExperienceGroup model
        migrations.DeleteModel(
            name='ExperienceGroup',
        ),
    ]
