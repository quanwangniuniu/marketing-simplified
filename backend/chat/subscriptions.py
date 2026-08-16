"""Concurrency-safe bookkeeping for one chat WebSocket's group subscriptions.

The registry owns chat-group Channel Layer operations and the matching local
state. It intentionally knows nothing about Django models, authentication or
the WebSocket protocol, so its concurrency and failure behaviour can be tested
with a small in-memory channel-layer stand-in.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Collection, Mapping, Protocol, TypeVar

from .metrics import chat_active_subscriptions, chat_subscription_leaks_total


logger = logging.getLogger(__name__)
T = TypeVar('T')


class ChannelLayerProtocol(Protocol):
    """The small part of a Channels layer used by the registry."""

    async def group_add(self, group: str, channel: str) -> None: ...

    async def group_discard(self, group: str, channel: str) -> None: ...

    async def group_send(self, group: str, message: dict[str, Any]) -> None: ...


@dataclass(frozen=True)
class SubscriptionDelta:
    """Chat-group changes completed by one successful sync."""

    added: frozenset[str]
    removed: frozenset[str]


@dataclass(frozen=True)
class CleanupResult:
    """Outcome of terminal registry cleanup for one connection."""

    subscriptions: frozenset[str]
    released: frozenset[str]
    leaked: frozenset[str]


class SubscriptionRegistry:
    """Thread-safe chat-group subscriptions for one channel connection.

    Operations from foreign threads are marshalled to the event loop that
    created the registry. Channel Layer I/O and local state changes are then
    serialized under one lock. State is updated after each successful I/O
    operation, so a partial failure never makes the registry claim an operation
    happened when the layer rejected it.
    """

    def __init__(
        self,
        channel_layer: ChannelLayerProtocol,
        channel_name: str,
    ) -> None:
        self._channel_layer = channel_layer
        self._channel_name = channel_name
        self._groups: set[str] = set()
        try:
            self._owner_loop = asyncio.get_running_loop()
        except RuntimeError as exc:
            raise RuntimeError(
                'subscription registry must be created inside a running event loop'
            ) from exc
        self._lock = asyncio.Lock()
        self._closed = False

    async def add(self, group_name: str) -> bool:
        """Subscribe this connection to ``group_name`` if it is not present."""
        return await self._run_on_owner(lambda: self._add(group_name))

    async def _add(self, group_name: str) -> bool:
        async with self._lock:
            self._ensure_open()
            return await self._add_locked(group_name)

    async def remove(self, group_name: str) -> bool:
        """Discard this connection from ``group_name`` if it is present."""
        return await self._run_on_owner(lambda: self._remove(group_name))

    async def _remove(self, group_name: str) -> bool:
        async with self._lock:
            self._ensure_open()
            return await self._remove_locked(group_name)

    async def sync(self, allowed: Collection[str]) -> SubscriptionDelta:
        """Make tracked subscriptions exactly match ``allowed``.

        Revocations run before joins. If a layer call raises, successfully
        completed operations remain reflected in ``snapshot()`` and the error
        propagates so the consumer can close an untrustworthy connection.
        """
        target = frozenset(allowed)
        return await self._run_on_owner(lambda: self._sync(target))

    async def _sync(self, target: frozenset[str]) -> SubscriptionDelta:
        async with self._lock:
            self._ensure_open()
            to_remove = self._groups - target
            to_add = target - self._groups
            removed: set[str] = set()
            added: set[str] = set()

            for group_name in sorted(to_remove):
                if await self._remove_locked(group_name):
                    removed.add(group_name)
            for group_name in sorted(to_add):
                if await self._add_locked(group_name):
                    added.add(group_name)

            return SubscriptionDelta(
                added=frozenset(added),
                removed=frozenset(removed),
            )

    async def clear(self) -> CleanupResult:
        """Best-effort terminal cleanup of every tracked subscription.

        All groups are attempted even if one discard fails. Failed groups are
        reported as possible leaks, while the local registry and active gauge
        are always released because this connection no longer owns them.
        Calling ``clear`` more than once is harmless.
        """
        return await self._run_on_owner(self._clear)

    async def _clear(self) -> CleanupResult:
        async with self._lock:
            if self._closed:
                return CleanupResult(frozenset(), frozenset(), frozenset())

            self._closed = True
            subscriptions = frozenset(self._groups)
            released: set[str] = set()
            leaked: set[str] = set()

            for group_name in sorted(subscriptions):
                try:
                    await self._channel_layer.group_discard(
                        group_name,
                        self._channel_name,
                    )
                except Exception:
                    leaked.add(group_name)
                    logger.exception(
                        'Failed to discard chat subscription during cleanup: group=%s',
                        group_name,
                    )
                else:
                    released.add(group_name)
                finally:
                    # The registry is terminal after clear. A failed discard is
                    # represented by the leak counter, not by a permanently
                    # drifting gauge owned by an object that is about to die.
                    self._groups.discard(group_name)
                    chat_active_subscriptions.dec()

            if leaked:
                chat_subscription_leaks_total.labels(
                    reason='discard_failed'
                ).inc(len(leaked))

            return CleanupResult(
                subscriptions=subscriptions,
                released=frozenset(released),
                leaked=frozenset(leaked),
            )

    async def snapshot(self) -> frozenset[str]:
        """Return an immutable, consistent view of current subscriptions."""
        return await self._run_on_owner(self._snapshot)

    async def _snapshot(self) -> frozenset[str]:
        async with self._lock:
            return frozenset(self._groups)

    async def dispatch(
        self,
        event: Mapping[str, Any],
        *,
        groups: Collection[str] | None = None,
    ) -> frozenset[str]:
        """Publish ``event`` to tracked groups, or an explicit group snapshot.

        Explicit groups support disconnect ordering: the connection first
        leaves its groups, then publishes its offline presence to the groups it
        just left without reintroducing a subscription.
        """
        message = dict(event)
        targets = None if groups is None else frozenset(groups)
        return await self._run_on_owner(
            lambda: self._dispatch(message, groups=targets)
        )

    async def _dispatch(
        self,
        event: dict[str, Any],
        *,
        groups: frozenset[str] | None,
    ) -> frozenset[str]:
        async with self._lock:
            targets = set(self._groups if groups is None else groups)
            sent: set[str] = set()
            for group_name in sorted(targets):
                await self._channel_layer.group_send(group_name, event)
                sent.add(group_name)
            return frozenset(sent)

    async def _run_on_owner(
        self,
        operation: Callable[[], Awaitable[T]],
    ) -> T:
        """Run state and Channel Layer work on the registry's owner loop.

        Normal ASGI calls take the direct path. A caller in another OS thread
        submits through asyncio's thread-safe loop bridge, keeping the registry
        thread-safe without moving a Channels client to a foreign event loop.
        """
        current_loop = asyncio.get_running_loop()
        if current_loop is self._owner_loop:
            return await operation()
        if self._owner_loop.is_closed():
            raise RuntimeError('subscription registry owner event loop is closed')

        future = asyncio.run_coroutine_threadsafe(operation(), self._owner_loop)
        return await asyncio.wrap_future(future)

    async def _add_locked(self, group_name: str) -> bool:
        if group_name in self._groups:
            return False
        await self._channel_layer.group_add(group_name, self._channel_name)
        self._groups.add(group_name)
        chat_active_subscriptions.inc()
        return True

    async def _remove_locked(self, group_name: str) -> bool:
        if group_name not in self._groups:
            return False
        await self._channel_layer.group_discard(group_name, self._channel_name)
        self._groups.remove(group_name)
        chat_active_subscriptions.dec()
        return True

    def _ensure_open(self) -> None:
        if self._closed:
            raise RuntimeError('subscription registry is closed')
