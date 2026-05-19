from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('experience_group', '0002_experiencegroup_project'),
    ]

    operations = [
        migrations.AlterField(
            model_name='experiencegroup',
            name='name',
            field=models.CharField(max_length=100),
        ),
        migrations.AddConstraint(
            model_name='experiencegroup',
            constraint=models.UniqueConstraint(
                fields=('project', 'name'),
                name='experience_group_unique_name_per_project',
            ),
        ),
    ]
