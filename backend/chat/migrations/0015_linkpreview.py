from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0014_chatoutboxevent_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='LinkPreview',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('url', models.TextField(help_text='Normalized URL (fragment stripped, host lowercased) — the cache key', unique=True)),
                ('status', models.CharField(choices=[('pending', 'Fetch in progress'), ('ready', 'Fetched'), ('failed', 'Upstream fetch failed'), ('blocked', 'Refused by the URL safety guard')], default='pending', help_text='Outcome of the last fetch attempt', max_length=20)),
                ('title', models.TextField(blank=True, help_text='og:title, or the <title> tag', null=True)),
                ('description', models.TextField(blank=True, help_text='og:description', null=True)),
                ('image_url', models.TextField(blank=True, help_text='og:image — hotlinked by the client', null=True)),
                ('fetched_at', models.DateTimeField(blank=True, help_text='When the last attempt finished; basis for the 24h freshness window', null=True)),
            ],
            options={
                'indexes': [models.Index(fields=['status', 'fetched_at'], name='chat_linkpr_status_f154e9_idx')],
            },
        ),
    ]
