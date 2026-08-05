import logging
import asyncio
from datetime import timedelta
from typing import Any, Dict, Optional
from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Message, MessageStatus, ChatParticipant, ScheduledMessage, MessageAttachment
from .services import ChatService, OnlineStatusService
from .url_helpers import build_messages_action_url

User = get_user_model()
logger = logging.getLogger(__name__)


def _build_forwarded_from_payload(message: Message) -> Optional[Dict[str, Any]]:
    """Build structured forwarded source payload for realtime message events."""
    is_forwarded = bool(
        message.forwarded_from_message_id
        or message.forwarded_from_sender_display
        or message.forwarded_from_created_at
    )
    if not is_forwarded:
        return None

    return {
        'message_id': message.forwarded_from_message_id,
        'sender_display': message.forwarded_from_sender_display or '',
        'created_at': message.forwarded_from_created_at.isoformat() if message.forwarded_from_created_at else None,
    }


def _build_reply_to_payload(message: Message) -> Optional[Dict[str, Any]]:
    """Build structured reply_to payload for realtime message events."""
    if not message.reply_to_id or not message.reply_to:
        return None

    reply_msg = message.reply_to
    return {
        'id': reply_msg.id,
        'sender': {
            'id': reply_msg.sender.id,
            'username': reply_msg.sender.username,
            'email': reply_msg.sender.email,
        },
        'content': reply_msg.content,
        'created_at': reply_msg.created_at.isoformat() if reply_msg.created_at else None,
    }


def build_realtime_message_payload(message: Message) -> Dict[str, Any]:
    """Serialize message payload for websocket/celery delivery with attachments and forward metadata."""
    attachments = []
    for attachment in message.attachments.all():
        attachments.append({
            'id': attachment.id,
            'message': attachment.message_id,
            'file_type': attachment.file_type,
            'file_url': attachment.file.url if attachment.file else None,
            'thumbnail_url': attachment.thumbnail.url if attachment.thumbnail else None,
            'file_size': attachment.file_size,
            'file_size_display': attachment.file_size_display,
            'original_filename': attachment.original_filename,
            'mime_type': attachment.mime_type,
            'created_at': attachment.created_at.isoformat(),
        })

    forwarded_from = _build_forwarded_from_payload(message)
    reply_to = _build_reply_to_payload(message)
    return {
        'id': message.id,
        'seq': message.seq,
        'chat_id': message.chat.id,
        'sender': {
            'id': message.sender.id,
            'username': message.sender.username,
            'email': message.sender.email,
        },
        'content': message.content,
        'created_at': message.created_at.isoformat(),
        'updated_at': message.updated_at.isoformat(),
        'has_attachments': bool(message.has_attachments or attachments),
        'attachment_count': len(attachments),
        'attachments': attachments,
        'is_forwarded': forwarded_from is not None,
        'forwarded_from': forwarded_from,
        'reply_to': reply_to,
    }


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def deliver_message_task(self, message_id: int):
    """
    Celery task to deliver a message to offline users.
    
    This task is triggered when a message is sent to offline users.
    It stores the message in a queue and attempts delivery when users come online.
    
    Args:
        message_id: ID of the message to deliver
    """
    try:
        message = Message.objects.select_related(
            'chat', 'sender', 'reply_to', 'reply_to__sender'
        ).prefetch_related('attachments').get(id=message_id)
        message_payload = build_realtime_message_payload(message)

        # Get all recipients who haven't received the message
        pending_statuses = MessageStatus.objects.filter(
            message=message,
            status='sent'
        ).select_related('user')
        
        if not pending_statuses.exists():
            logger.info(f"No pending recipients for message {message_id}")
            return
        
        channel_layer = get_channel_layer()
        delivered_count = 0
        
        for msg_status in pending_statuses:
            user = msg_status.user
            
            # Check if user is online now
            if OnlineStatusService.is_online(user.id):
                try:
                    # Send via WebSocket
                    async_to_sync(channel_layer.group_send)(
                        f'chat_user_{user.id}',
                        {
                            'type': 'chat_message',
                            'message': message_payload
                        }
                    )
                    
                    # Mark as delivered
                    msg_status.mark_as_delivered()
                    delivered_count += 1
                    logger.info(f"Delivered message {message_id} to online user {user.id}")
                    
                except Exception as e:
                    logger.error(f"Failed to send message {message_id} to user {user.id} via WebSocket: {e}")
            else:
                logger.debug(f"User {user.id} still offline for message {message_id}")
        
        # If there are still pending recipients, retry later
        if delivered_count < pending_statuses.count():
            logger.info(f"Message {message_id} has {pending_statuses.count() - delivered_count} pending recipients, will retry")
            raise self.retry(exc=Exception("Some recipients still offline"))
        
        logger.info(f"Message {message_id} delivered to all {delivered_count} recipients")
        
    except Message.DoesNotExist:
        logger.error(f"Message {message_id} not found")
    except Exception as e:
        logger.error(f"Error delivering message {message_id}: {e}")
        raise self.retry(exc=e)


async def _broadcast_presence_to_recipients(channel_layer, recipient_ids, event):
    await asyncio.gather(*(
        channel_layer.group_send(f'chat_user_{recipient_id}', event)
        for recipient_id in recipient_ids
    ))


def get_offline_broadcast_params(user_id: int, offline_token: str):
    """Finalize offline presence in cache/DB; return (version, recipient_ids) for broadcast.

    Separated from finalize_presence_offline_now so that the consumer's
    async disconnect() handler can call this via sync_to_async and then
    broadcast directly from its own async context, avoiding the nested
    sync_to_async → async_to_sync deadlock that occurs when
    InMemoryChannelLayer asyncio.Queue objects are accessed from a thread
    that is itself running inside the test event loop.

    Returns (None, []) when the user reconnected before this ran.
    """
    version = OnlineStatusService.finalize_offline_if_still_disconnected(user_id, offline_token)
    if version is None:
        return None, []
    recipient_ids = ChatService.get_presence_recipient_ids(user_id)
    recipient_ids = OnlineStatusService.get_online_users(recipient_ids)
    return version, recipient_ids


def finalize_presence_offline_now(user_id: int, offline_token: str) -> bool:
    """Finalize delayed offline presence once and broadcast if state changed.

    Safe to call from regular sync threads (e.g. Celery workers) where there
    is no outer asyncio event loop.  Do NOT call this from inside sync_to_async
    — use get_offline_broadcast_params + consumer.broadcast_presence_update
    instead to avoid nested async_to_sync deadlocks.
    """
    version, recipient_ids = get_offline_broadcast_params(user_id, offline_token)
    if version is None or not recipient_ids:
        return False

    channel_layer = get_channel_layer()
    event = {
        'type': 'presence_update',
        'user_id': user_id,
        'is_online': False,
        'version': version,
        'timestamp': timezone.now().isoformat(),
    }
    async_to_sync(_broadcast_presence_to_recipients)(channel_layer, recipient_ids, event)
    return True


@shared_task(bind=True, max_retries=2, default_retry_delay=5)
def finalize_presence_offline(self, user_id: int, offline_token: str):
    """Finalize delayed offline presence and notify online shared-chat users."""
    try:
        finalize_presence_offline_now(user_id, offline_token)
    except Exception as e:
        logger.error(f"Error finalizing offline presence for user {user_id}: {e}")
        raise self.retry(exc=e)


@shared_task
def cleanup_old_online_status():
    """
    Celery periodic task to clean up stale online status entries.
    
    This is a fallback to ensure Redis doesn't accumulate stale entries.
    Should be run periodically (e.g., every hour).
    """
    try:
        # Get all keys matching the pattern
        pattern = f'{OnlineStatusService.ONLINE_KEY_PREFIX}:*'
        keys = cache.keys(pattern) if hasattr(cache, 'keys') else []
        
        cleaned = 0
        for key in keys:
            # Redis TTL will handle expiration, but we can force cleanup here if needed
            if not cache.get(key):
                cache.delete(key)
                cleaned += 1
        
        logger.info(f"Cleaned up {cleaned} stale online status entries")
        
    except Exception as e:
        logger.error(f"Error cleaning up online status: {e}")


# How long an unlinked (message=None) attachment may live before it is treated
# as abandoned and swept. Must stay comfortably LONGER than the client outbox
# retention window: a message can sit in the offline outbox for a long time
# before a successful send links its attachments, and we must never delete an
# attachment for a message the user is still going to send. Overridable via
# settings for environments that keep the outbox around longer.
ORPHAN_ATTACHMENT_TTL_HOURS = getattr(settings, 'CHAT_ORPHAN_ATTACHMENT_TTL_HOURS', 48)


@shared_task
def cleanup_orphaned_attachments() -> int:
    """Delete abandoned attachment uploads that were never linked to a message.

    Attachments use a two-phase upload: the file is uploaded first (row created
    with message=None) and linked to a Message only when the user actually sends
    it. If the send never happens — cancelled draft, failed validation, spam
    rejection, abandoned outbox entry — the row stays orphaned with message=None
    and its file lingers in storage forever. This periodic sweep removes those
    orphans once they are older than ORPHAN_ATTACHMENT_TTL_HOURS.

    Returns the number of attachments deleted (used by tests and logging).
    """
    cutoff = timezone.now() - timedelta(hours=ORPHAN_ATTACHMENT_TTL_HOURS)
    orphans = MessageAttachment.objects.filter(
        message__isnull=True,
        created_at__lt=cutoff,
    )

    deleted = 0
    # .iterator() streams rows so a large backlog is not all loaded at once.
    for attachment in orphans.iterator():
        try:
            # Delete the stored file FIRST, then the DB row. In this order a
            # mid-way failure leaves a still-tracked row we retry next run,
            # never a DB-less file we can no longer locate.
            if attachment.file:
                attachment.file.delete(save=False)
            attachment.delete()
            deleted += 1
        except Exception as e:
            # Isolate per-item failures so one bad file cannot abort the sweep.
            logger.error("Failed to delete orphaned attachment %s: %s", attachment.id, e)

    logger.info("cleanup_orphaned_attachments: deleted %s orphaned attachment(s)", deleted)
    return deleted


@shared_task
def send_typing_indicator(chat_id: int, user_id: int, is_typing: bool):
    """
    Celery task to broadcast typing indicator to chat participants.
    
    Args:
        chat_id: ID of the chat
        user_id: ID of the user typing
        is_typing: True if user is typing, False if stopped
    """
    try:
        channel_layer = get_channel_layer()
        
        # Get all active participants except the typer
        participants = ChatParticipant.objects.filter(
            chat_id=chat_id,
            is_active=True
        ).exclude(user_id=user_id).values_list('user_id', flat=True)
        
        # Broadcast to all participants
        for participant_id in participants:
            async_to_sync(channel_layer.group_send)(
                f'chat_user_{participant_id}',
                {
                    'type': 'typing_indicator',
                    'chat_id': chat_id,
                    'user_id': user_id,
                    'is_typing': is_typing,
                }
            )
        
        logger.debug(f"Sent typing indicator for user {user_id} in chat {chat_id} to {len(participants)} participants")
        
    except Exception as e:
        logger.error(f"Error sending typing indicator: {e}")


@shared_task(bind=True, max_retries=3)
def update_message_status_task(self, message_id: int, user_id: int, status: str):
    """
    Celery task to update message status and notify sender.
    
    Args:
        message_id: ID of the message
        user_id: ID of the user whose status changed
        status: New status ('delivered' or 'read')
    """
    try:
        message = Message.objects.select_related('sender').get(id=message_id)
        msg_status = MessageStatus.objects.get(message=message, user_id=user_id)
        
        # Update status
        if status == 'delivered':
            msg_status.mark_as_delivered()
        elif status == 'read':
            msg_status.mark_as_read()
        else:
            logger.warning(f"Invalid status '{status}' for message {message_id}")
            return
        
        # Notify sender via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_user_{message.sender.id}',
            {
                'type': 'message_status_update',
                'message_id': message_id,
                'user_id': user_id,
                'status': status,
            }
        )
        
        logger.info(f"Updated message {message_id} status to '{status}' for user {user_id}")
        
    except (Message.DoesNotExist, MessageStatus.DoesNotExist) as e:
        logger.error(f"Message or status not found: {e}")
    except Exception as e:
        logger.error(f"Error updating message status: {e}")
        raise self.retry(exc=e)


@shared_task
def notify_new_message(message_id: int):
    """
    Celery task to notify all chat participants of a new message.

    This is called after a message is created to push notifications
    to all participants (both online and offline).

    Args:
        message_id: ID of the newly created message
    """
    try:
        message = Message.objects.select_related(
            'chat', 'sender', 'reply_to', 'reply_to__sender'
        ).prefetch_related('attachments').get(id=message_id)
        message_payload = build_realtime_message_payload(message)

        # Get all active participants except sender
        participants = ChatParticipant.objects.filter(
            chat=message.chat,
            is_active=True
        ).exclude(user=message.sender).select_related('user')

        channel_layer = get_channel_layer()
        offline_users = []

        # Note: In-app notifications are created synchronously in views.py
        # This task only handles WebSocket delivery for online users

        for participant in participants:
            user = participant.user
            is_online = OnlineStatusService.is_online(user.id)

            logger.info(f"[notify_new_message] Checking user {user.id} ({user.username}) online status: {is_online}")

            if is_online:
                # User is online, send via WebSocket immediately
                try:
                    logger.info(f"[notify_new_message] Sending message {message_id} to ONLINE user {user.id} via WebSocket")
                    async_to_sync(channel_layer.group_send)(
                        f'chat_user_{user.id}',
                        {
                            'type': 'chat_message',
                            'message': message_payload
                        }
                    )

                    # Mark as delivered
                    MessageStatus.objects.filter(
                        message=message,
                        user=user
                    ).update(status='delivered')

                    logger.info(f"Successfully sent message {message_id} to online user {user.id}")

                except Exception as e:
                    logger.error(f"Failed to send message to user {user.id}: {e}")
                    offline_users.append(user.id)
            else:
                # User is offline, queue for later delivery
                offline_users.append(user.id)
                logger.info(f"User {user.id} ({user.username}) is OFFLINE, queuing message {message_id}")

        # Schedule delivery task for offline users
        if offline_users:
            logger.info(f"Scheduling delivery task for message {message_id} to {len(offline_users)} offline users")
            deliver_message_task.apply_async(
                args=[message_id],
                countdown=5  # Retry after 5 seconds (reduced from 60)
            )

    except Message.DoesNotExist:
        logger.error(f"Message {message_id} not found")
    except Exception as e:
        logger.error(f"Error notifying new message {message_id}: {e}")


def _notification_exists_for_message(*, recipient_id: int, event_type: str, message_id: int) -> bool:
    """Best-effort idempotency guard for retryable per-message notification tasks."""
    from notifications.models import Notification

    return Notification.objects.filter(
        recipient_id=recipient_id,
        event_type=event_type,
        metadata__message_id=message_id,
    ).exists()


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def notify_message_recipients(self, message_id: int):
    """
    Create persisted in-app notifications for a newly-created chat message.

    WebSocket fanout stays in ``notify_new_message``; this task owns Activity /
    notification rows so the message create request does not loop over all
    recipients synchronously.
    """
    try:
        from notifications.services import create_notification, create_or_update_chat_notification
        from notifications.models import NotificationCategory, NotificationEventType

        message = (
            Message.objects
            .select_related('chat', 'chat__project', 'sender', 'parent_message', 'parent_message__sender')
            .prefetch_related('mentions__mentioned_user')
            .get(id=message_id)
        )
        if message.is_deleted or message.is_revoked:
            return

        recipients = list(
            ChatParticipant.objects.filter(chat=message.chat, is_active=True)
            .exclude(user=message.sender)
            .select_related('user')
        )
        participant_by_user_id = {participant.user_id: participant for participant in recipients}
        active_recipient_ids = set(participant_by_user_id)
        actor_name = message.sender.username or message.sender.email or ""

        for recipient in recipients:
            if recipient.is_currently_muted():
                continue
            if recipient.notification_level == 'mentions':
                continue
            create_or_update_chat_notification(
                recipient_id=recipient.user_id,
                actor_id=message.sender_id,
                chat_id=message.chat_id,
                message_id=message.id,
                project_id=message.chat.project_id,
                message_preview=message.content or "",
                actor_name=actor_name,
            )

        for mention in message.mentions.select_related('mentioned_user').all():
            if mention.mentioned_user_id == message.sender_id:
                continue
            participant = participant_by_user_id.get(mention.mentioned_user_id)
            if participant is None:
                continue
            if participant.is_currently_muted():
                continue
            if _notification_exists_for_message(
                recipient_id=mention.mentioned_user_id,
                event_type=NotificationEventType.CHAT_MENTION,
                message_id=message.id,
            ):
                continue
            create_notification(
                recipient_id=mention.mentioned_user_id,
                actor_id=message.sender_id,
                category=NotificationCategory.COLLABORATION,
                event_type=NotificationEventType.CHAT_MENTION,
                title=f"{actor_name} mentioned you",
                body=message.content[:200] or "",
                related_object_type="chat",
                related_object_id=message.chat_id,
                action_url=build_messages_action_url(
                    message.chat.slug,
                    message_id=message.id,
                ),
                metadata={
                    "chat_id": message.chat_id,
                    "chat_slug": message.chat.slug,
                    "message_id": message.id,
                    "project_id": message.chat.project_id,
                    "message_preview": message.content[:200] or "",
                },
            )

        if not message.parent_message_id:
            return

        root = message.parent_message
        if not root or root.chat_id != message.chat_id:
            return

        muted_user_ids = {
            participant.user_id
            for participant in ChatParticipant.objects.filter(
                chat=message.chat,
                is_active=True,
                is_muted=True,
            )
            if participant.is_currently_muted()
        }

        notified_ids = {message.sender_id}
        candidate_ids = []
        if root.sender_id != message.sender_id:
            candidate_ids.append(root.sender_id)

        previous_sender_ids = (
            root.thread_replies
            .filter(chat=root.chat)
            .exclude(sender_id__in=notified_ids)
            .order_by('sender_id')
            .values_list('sender_id', flat=True)
            .distinct()
        )
        candidate_ids.extend(previous_sender_ids)

        for recipient_id in candidate_ids:
            if recipient_id not in active_recipient_ids:
                continue
            if recipient_id in notified_ids or recipient_id in muted_user_ids:
                continue
            notified_ids.add(recipient_id)
            if _notification_exists_for_message(
                recipient_id=recipient_id,
                event_type=NotificationEventType.CHAT_THREAD_REPLY,
                message_id=message.id,
            ):
                continue
            create_notification(
                recipient_id=recipient_id,
                actor_id=message.sender_id,
                category=NotificationCategory.COLLABORATION,
                event_type=NotificationEventType.CHAT_THREAD_REPLY,
                title=f"{actor_name} replied in a thread",
                body=message.content[:200] or "",
                related_object_type="chat",
                related_object_id=message.chat_id,
                action_url=build_messages_action_url(
                    message.chat.slug,
                    parent_message_id=root.id,
                    thread_message_id=message.id,
                ),
                metadata={
                    "chat_id": message.chat_id,
                    "chat_slug": message.chat.slug,
                    "root_message_id": root.id,
                    "message_id": message.id,
                    "project_id": message.chat.project_id,
                },
            )
    except Message.DoesNotExist:
        logger.error("notify_message_recipients: message %s not found", message_id)
    except Exception as exc:
        logger.exception("notify_message_recipients failed for message %s: %s", message_id, exc)
        raise self.retry(exc=exc)


@shared_task
def notify_reaction_update(message_id: int, user_id: int, emoji: str, action: str):
    """
    Celery task to notify all chat participants of a reaction update.

    Args:
        message_id: ID of the message that was reacted to
        user_id: ID of the user who added/removed the reaction
        emoji: The emoji that was added/removed
        action: 'added' or 'removed'
    """
    try:
        message = Message.objects.select_related('chat', 'sender').get(id=message_id)
        user = User.objects.get(id=user_id)

        # Build reaction update payload
        reaction_payload = {
            'message_id': message_id,
            'chat_id': message.chat.id,
            'user': {
                'id': user.id,
                'username': user.username,
            },
            'emoji': emoji,
            'action': action,
        }

        # Get all active participants
        participants = ChatParticipant.objects.filter(
            chat=message.chat,
            is_active=True
        ).select_related('user')

        channel_layer = get_channel_layer()

        # Broadcast to all participants (including the reactor, for multi-device sync)
        for participant in participants:
            if OnlineStatusService.is_online(participant.user.id):
                try:
                    async_to_sync(channel_layer.group_send)(
                        f'chat_user_{participant.user.id}',
                        {
                            'type': 'reaction_update',
                            'reaction': reaction_payload
                        }
                    )
                except Exception as e:
                    logger.error(f"Failed to send reaction update to user {participant.user.id}: {e}")

        logger.info(f"Reaction update sent for message {message_id}: {emoji} {action} by user {user_id}")

        # Persist an in-app notification for the message author when someone
        # adds (not removes) a reaction — skip self-reactions.
        if action == 'added' and message.sender_id != user_id:
            try:
                from notifications.services import create_notification
                from notifications.models import NotificationCategory, NotificationEventType
                sender_participant = ChatParticipant.objects.filter(
                    chat=message.chat,
                    user_id=message.sender_id,
                    is_active=True,
                ).first()
                if sender_participant and sender_participant.is_currently_muted():
                    return
                create_notification(
                    recipient_id=message.sender_id,
                    actor_id=user_id,
                    category=NotificationCategory.COLLABORATION,
                    event_type=NotificationEventType.CHAT_REACTION,
                    title=f"{user.username or user.email} reacted {emoji} to your message",
                    body=message.content[:200] or "[Attachment]",
                    related_object_type="chat",
                    related_object_id=message.chat_id,
                    action_url=build_messages_action_url(
                        message.chat.slug,
                        message_id=message_id,
                    ),
                    metadata={
                        "chat_id": message.chat_id,
                        "chat_slug": message.chat.slug,
                        "message_id": message_id,
                        "project_id": message.chat.project_id,
                        "emoji": emoji,
                        "message_preview": message.content[:200] or "[Attachment]",
                    },
                )
            except Exception as e:
                logger.error(f"Failed to create reaction notification for message {message_id}: {e}")

    except Message.DoesNotExist:
        logger.error(f"Message {message_id} not found for reaction update")
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for reaction update")
    except Exception as e:
        logger.error(f"Error notifying reaction update for message {message_id}: {e}")


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_scheduled_message(self, scheduled_message_id: int):
    """
    Celery task that fires at the scheduled time and creates the actual Message.

    Flow:
      1. Load ScheduledMessage; skip if not pending (already sent/cancelled).
      2. Mark status=sending.
      3. Create the Message (content, rich_body, attachments, mentions, reply_to).
      4. Mark status=sent, store sent_message FK.
      5. Dispatch notify_new_message so online users receive it via WebSocket.
    """
    from django.contrib.auth import get_user_model as _get_user_model
    from .models import Message, MessageMention, MessageAttachment, ScheduledMessage

    _User = _get_user_model()
    sm = None
    try:
        sm = (
            ScheduledMessage.objects
            .select_related('chat', 'sender', 'reply_to')
            .get(id=scheduled_message_id)
        )
    except ScheduledMessage.DoesNotExist:
        logger.error(f"send_scheduled_message: ScheduledMessage {scheduled_message_id} not found")
        return

    if sm.status != ScheduledMessage.STATUS_PENDING:
        logger.info(f"send_scheduled_message {scheduled_message_id}: status={sm.status}, skipping")
        return

    # Mark as sending so concurrent retries skip
    sm.status = ScheduledMessage.STATUS_SENDING
    sm.save(update_fields=['status', 'updated_at'])

    try:
        with transaction.atomic():
            # Create the message
            message = Message.objects.create(
                chat=sm.chat,
                sender=sm.sender,
                content=sm.content,
                rich_body=sm.rich_body,
                reply_to_id=sm.reply_to_id,
            )

            # Link only still-unlinked attachments uploaded by the scheduling user.
            attachment_ids = list(dict.fromkeys(sm.attachment_ids or []))
            if attachment_ids:
                attachments = MessageAttachment.objects.select_for_update().filter(
                    id__in=attachment_ids,
                    uploader=sm.sender,
                    message__isnull=True,
                )
                if attachments.count() != len(attachment_ids):
                    raise ValueError("Scheduled message attachments are no longer available.")
                attachments.update(message=message)
                message.has_attachments = True
                message.save(update_fields=['has_attachments'])

            # Create mention records
            mention_ids = sm.mention_ids or []
            for uid in mention_ids:
                try:
                    MessageMention.objects.get_or_create(message=message, mentioned_user_id=uid)
                except Exception:
                    pass

        # Finalize
        sm.status = ScheduledMessage.STATUS_SENT
        sm.sent_message = message
        sm.save(update_fields=['status', 'sent_message', 'updated_at'])

        logger.info(
            f"send_scheduled_message {scheduled_message_id}: created message {message.id} in chat {sm.chat_id}"
        )

        # Push to online participants
        notify_new_message.delay(message.id)

    except Exception as exc:
        logger.error(f"send_scheduled_message {scheduled_message_id} failed: {exc}")
        if sm is not None:
            try:
                sm.status = ScheduledMessage.STATUS_FAILED
                sm.error_message = str(exc)
                sm.save(update_fields=['status', 'error_message', 'updated_at'])
            except Exception:
                pass
        if isinstance(exc, ValueError):
            return
        raise self.retry(exc=exc)
