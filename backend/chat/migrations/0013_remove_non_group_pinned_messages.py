import logging

from django.db import migrations

logger = logging.getLogger(__name__)


def delete_non_group_pins(apps, schema_editor):
    """Drop pins that live on direct messages.

    Pinning is a group-channel feature guarded by the channel-manager check, but
    an earlier permission branch let any participant of a private chat pin. Those
    rows are now unreachable: the list endpoint hides them and unpin returns 403,
    so nobody can clear them from the UI.

    The rows are logged before they go. Deleted rows cannot be reconstructed by
    the reverse operation, so the record of what was removed is what makes this
    auditable and hand-recoverable from a backup — without an archive table
    that would itself need a follow-up to clean up.
    """
    PinnedMessage = apps.get_model('chat', 'PinnedMessage')
    doomed = list(
        PinnedMessage.objects
        .exclude(chat__type='group')
        .values('id', 'chat_id', 'message_id', 'pinned_by_id', 'created_at')
    )
    if not doomed:
        logger.info('0013_remove_non_group_pinned_messages: no non-group pins found')
        return

    for row in doomed:
        logger.info(
            '0013_remove_non_group_pinned_messages: deleting pin id=%s chat=%s '
            'message=%s pinned_by=%s created_at=%s',
            row['id'],
            row['chat_id'],
            row['message_id'],
            row['pinned_by_id'],
            row['created_at'].isoformat() if row['created_at'] else None,
        )

    PinnedMessage.objects.filter(id__in=[row['id'] for row in doomed]).delete()
    logger.info(
        '0013_remove_non_group_pinned_messages: deleted %s non-group pin(s) '
        'across %s chat(s)',
        len(doomed),
        len({row['chat_id'] for row in doomed}),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0012_message_client_message_id'),
    ]

    operations = [
        migrations.RunPython(delete_non_group_pins, migrations.RunPython.noop),
    ]
