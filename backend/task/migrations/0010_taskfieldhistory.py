from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('task', '0009_task_linear_issue_id'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TaskFieldHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('field_name', models.CharField(max_length=64)),
                ('old_value', models.TextField(blank=True, null=True)),
                ('new_value', models.TextField(blank=True, null=True)),
                ('changed_at', models.DateTimeField(auto_now_add=True)),
                ('task', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='field_history',
                    to='task.task',
                )),
                ('changed_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='task_field_changes',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'task_field_history',
                'ordering': ['-changed_at'],
            },
        ),
        migrations.AddIndex(
            model_name='taskfieldhistory',
            index=models.Index(fields=['task', '-changed_at'], name='task_field_history_task_idx'),
        ),
    ]
