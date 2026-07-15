"""
chat/signals.py
───────────────
Keeps Message.search_vector in sync whenever a message is saved.

The vector weights:
  A (highest) — message content (plain text)
  B           — sender username / email

NOTE: We use Value(instance.sender.username) instead of the relation
path 'sender__username' because QuerySet.update() cannot traverse
ForeignKey joins; passing a literal Value avoids the restriction.
"""

from django.db.models import Value
from django.db.models.signals import post_save, pre_delete, pre_save, post_delete
from django.dispatch import receiver
from django.contrib.postgres.search import SearchVector
from .models import ChatParticipant
from .services import ChatService

@receiver(post_save, sender='chat.Message')
def update_message_search_vector(sender, instance, **kwargs):
    """Rebuild the tsvector for this message after every save.

    Revoked or soft-deleted messages get search_vector=NULL so they are
    never surfaced by FTS *or* the icontains fallback (which matches on
    content; nulling out the vector is belt-and-suspenders on top of the
    is_revoked=False / is_deleted=False filters in the search view).
    """
    if instance.is_revoked or instance.is_deleted:
        # Remove from search index immediately — the content field still
        # holds the original text, so we must not leave a populated vector.
        sender.objects.filter(pk=instance.pk).update(search_vector=None)
        return

    # Resolve the sender username at Python level to avoid an FK traversal
    # in the UPDATE statement, which Django/PostgreSQL doesn't support cleanly.
    try:
        sender_name = instance.sender.username or instance.sender.email or ''
    except Exception:
        sender_name = ''

    sender.objects.filter(pk=instance.pk).update(
        search_vector=(
            SearchVector('content', weight='A', config='english')
            + SearchVector(Value(sender_name), weight='B', config='english')
        )
    )


@receiver(pre_delete, sender='chat.Message')
def mark_forwarded_attachment_copies_unavailable(sender, instance, **kwargs):
    """When an original message is deleted, forwarded file copies become tombstones."""
    forwarded_messages = (
        instance.forwarded_messages
        .filter(has_attachments=True)
    )

    for forwarded_message in forwarded_messages:
        forwarded_message.has_attachments = False
        forwarded_message.save(update_fields=['has_attachments', 'updated_at'])

@receiver(pre_save, sender=ChatParticipant)
def cache_previous_participant_is_active(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_is_active = None
        return

    try:
        instance._previous_is_active = sender.objects.only('is_active').get(pk=instance.pk).is_active
    except sender.DoesNotExist:
        instance._previous_is_active = None


@receiver(post_save, sender=ChatParticipant)
def invalidate_participant_presence_cache_on_save(sender, instance, created, **kwargs):
    previous_is_active = getattr(instance, '_previous_is_active', None)
    became_active = created or (previous_is_active is False and instance.is_active is True)
    became_inactive = previous_is_active is True and instance.is_active is False

    if became_active:
        ChatService.invalidate_presence_recipients_for_chat(instance.chat)
    elif became_inactive:
        ChatService.invalidate_presence_recipients_for_chat(
            instance.chat,
            extra_user_ids=[instance.user_id],
        )


@receiver(post_delete, sender=ChatParticipant)
def invalidate_participant_presence_cache_on_delete(sender, instance, **kwargs):
    ChatService.invalidate_presence_recipients_for_chat(
        instance.chat,
        extra_user_ids=[instance.user_id],
    )