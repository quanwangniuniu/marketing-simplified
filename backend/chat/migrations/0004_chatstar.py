# Generated manually for user-starred chats (Slack-style sidebar)

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('chat', '0003_message_soft_delete_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='ChatStar',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('position', models.PositiveIntegerField(default=0, help_text='Order within starred list for this user in the chat project')),
                ('chat', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stars', to='chat.chat')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chat_stars', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['position', 'id'],
                'unique_together': {('user', 'chat')},
            },
        ),
        migrations.AddIndex(
            model_name='chatstar',
            index=models.Index(fields=['user', 'position'], name='chat_chatst_user_id_pos_idx'),
        ),
        migrations.AddIndex(
            model_name='chatstar',
            index=models.Index(fields=['user', 'chat'], name='chat_chatst_user_id_chat_id_idx'),
        ),
    ]
