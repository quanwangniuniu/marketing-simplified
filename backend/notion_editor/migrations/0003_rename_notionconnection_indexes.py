from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("notion_editor", "0002_notionconnection"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="notionconnection",
            new_name="notion_conn_is_acti_df463d_idx",
            old_name="notion_edit_is_acti_17cc2f_idx",
        ),
        migrations.RenameIndex(
            model_name="notionconnection",
            new_name="notion_conn_workspa_ecab92_idx",
            old_name="notion_edit_workspa_ebaf36_idx",
        ),
    ]
