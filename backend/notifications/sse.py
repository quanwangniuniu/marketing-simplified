"""
SSE (Server-Sent Events) support for the notifications app.

Architecture
------------
* When create_notification() saves a new Notification, it calls
  publish_notification_to_redis() which POSTs the payload to a per-user
  Redis Pub/Sub channel: ``user_{user_id}_events``.

* The HTTP endpoint GET /api/notifications/stream/ opens an SSE stream.
  The underlying async generator subscribes to that Redis channel and
  forwards every published message to the browser as an SSE event.

* Heartbeat comments ("": heartbeat) are emitted every HEARTBEAT_INTERVAL
  seconds so that Nginx's proxy_read_timeout doesn't kill the connection.

* Last-Event-ID reconnect: if the browser reconnects with a Last-Event-ID
  header (set to the created_at ISO timestamp of the last received event)
  we replay at most 50 missed notifications from the database before
  resuming live streaming.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time

from django.conf import settings
from prometheus_client import Counter, Gauge
from django.db import connections

logger = logging.getLogger(__name__)

sse_connection_drops_total = Counter(
    "sse_connection_drops_total",
    "Total number of dropped SSE connections",
)

sse_active_connections = Gauge(
    "sse_active_connections",
    "Number of currently active SSE connections",
)
HEARTBEAT_INTERVAL = 25  # seconds – below Nginx proxy_read_timeout (60 s typical)
_REDIS_DB = 0  # same DB as Celery broker; Pub/Sub is namespace-isolated by channel name


# ── helpers ──────────────────────────────────────────────────────────────────

def _redis_host_port() -> tuple[str, int]:
    """
    Derive Redis host/port from CHANNEL_LAYERS (the authoritative source for
    the Redis container address in this project).  Falls back to 'redis:6379'
    if the config is missing or malformed.
    """
    try:
        hosts = settings.CHANNEL_LAYERS["default"]["CONFIG"]["hosts"]
        host, port = hosts[0]
        return str(host), int(port)
    except Exception:
        return "redis", 6379


# ── sync publisher (called from create_notification) ─────────────────────────

def publish_notification_to_redis(user_id: int, notification) -> None:
    """
    Publish a serialized Notification to the per-user Redis Pub/Sub channel.

    This is a *synchronous* function intentionally: it is called from the
    synchronous ``create_notification()`` service inside a DB transaction.
    A short-lived Redis connection is acceptable here because notifications
    are sparse relative to the connection overhead.
    """
    import redis as sync_redis  # noqa: PLC0415

    from .serializers import NotificationSerializer  # noqa: PLC0415

    r: sync_redis.Redis | None = None
    try:
        host, port = _redis_host_port()
        r = sync_redis.Redis(
            host=host,
            port=port,
            db=_REDIS_DB,
            decode_responses=True,
            socket_timeout=2,
            socket_connect_timeout=2,
        )
        channel = f"user_{user_id}_events"
        payload = json.dumps(
            {"type": "notification", "data": NotificationSerializer(notification).data},
            default=str,
        )
        r.publish(channel, payload)
        logger.debug("SSE: published to channel=%s notification_id=%s", channel, notification.pk)
    except Exception:
        logger.exception(
            "SSE: Redis publish failed – user_id=%s notification_id=%s",
            user_id,
            getattr(notification, "pk", None),
        )
    finally:
        if r is not None:
            try:
                r.close()
            except Exception:
                pass


# ── async SSE generator ───────────────────────────────────────────────────────

async def sse_event_generator(user_id: int, last_event_id: str | None):
    """
    Async generator that yields SSE-formatted byte strings.

    Lifecycle
    ---------
    1. If *last_event_id* is given (ISO-8601 timestamp of the last event the
       browser received), replay up to 50 missed Notifications from the DB.
    2. Subscribe to Redis channel ``user_{user_id}_events``.
    3. Forward every published JSON payload as an SSE ``data:`` line, using
       the Notification's ``created_at`` as the event id.
    4. Emit a comment heartbeat every HEARTBEAT_INTERVAL seconds.
    5. On disconnect (CancelledError) or error: unsubscribe and close Redis.
    """
    import redis.asyncio as aioredis  # noqa: PLC0415
    from asgiref.sync import sync_to_async  # noqa: PLC0415

    from .models import Notification  # noqa: PLC0415
    from .serializers import NotificationSerializer  # noqa: PLC0415

    # ── 1. Replay missed notifications on reconnect ───────────────────────
    if last_event_id:
        try:
            from datetime import datetime  # noqa: PLC0415

            since_dt = datetime.fromisoformat(last_event_id.replace("Z", "+00:00"))

            def _fetch_missed():
                qs = (
                    Notification.objects.filter(
                        recipient_id=user_id,
                        created_at__gt=since_dt,
                    )
                    .order_by("created_at")[:50]
                )
                return NotificationSerializer(qs, many=True).data

            missed = await sync_to_async(_fetch_missed)()
            for item in missed:
                payload = json.dumps(
                    {"type": "notification", "data": dict(item)},
                    default=str,
                )
                event_id = item.get("created_at", "")
                yield f"id: {event_id}\ndata: {payload}\n\n"

            logger.debug(
                "SSE: replayed %d missed notification(s) for user_id=%s since %s",
                len(missed),
                user_id,
                since_dt,
            )
        except Exception:
            logger.exception("SSE: replay failed for user_id=%s", user_id)

    # ── 1b. Release the database connection before going long-lived ───────
    #
    # Everything from here on is Redis pub/sub and needs no database access,
    # but the connection opened for this request (by TenantSchemaMiddleware and
    # by the view's auth lookup) is thread-local and is only returned when the
    # request finishes — and a streaming response does not finish until the
    # client disconnects. Left alone, each open stream pins one PostgreSQL
    # connection: 30 streams measured 30 extra connections, so ~100 browser
    # tabs exhaust max_connections=100 on their own and the stack freezes until
    # the backend is restarted.
    #
    # This has to happen here rather than in the view: the middleware resets
    # search_path in a finally block that runs the moment the view returns the
    # response object, re-opening anything the view closed. The generator body
    # does not run until the response is actually being streamed, which is
    # after that. close_all() rather than close_old_connections() because the
    # latter spares connections still within CONN_MAX_AGE.
    await sync_to_async(connections.close_all)()

    # ── 2. Open Redis Pub/Sub connection ──────────────────────────────────
    host, port = _redis_host_port()
    redis_url = f"redis://{host}:{port}/{_REDIS_DB}"
    r = aioredis.from_url(redis_url, decode_responses=True)
    pubsub = r.pubsub()
    channel = f"user_{user_id}_events"
    await pubsub.subscribe(channel)
    sse_active_connections.inc()
    logger.info("SSE: user_id=%s subscribed to channel=%s", user_id, channel)

    last_heartbeat = time.monotonic()

    try:
        while True:
            # Block up to 1 s waiting for the next message, then fall through
            # to the heartbeat check so we never stall longer than ~1 s.
            message = await pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=1.0,
            )

            if message and message.get("type") == "message":
                try:
                    raw = message["data"]
                    parsed = json.loads(raw)
                    # Use the notification's created_at as the SSE event id so
                    # the browser can send Last-Event-ID on reconnect.
                    event_id = parsed.get("data", {}).get("created_at", "")
                    sse_line = f"id: {event_id}\ndata: {raw}\n\n"
                    yield sse_line
                except Exception:
                    logger.exception(
                        "SSE: failed to forward message for user_id=%s", user_id
                    )

            now = time.monotonic()
            if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                # SSE comment – browsers ignore it, but it keeps the TCP
                # connection alive through Nginx's proxy_read_timeout.
                yield ": heartbeat\n\n"
                last_heartbeat = now

    except asyncio.CancelledError:
        # Normal path: client closed the tab / navigated away.
        sse_connection_drops_total.inc()
        logger.info("SSE: stream cancelled for user_id=%s", user_id)
    except Exception:
        sse_connection_drops_total.inc()
        logger.exception("SSE: generator error for user_id=%s", user_id)
    finally:
        sse_active_connections.dec()
        try:
            await pubsub.unsubscribe(channel)
            await r.aclose()
        except Exception:
            pass
        logger.info("SSE: connection closed for user_id=%s", user_id)
