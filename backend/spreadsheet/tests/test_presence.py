import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from django.core.cache import cache
from django_redis import get_redis_connection

from spreadsheet.presence import (
    CachePresenceStore,
    PRESENCE_STALE_AFTER_SECONDS,
    RedisPresenceStore,
)


def _sheet_id() -> int:
    return uuid.uuid4().int % 2_000_000_000


@pytest.mark.integration
def test_redis_presence_register_is_atomic_under_concurrency():
    """Concurrent joins add independent hash fields instead of replacing a dict."""
    store = RedisPresenceStore(get_redis_connection("default"))
    sheet_id = _sheet_id()
    keys = store._keys(sheet_id)
    store.redis.delete(*keys)

    try:
        now = time.time()

        def register(index: int):
            return store.register(
                sheet_id,
                f"channel-{index:02d}",
                {
                    "user_id": index,
                    "username": f"user-{index}",
                    "client_id": f"client-{index}",
                },
                now=now,
            )

        with ThreadPoolExecutor(max_workers=12) as executor:
            list(executor.map(register, range(24)))

        snapshot = store.list(sheet_id, now=now)
        assert len(snapshot.users) == 24
        assert {entry["client_id"] for entry in snapshot.users} == {
            f"client-{index}" for index in range(24)
        }
    finally:
        store.redis.delete(*keys)


@pytest.mark.integration
def test_redis_presence_prune_and_duplicate_leave_are_atomic():
    store = RedisPresenceStore(get_redis_connection("default"))
    sheet_id = _sheet_id()
    keys = store._keys(sheet_id)
    store.redis.delete(*keys)

    try:
        now = time.time()
        identity = {
            "user_id": 7,
            "username": "same-user",
            "client_id": "same-client",
        }
        store.register(sheet_id, "old-channel", identity, now=now)
        store.register(sheet_id, "replacement-channel", identity, now=now)

        first_leave = store.unregister(
            sheet_id,
            "old-channel",
            identity["user_id"],
            identity["client_id"],
            now=now,
        )
        assert first_leave.same_identity_remains is True

        store.register(
            sheet_id,
            "stale-channel",
            {
                "user_id": 8,
                "username": "stale-user",
                "client_id": "stale-client",
            },
            now=now - PRESENCE_STALE_AFTER_SECONDS - 1,
        )
        stale = store.register(
            sheet_id,
            "live-channel",
            {
                "user_id": 9,
                "username": "live-user",
                "client_id": "live-client",
            },
            now=now,
        )
        assert stale == ["stale-channel"]

        last_leave = store.unregister(
            sheet_id,
            "replacement-channel",
            identity["user_id"],
            identity["client_id"],
            now=now,
        )
        assert last_leave.same_identity_remains is False
        assert [entry["client_id"] for entry in store.list(sheet_id, now=now).users] == [
            "live-client"
        ]
    finally:
        store.redis.delete(*keys)


def test_cache_presence_store_keeps_locmem_test_backend_compatible(settings):
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": f"presence-{uuid.uuid4()}",
        }
    }
    cache.clear()
    store = CachePresenceStore()
    sheet_id = _sheet_id()
    now = time.time()

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(
            executor.map(
                lambda index: store.register(
                    sheet_id,
                    f"channel-{index}",
                    {
                        "user_id": index,
                        "username": f"user-{index}",
                        "client_id": f"client-{index}",
                    },
                    now=now,
                ),
                range(16),
            )
        )

    assert len(store.list(sheet_id, now=now).users) == 16
