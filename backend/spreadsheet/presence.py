"""Atomic presence storage for spreadsheet collaboration rooms.

Production uses a Redis hash for member payloads and a sorted set for
per-channel heartbeat timestamps. Lua scripts make prune/register/list/leave
single atomic operations across Channels workers.

Tests use LocMemCache, so a lock-protected compatibility store is retained for
non-Redis cache backends. Production never silently falls back when Redis is
configured: connection/script failures propagate to the consumer.
"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.core.cache import cache, caches


PRESENCE_CACHE_TTL_SECONDS = 3600
PRESENCE_STALE_AFTER_SECONDS = 30
PRESENCE_LAST_SEEN_FIELD = "_last_seen"
PRESENCE_IDENTITY_FIELD = "_identity"

_REDIS_CACHE_BACKEND = "django_redis.cache.RedisCache"
_fallback_lock = threading.RLock()
_store_lock = threading.Lock()
_redis_store = None


def _presence_cache_key(room_key: int | str) -> str:
    return f"sheet_presence:{room_key}"


def _presence_heartbeat_key(room_key: int | str) -> str:
    return f"sheet_presence_heartbeat:{room_key}"


def _identity(user_id: Any, client_id: Any) -> str:
    return f"{user_id}:{client_id or ''}"


def _entry(info: dict, now: float) -> dict:
    return {
        **info,
        PRESENCE_IDENTITY_FIELD: _identity(
            info.get("user_id"),
            info.get("client_id"),
        ),
        PRESENCE_LAST_SEEN_FIELD: now,
    }


def _public_entry(info: dict) -> dict:
    return {
        field: value
        for field, value in info.items()
        if field not in {PRESENCE_LAST_SEEN_FIELD, PRESENCE_IDENTITY_FIELD}
    }


def _prune_stale_presence(data: dict, now: float) -> tuple[dict, list[str]]:
    cutoff = now - PRESENCE_STALE_AFTER_SECONDS
    active = {}
    stale = []
    for channel_name, info in data.items():
        if (
            isinstance(info, dict)
            and isinstance(info.get(PRESENCE_LAST_SEEN_FIELD), (int, float))
            and info[PRESENCE_LAST_SEEN_FIELD] >= cutoff
        ):
            active[channel_name] = info
        else:
            stale.append(channel_name)
    return active, stale


@dataclass(frozen=True)
class PresenceSnapshot:
    users: list[dict]
    stale_channels: list[str]


@dataclass(frozen=True)
class PresenceUnregisterResult:
    same_identity_remains: bool
    stale_channels: list[str]


class CachePresenceStore:
    """Lock-protected compatibility implementation for non-Redis test caches."""

    def register(
        self,
        sheet_id: int,
        channel_name: str,
        info: dict,
        *,
        now: float | None = None,
    ) -> list[str]:
        timestamp = time.time() if now is None else now
        key = _presence_cache_key(sheet_id)
        with _fallback_lock:
            original = cache.get(key) or {}
            data, stale = _prune_stale_presence(original, timestamp)
            data[channel_name] = _entry(info, timestamp)
            cache.set(key, data, PRESENCE_CACHE_TTL_SECONDS)
        return [name for name in stale if name != channel_name]

    def unregister(
        self,
        sheet_id: int,
        channel_name: str,
        user_id: Any,
        client_id: Any,
        *,
        now: float | None = None,
    ) -> PresenceUnregisterResult:
        timestamp = time.time() if now is None else now
        key = _presence_cache_key(sheet_id)
        target_identity = _identity(user_id, client_id)
        with _fallback_lock:
            original = cache.get(key) or {}
            data, stale = _prune_stale_presence(original, timestamp)
            data.pop(channel_name, None)
            same_identity_remains = any(
                entry.get(PRESENCE_IDENTITY_FIELD)
                == target_identity
                or _identity(entry.get("user_id"), entry.get("client_id"))
                == target_identity
                for entry in data.values()
            )
            if data:
                cache.set(key, data, PRESENCE_CACHE_TTL_SECONDS)
            else:
                cache.delete(key)
        return PresenceUnregisterResult(
            same_identity_remains=same_identity_remains,
            stale_channels=[name for name in stale if name != channel_name],
        )

    def list(
        self,
        sheet_id: int,
        *,
        now: float | None = None,
    ) -> PresenceSnapshot:
        timestamp = time.time() if now is None else now
        key = _presence_cache_key(sheet_id)
        with _fallback_lock:
            original = cache.get(key) or {}
            data, stale = _prune_stale_presence(original, timestamp)
            if data != original:
                if data:
                    cache.set(key, data, PRESENCE_CACHE_TTL_SECONDS)
                else:
                    cache.delete(key)
            ordered = [
                _public_entry(info)
                for _, info in sorted(data.items(), key=lambda item: item[0])
            ]
        return PresenceSnapshot(users=ordered, stale_channels=stale)


_NORMALIZE_REDIS_KEYS_LUA = """
local hash_type = redis.call('TYPE', KEYS[1]).ok
if hash_type ~= 'none' and hash_type ~= 'hash' then
    redis.call('DEL', KEYS[1])
end
local heartbeat_type = redis.call('TYPE', KEYS[2]).ok
if heartbeat_type ~= 'none' and heartbeat_type ~= 'zset' then
    redis.call('DEL', KEYS[2])
end
"""

_PRUNE_REDIS_LUA = """
local stale = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', '(' .. ARGV[1])
if #stale > 0 then
    redis.call('HDEL', KEYS[1], unpack(stale))
    redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', '(' .. ARGV[1])
end
"""

_REGISTER_LUA = (
    _NORMALIZE_REDIS_KEYS_LUA
    + _PRUNE_REDIS_LUA
    + """
redis.call('HSET', KEYS[1], ARGV[2], ARGV[3])
redis.call('ZADD', KEYS[2], ARGV[4], ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[5])
redis.call('EXPIRE', KEYS[2], ARGV[5])
return stale
"""
)

_LIST_LUA = (
    _NORMALIZE_REDIS_KEYS_LUA
    + _PRUNE_REDIS_LUA
    + """
local entries = redis.call('HGETALL', KEYS[1])
if #entries == 0 then
    redis.call('DEL', KEYS[1], KEYS[2])
else
    redis.call('EXPIRE', KEYS[1], ARGV[2])
    redis.call('EXPIRE', KEYS[2], ARGV[2])
end
return cjson.encode({stale = stale, entries = entries})
"""
)

_UNREGISTER_LUA = (
    _NORMALIZE_REDIS_KEYS_LUA
    + """
redis.call('HDEL', KEYS[1], ARGV[1])
redis.call('ZREM', KEYS[2], ARGV[1])
"""
    + _PRUNE_REDIS_LUA.replace("ARGV[1]", "ARGV[2]")
    + """
local same_identity_remains = false
local values = redis.call('HVALS', KEYS[1])
for _, raw in ipairs(values) do
    local ok, entry = pcall(cjson.decode, raw)
    if ok and entry['_identity'] == ARGV[3] then
        same_identity_remains = true
        break
    end
end
if #values == 0 then
    redis.call('DEL', KEYS[1], KEYS[2])
else
    redis.call('EXPIRE', KEYS[1], ARGV[4])
    redis.call('EXPIRE', KEYS[2], ARGV[4])
end
return cjson.encode({
    same_identity_remains = same_identity_remains,
    stale = stale
})
"""
)


def _text(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def _list_value(value: Any) -> list:
    return value if isinstance(value, list) else []


class RedisPresenceStore:
    """Redis Hash + Sorted Set implementation with Lua atomicity."""

    def __init__(self, redis_client=None):
        if redis_client is None:
            from django_redis import get_redis_connection

            redis_client = get_redis_connection("default")
        self.redis = redis_client
        self.register_script = self.redis.register_script(_REGISTER_LUA)
        self.list_script = self.redis.register_script(_LIST_LUA)
        self.unregister_script = self.redis.register_script(_UNREGISTER_LUA)

    @staticmethod
    def _keys(sheet_id: int) -> list[str]:
        default_cache = caches["default"]
        return [
            default_cache.make_key(_presence_cache_key(sheet_id)),
            default_cache.make_key(_presence_heartbeat_key(sheet_id)),
        ]

    def register(
        self,
        sheet_id: int,
        channel_name: str,
        info: dict,
        *,
        now: float | None = None,
    ) -> list[str]:
        timestamp = time.time() if now is None else now
        result = self.register_script(
            keys=self._keys(sheet_id),
            args=[
                timestamp - PRESENCE_STALE_AFTER_SECONDS,
                channel_name,
                json.dumps(_entry(info, timestamp), separators=(",", ":")),
                timestamp,
                PRESENCE_CACHE_TTL_SECONDS,
            ],
        )
        return [
            name
            for name in (_text(value) for value in result)
            if name != channel_name
        ]

    def unregister(
        self,
        sheet_id: int,
        channel_name: str,
        user_id: Any,
        client_id: Any,
        *,
        now: float | None = None,
    ) -> PresenceUnregisterResult:
        timestamp = time.time() if now is None else now
        raw = self.unregister_script(
            keys=self._keys(sheet_id),
            args=[
                channel_name,
                timestamp - PRESENCE_STALE_AFTER_SECONDS,
                _identity(user_id, client_id),
                PRESENCE_CACHE_TTL_SECONDS,
            ],
        )
        result = json.loads(_text(raw))
        return PresenceUnregisterResult(
            same_identity_remains=bool(result.get("same_identity_remains")),
            stale_channels=[
                _text(value)
                for value in _list_value(result.get("stale"))
                if _text(value) != channel_name
            ],
        )

    def list(
        self,
        sheet_id: int,
        *,
        now: float | None = None,
    ) -> PresenceSnapshot:
        timestamp = time.time() if now is None else now
        raw = self.list_script(
            keys=self._keys(sheet_id),
            args=[
                timestamp - PRESENCE_STALE_AFTER_SECONDS,
                PRESENCE_CACHE_TTL_SECONDS,
            ],
        )
        result = json.loads(_text(raw))
        entries = _list_value(result.get("entries"))
        users_by_channel = []
        for index in range(0, len(entries), 2):
            channel_name = _text(entries[index])
            info = json.loads(_text(entries[index + 1]))
            users_by_channel.append((channel_name, _public_entry(info)))
        users_by_channel.sort(key=lambda item: item[0])
        return PresenceSnapshot(
            users=[info for _, info in users_by_channel],
            stale_channels=[
                _text(value) for value in _list_value(result.get("stale"))
            ],
        )


def get_presence_store():
    global _redis_store
    backend = settings.CACHES["default"]["BACKEND"]
    if backend == _REDIS_CACHE_BACKEND:
        if _redis_store is None:
            with _store_lock:
                if _redis_store is None:
                    _redis_store = RedisPresenceStore()
        return _redis_store
    return CachePresenceStore()
