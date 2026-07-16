from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('csm', '0016_quickreplytemplate_slug_and_templatetag'),
    ]

    operations = [
        migrations.AddField(
            model_name='supportchannel',
            name='ticket_confirmation_message',
            field=models.TextField(blank=True),
        ),
    ]
