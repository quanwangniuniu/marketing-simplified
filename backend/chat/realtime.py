"""Bounded helpers for publishing chat events through Django Channels."""

import asyncio
from typing import Any, Dict, Iterable, List, Tuple

from asgiref.sync import async_to_sync
from django.conf import settings


def _unique_user_ids(user_ids: Iterable[int]) -> List[int]:
    """Return stable, de-duplicated user IDs for one fan-out operation."""
    return list(dict.fromkeys(int(user_id) for user_id in user_ids))


async def broadcast_event_to_user_groups(
    channel_layer,
    user_ids: Iterable[int],
    event: Dict[str, Any],
) -> Tuple[List[int], Dict[int, Exception]]:
    """Publish one event to personal user groups with bounded concurrency.

    A single slow or broken recipient must not cancel sends that are already in
    flight for other recipients. The caller receives exact success/failure sets
    so durable MessageStatus rows can be updated only after successful publish.
    """
    recipients = _unique_user_ids(user_ids)
    if not recipients:
        return [], {}

    concurrency = max(1, int(getattr(settings, 'CHAT_FANOUT_CONCURRENCY', 25)))
    semaphore = asyncio.Semaphore(concurrency)

    async def publish(user_id: int):
        try:
            async with semaphore:
                await channel_layer.group_send(f'chat_user_{user_id}', event)
            return user_id, None
        except Exception as exc:  # the caller decides whether/how to retry
            return user_id, exc

    results = await asyncio.gather(*(publish(user_id) for user_id in recipients))
    succeeded = [user_id for user_id, error in results if error is None]
    failed = {user_id: error for user_id, error in results if error is not None}
    return succeeded, failed


def broadcast_event_to_user_groups_sync(
    channel_layer,
    user_ids: Iterable[int],
    event: Dict[str, Any],
) -> Tuple[List[int], Dict[int, Exception]]:
    """Synchronous Celery-task wrapper around the async broadcaster."""
    return async_to_sync(broadcast_event_to_user_groups)(channel_layer, user_ids, event)

