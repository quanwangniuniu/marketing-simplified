"""
Tests for the SSE notification stream (notifications/sse.py and notifications/views.py).

Strategy
--------
* All tests use django.test.TestCase (synchronous runner) to match the project
  convention established in the rest of the notifications test suite.
* asyncio.run() is used where we must drive async generators; Django's default
  test runner does not set up an event loop, so asyncio.run() is safe here.
* unittest.mock prevents real Redis connections AND stops the infinite-loop
  generator from hanging the test suite:
    - Redis publish  → mock redis.Redis
    - SSE generator  → either a finite sync-iterable stub (view tests)
                       or a mock pubsub that raises CancelledError after a few
                       iterations (generator unit tests)
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import urlencode

from django.test import AsyncRequestFactory, TestCase, override_settings
from django.urls import reverse
from prometheus_client import CollectorRegistry, Counter, Gauge, generate_latest
from rest_framework_simplejwt.tokens import AccessToken

from notifications.models import (
    Notification,
    NotificationCategory,
    NotificationEventType,
)
from notifications.services import create_notification
from notifications.sse import (
    _allow_replay_attempt,
    _serialize_missed_notifications,
    publish_notification_to_redis,
    sse_event_generator,
)

User = None  # lazily resolved in setUpClass to avoid import-time issues


def _get_user_model():
    from django.contrib.auth import get_user_model  # noqa: PLC0415

    return get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────

def _finite_sync_gen(*args, **kwargs):
    """
    Synchronous iterable stub – returned when sse_event_generator is mocked in
    the view auth tests.  StreamingHttpResponse accepts sync iterables so the
    test client can consume the response without event-loop gymnastics.
    """
    return iter([b"data: ok\n\n", b": heartbeat\n\n"])


def _make_mock_pubsub(*, stop_after: int = 3):
    """
    Return a mock async pubsub whose get_message() returns None for the first
    ``stop_after - 1`` calls and raises CancelledError on the last call.
    This gives the generator a bounded number of loop iterations.
    """
    call_count = 0

    async def _get_message(*_, **__):
        nonlocal call_count
        call_count += 1
        if call_count >= stop_after:
            raise asyncio.CancelledError
        return None

    mock_pubsub = AsyncMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.get_message = _get_message
    return mock_pubsub


def _make_mock_redis(pubsub=None):
    """Return a mock async Redis client backed by the given pubsub."""
    mock_r = AsyncMock()
    mock_r.pubsub = MagicMock(return_value=pubsub or _make_mock_pubsub())
    mock_r.aclose = AsyncMock()
    return mock_r


async def _collect(gen, *, max_events: int = 20):
    """
    Consume an async generator up to ``max_events`` items.

    Stops cleanly on CancelledError (raised by our mock pubsub to terminate
    the generator after a bounded number of iterations).
    """
    events = []
    try:
        async for event in gen:
            events.append(event)
            if len(events) >= max_events:
                break
    except asyncio.CancelledError:
        pass
    finally:
        try:
            await gen.aclose()
        except Exception:
            pass
    return events


# ─────────────────────────────────────────────────────────────────────────────
# 1. View – authentication tests
# ─────────────────────────────────────────────────────────────────────────────

class SSEViewAuthTests(TestCase):
    """
    Verify that stream_notifications correctly gates access.

    Strategy
    --------
    The view is an ``async def`` and uses ``sync_to_async(User.objects.get)``
    which opens a separate DB connection in a thread-pool worker.  TestCase
    wraps every test in an uncommitted transaction, so those workers cannot see
    the test user rows.

    To avoid this thread-isolation problem the *positive* tests (valid token)
    mock ``get_user_model`` so no real DB query is made: the view gets the
    token user returned directly.  The *negative* tests (invalid / missing
    token) return 401 before any DB call so no mock is needed.

    All requests are built with ``AsyncRequestFactory`` (returns ASGIRequest).
    IMPORTANT: ASGIRequest headers must be passed via the ``headers=`` dict
    kwarg, not via ``HTTP_*`` META keys (which get double-prefixed as
    ``HTTP_HTTP_*`` and are silently ignored).

    asyncio.run() dispatches the coroutine; no event-loop is left running so
    there is no interference with TestCase transaction handling.
    """

    def setUp(self):
        User = _get_user_model()
        self.factory = AsyncRequestFactory()
        self.user = User.objects.create_user(
            username="sse_auth_user",
            password="pass12345",
            email="sse_auth@example.com",
        )
        self.token = str(AccessToken.for_user(self.user))

    def _get(
        self,
        path,
        *,
        auth_header: str | None = None,
        query_token: str | None = None,
        last_event_id: str | None = None,
        last_event_created_at: str | None = None,
        mock_user=None,
    ):
        """
        Invoke stream_notifications directly as an async view.

        ``auth_header``  – value for the Authorization request header.
        ``query_token``  – appended to the path as ``?token=<value>``.
        ``mock_user``    – if set, patch ``get_user_model`` to return this user
                           (avoids thread-pool DB lookup that TestCase hides).
        """
        from notifications.views import stream_notifications  # noqa: PLC0415

        query_params = {}
        if query_token:
            query_params["token"] = query_token
        if last_event_id:
            query_params["lastEventId"] = last_event_id
        if last_event_created_at:
            query_params["lastEventCreatedAt"] = last_event_created_at
        url = f"{path}?{urlencode(query_params)}" if query_params else path
        req_kwargs: dict = {}
        if auth_header is not None:
            req_kwargs["headers"] = {"Authorization": auth_header}

        async def _req():
            request = self.factory.get(url, **req_kwargs)
            return await stream_notifications(request)

        if mock_user is not None:
            mock_model = MagicMock()
            mock_model.objects.get.return_value = mock_user
            ctx = patch("notifications.views.get_user_model", return_value=mock_model)
        else:
            from contextlib import nullcontext  # noqa: PLC0415
            ctx = nullcontext()

        with ctx:
            return asyncio.run(_req())

    # ── negative cases – no DB access, no mock needed ─────────────────────

    def test_no_token_returns_401(self):
        """Request with no credentials → 401."""
        r = self._get(reverse("notifications-stream"))
        self.assertEqual(r.status_code, 401)

    def test_empty_bearer_returns_401(self):
        """Authorization header present but no actual token string → 401."""
        r = self._get(reverse("notifications-stream"), auth_header="Bearer ")
        self.assertEqual(r.status_code, 401)

    def test_malformed_token_returns_401(self):
        """A token that is not a valid JWT → 401."""
        r = self._get(
            reverse("notifications-stream"),
            auth_header="Bearer not.a.valid.jwt",
        )
        self.assertEqual(r.status_code, 401)

    # ── positive cases – mock user to bypass thread-pool DB lookup ─────────

    def test_valid_bearer_header_returns_200_with_sse_content_type(self):
        """Valid Bearer token in Authorization header → 200, text/event-stream."""
        with patch("notifications.views.sse_event_generator", _finite_sync_gen):
            r = self._get(
                reverse("notifications-stream"),
                auth_header=f"Bearer {self.token}",
                mock_user=self.user,
            )
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/event-stream", r.get("Content-Type", ""))

    def test_valid_bearer_header_sets_nginx_and_cache_headers(self):
        """Response must include headers that prevent Nginx buffering and browser caching."""
        with patch("notifications.views.sse_event_generator", _finite_sync_gen):
            r = self._get(
                reverse("notifications-stream"),
                auth_header=f"Bearer {self.token}",
                mock_user=self.user,
            )
        self.assertEqual(r.get("X-Accel-Buffering"), "no")
        self.assertEqual(r.get("Cache-Control"), "no-cache")

    def test_valid_query_param_token_returns_200(self):
        """
        Native EventSource cannot set custom headers; the JWT must also be
        accepted via the ?token= query parameter.
        """
        with patch("notifications.views.sse_event_generator", _finite_sync_gen):
            r = self._get(
                reverse("notifications-stream"),
                query_token=self.token,
                mock_user=self.user,
            )
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/event-stream", r.get("Content-Type", ""))

    def test_bearer_header_takes_precedence_over_query_param(self):
        """
        When both header and query-param tokens are present, the Bearer header
        must win (higher-priority auth channel).
        """
        User = _get_user_model()
        other_user = User.objects.create_user(
            username="other_sse_user",
            password="pass12345",
            email="other_sse@example.com",
        )
        other_token = str(AccessToken.for_user(other_user))

        # Capture the user_id that reaches sse_event_generator.
        captured: list[int] = []

        def _capturing_gen(user_id, last_event_id, last_event_created_at=None):
            captured.append(user_id)
            return iter([])

        with patch("notifications.views.sse_event_generator", _capturing_gen):
            r = self._get(
                reverse("notifications-stream"),
                # header carries self.user's token → should win
                auth_header=f"Bearer {self.token}",
                # query-param carries other_user's token → should lose
                query_token=other_token,
                # bearer header wins, so self.user is always the resolved user
                mock_user=self.user,
            )

        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(captured), 1, "generator must be called exactly once")
        self.assertEqual(
            captured[0],
            self.user.id,
            "user_id from the Bearer header token must be used",
        )

    def test_reconnect_forwards_uuid_and_created_at_fallback(self):
        captured = []

        def _capturing_gen(user_id, last_event_id, last_event_created_at=None):
            captured.append((user_id, last_event_id, last_event_created_at))
            return iter([])

        with (
            patch("notifications.views._allow_replay_attempt", return_value=True),
            patch("notifications.views.sse_event_generator", _capturing_gen),
        ):
            response = self._get(
                reverse("notifications-stream"),
                query_token=self.token,
                last_event_id="11111111-1111-1111-1111-111111111111",
                last_event_created_at="2026-08-22T10:00:00Z",
                mock_user=self.user,
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            captured,
            [
                (
                    self.user.id,
                    "11111111-1111-1111-1111-111111111111",
                    "2026-08-22T10:00:00Z",
                )
            ],
        )

    @override_settings(NOTIFICATION_SSE_REPLAY_RATE_WINDOW_SECONDS=30)
    def test_replay_rate_limit_returns_429_with_retry_after(self):
        generator = MagicMock(return_value=iter([]))
        with (
            patch("notifications.views._allow_replay_attempt", return_value=False),
            patch("notifications.views.sse_event_generator", generator),
        ):
            response = self._get(
                reverse("notifications-stream"),
                query_token=self.token,
                last_event_id="11111111-1111-1111-1111-111111111111",
                mock_user=self.user,
            )

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response["Retry-After"], "30")
        generator.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# 2. Publisher – publish_notification_to_redis unit tests
# ─────────────────────────────────────────────────────────────────────────────

class SSEPublisherTests(TestCase):
    """
    Unit tests for notifications.sse.publish_notification_to_redis.
    Real Redis is never touched – redis.Redis is mocked throughout.
    """

    def setUp(self):
        User = _get_user_model()
        self.recipient = User.objects.create_user(
            username="pub_recipient",
            password="p",
            email="pub_recipient@e.com",
        )
        self.actor = User.objects.create_user(
            username="pub_actor",
            password="p",
            email="pub_actor@e.com",
        )
        # Create a Notification row without touching Redis.
        with patch("notifications.services._push_notification_to_redis"):
            self.notif = create_notification(
                recipient_id=self.recipient.id,
                actor_id=self.actor.id,
                category=NotificationCategory.TASKS,
                event_type=NotificationEventType.TASK_ASSIGNED,
                title="Publisher test",
            )
        self.assertIsNotNone(self.notif)

    def test_publishes_to_correct_channel(self):
        """publish_notification_to_redis calls r.publish on user_{id}_events."""
        mock_r = MagicMock()
        with patch("redis.Redis", return_value=mock_r):
            publish_notification_to_redis(self.recipient.id, self.notif)

        mock_r.publish.assert_called_once()
        channel = mock_r.publish.call_args[0][0]
        self.assertEqual(channel, f"user_{self.recipient.id}_events")

    def test_payload_is_valid_json_with_notification_type(self):
        """The published payload must be valid JSON with type='notification'."""
        mock_r = MagicMock()
        with patch("redis.Redis", return_value=mock_r):
            publish_notification_to_redis(self.recipient.id, self.notif)

        raw_payload = mock_r.publish.call_args[0][1]
        parsed = json.loads(raw_payload)
        self.assertEqual(parsed["type"], "notification")
        self.assertIn("data", parsed)
        self.assertEqual(parsed["data"]["title"], "Publisher test")

    def test_redis_connection_error_is_swallowed(self):
        """
        A Redis connection failure must NOT propagate – the notification has
        already been persisted to the DB; SSE is a best-effort push.
        """
        with patch("redis.Redis", side_effect=ConnectionError("redis down")):
            # Must not raise
            publish_notification_to_redis(self.recipient.id, self.notif)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Generator – Last-Event-ID replay tests
# ─────────────────────────────────────────────────────────────────────────────

class SSEGeneratorReplayTests(TestCase):
    """
    Verify that sse_event_generator replays missed notifications when a
    Last-Event-ID is supplied.

    The entire DB interaction inside the generator is mocked via
    asgiref.sync.sync_to_async so we avoid threading / transaction isolation
    issues that arise when driving async Django ORM from asyncio.run().
    """

    # Fake serialised notification data that the mock will return.
    _FAKE_MISSED: list[dict] = [
        {
            "id": "aaaabbbb-0000-0000-0000-aabbccddeeff",
            "title": "Missed notification",
            "event_type": "task_assigned",
            "category": "TASKS",
            "body": "",
            "is_read": False,
            "action_url": "/tasks/42",
            "metadata": {},
            "related_object_type": "task",
            "related_object_id": "42",
            "created_at": "2024-01-15T10:00:00.000000+00:00",
        }
    ]

    def _run_replay(self, last_event_id: str, fake_data: list) -> list[str]:
        """
        Drive sse_event_generator with mocked DB data and a mock pubsub
        that stops iteration via CancelledError right after the replay phase.
        """
        mock_pubsub = _make_mock_pubsub(stop_after=1)
        mock_redis = _make_mock_redis(pubsub=mock_pubsub)

        # async_replay_mock is what sync_to_async(fn) returns: a coroutine func.
        async_replay_mock = AsyncMock(return_value=(fake_data, False))

        async def run():
            return await _collect(sse_event_generator(1, last_event_id))

        with (
            patch("redis.asyncio.from_url", return_value=mock_redis),
            patch("asgiref.sync.sync_to_async", return_value=async_replay_mock),
        ):
            return asyncio.run(run())

    def test_replay_yields_missed_notification_data(self):
        """
        When Last-Event-ID is provided, each missed notification must be
        yielded as an SSE data: line whose payload contains the notification.
        """
        events = self._run_replay(
            last_event_id="11111111-1111-1111-1111-111111111111",
            fake_data=self._FAKE_MISSED,
        )

        combined = "".join(events)
        # At least one event should be a data line.
        self.assertIn("data:", combined)
        # The notification title must appear in the serialised payload.
        self.assertIn("Missed notification", combined)

    def test_replay_event_includes_id_field(self):
        """Each replayed event must carry the Notification UUID as its SSE id."""
        events = self._run_replay(
            last_event_id="11111111-1111-1111-1111-111111111111",
            fake_data=self._FAKE_MISSED,
        )
        combined = "".join(events)
        self.assertIn("id: aaaabbbb-0000-0000-0000-aabbccddeeff", combined)

    def test_full_replay_batch_ends_stream_before_live_loop(self):
        mock_pubsub = AsyncMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.get_message = AsyncMock(
            side_effect=AssertionError("live loop must wait for the next batch")
        )
        mock_redis = _make_mock_redis(pubsub=mock_pubsub)

        async def run():
            return await _collect(
                sse_event_generator(
                    1,
                    "11111111-1111-1111-1111-111111111111",
                )
            )

        with (
            patch("redis.asyncio.from_url", return_value=mock_redis),
            patch(
                "asgiref.sync.sync_to_async",
                return_value=AsyncMock(return_value=(self._FAKE_MISSED, True)),
            ),
        ):
            events = asyncio.run(run())

        self.assertEqual(len(events), 1)
        mock_pubsub.get_message.assert_not_awaited()

    def test_live_copy_of_replayed_event_is_not_delivered_twice(self):
        raw = json.dumps({"type": "notification", "data": self._FAKE_MISSED[0]})
        calls = 0

        async def _get_message(*_, **__):
            nonlocal calls
            calls += 1
            if calls == 1:
                return {"type": "message", "data": raw}
            raise asyncio.CancelledError

        mock_pubsub = AsyncMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.get_message = _get_message
        mock_redis = _make_mock_redis(pubsub=mock_pubsub)

        def _sync_to_async(func):
            if getattr(func, "__name__", "") == "_serialize_missed_notifications":
                return AsyncMock(return_value=(self._FAKE_MISSED, False))
            return AsyncMock(return_value=None)

        async def run():
            return await _collect(
                sse_event_generator(
                    1,
                    "11111111-1111-1111-1111-111111111111",
                )
            )

        with (
            patch("redis.asyncio.from_url", return_value=mock_redis),
            patch("asgiref.sync.sync_to_async", side_effect=_sync_to_async),
        ):
            events = asyncio.run(run())

        self.assertEqual("".join(events).count("Missed notification"), 1)

    def test_no_replay_when_last_event_id_is_absent(self):
        """
        Without Last-Event-ID the generator must skip the replay DB query.

        Asserted on what was handed to sync_to_async rather than on the call
        count: the generator also releases the request's database connection
        through sync_to_async before going long-lived, so "never called" would
        no longer distinguish "no replay" from "no work at all".
        """
        mock_pubsub = _make_mock_pubsub(stop_after=1)
        mock_redis = _make_mock_redis(pubsub=mock_pubsub)

        async def run():
            return await _collect(sse_event_generator(1, None))

        with (
            patch("redis.asyncio.from_url", return_value=mock_redis),
            patch("asgiref.sync.sync_to_async", return_value=AsyncMock()) as mock_s2a,
        ):
            asyncio.run(run())

        wrapped = [
            getattr(call.args[0], "__name__", "")
            for call in mock_s2a.call_args_list
            if call.args
        ]
        self.assertNotIn("_serialize_missed_notifications", wrapped)


class SSEReplayQueryTests(TestCase):
    def setUp(self):
        User = _get_user_model()
        self.recipient = User.objects.create_user(
            username="replay_recipient",
            email="replay_recipient@example.com",
        )
        self.other_user = User.objects.create_user(
            username="replay_other",
            email="replay_other@example.com",
        )

    def _notification(self, recipient, title):
        return Notification.objects.create(
            recipient=recipient,
            category=NotificationCategory.TASKS,
            event_type=NotificationEventType.TASK_ASSIGNED,
            title=title,
        )

    def test_replay_uses_unique_id_cursor_and_excludes_other_users(self):
        cursor = self._notification(self.recipient, "Already received")
        missed = self._notification(self.recipient, "Missed")
        self._notification(self.other_user, "Private to another user")

        replay, has_more = _serialize_missed_notifications(
            self.recipient.id,
            str(cursor.id),
        )

        self.assertEqual([str(item["id"]) for item in replay], [str(missed.id)])
        self.assertFalse(has_more)

    def test_unknown_cursor_does_not_replay_history(self):
        self._notification(self.recipient, "Existing")

        replay, has_more = _serialize_missed_notifications(
            self.recipient.id,
            "11111111-1111-1111-1111-111111111111",
        )

        self.assertEqual(replay, [])
        self.assertFalse(has_more)

    def test_deleted_cursor_uses_created_at_fallback(self):
        cursor = self._notification(self.recipient, "Deleted cursor")
        cursor_id = str(cursor.id)
        fallback_created_at = cursor.created_at.isoformat()
        cursor.delete()
        missed = self._notification(self.recipient, "Missed after deletion")
        self._notification(self.other_user, "Private to another user")

        replay, has_more = _serialize_missed_notifications(
            self.recipient.id,
            cursor_id,
            fallback_created_at,
        )

        self.assertEqual([str(item["id"]) for item in replay], [str(missed.id)])
        self.assertFalse(has_more)

    def test_deleted_cursor_fallback_keeps_equal_timestamp_notification(self):
        cursor = self._notification(self.recipient, "Deleted cursor")
        same_timestamp = self._notification(self.recipient, "Same timestamp")
        Notification.objects.filter(pk=same_timestamp.pk).update(
            created_at=cursor.created_at
        )
        cursor_id = str(cursor.id)
        fallback_created_at = cursor.created_at.isoformat()
        cursor.delete()

        replay, has_more = _serialize_missed_notifications(
            self.recipient.id,
            cursor_id,
            fallback_created_at,
        )

        self.assertEqual(
            [str(item["id"]) for item in replay],
            [str(same_timestamp.id)],
        )
        self.assertFalse(has_more)

    def test_malformed_uuid_without_fallback_is_quietly_ignored(self):
        replay, has_more = _serialize_missed_notifications(
            self.recipient.id,
            "not-a-uuid",
        )

        self.assertEqual(replay, [])
        self.assertFalse(has_more)

    @override_settings(NOTIFICATION_SSE_REPLAY_BATCH_SIZE=2)
    def test_replay_is_limited_to_configured_batch_size(self):
        cursor = self._notification(self.recipient, "Already received")
        expected = [
            self._notification(self.recipient, f"Missed {index}")
            for index in range(3)
        ]

        replay, has_more = _serialize_missed_notifications(
            self.recipient.id,
            str(cursor.id),
        )

        self.assertEqual(
            [str(item["id"]) for item in replay],
            [str(item.id) for item in expected[:2]],
        )
        self.assertTrue(has_more)


class SSEReplayRateLimiterTests(TestCase):
    @override_settings(
        NOTIFICATION_SSE_REPLAY_RATE_LIMIT=5,
        NOTIFICATION_SSE_REPLAY_RATE_WINDOW_SECONDS=30,
    )
    def test_uses_redis_rolling_window(self):
        redis_client = MagicMock()
        redis_client.eval.return_value = 1

        with patch(
            "django_redis.get_redis_connection",
            return_value=redis_client,
        ):
            allowed = _allow_replay_attempt(42)

        self.assertTrue(allowed)
        args = redis_client.eval.call_args.args
        self.assertEqual(args[1], 1)
        self.assertEqual(args[2], "mediajira:sse:replay-rate:42")
        self.assertEqual(args[5], 5)
        self.assertEqual(args[7], 30_000)

    def test_rejects_replay_when_rolling_window_is_full(self):
        redis_client = MagicMock()
        redis_client.eval.return_value = 0

        with patch(
            "django_redis.get_redis_connection",
            return_value=redis_client,
        ):
            self.assertFalse(_allow_replay_attempt(42))

    def test_fails_open_when_redis_is_unavailable(self):
        with patch(
            "django_redis.get_redis_connection",
            side_effect=ConnectionError("redis unavailable"),
        ):
            self.assertTrue(_allow_replay_attempt(42))


class SSEMetricsTests(TestCase):
    def test_metrics_emitted_when_connection_drops(self):
        registry = CollectorRegistry()

        active = Gauge(
            "sse_active_connections",
            "Number of currently active SSE connections",
            registry=registry,
        )
        drops = Counter(
            "sse_connection_drops_total",
            "Total number of dropped SSE connections",
            registry=registry,
        )

        mock_pubsub = _make_mock_pubsub(stop_after=1)
        mock_redis = _make_mock_redis(pubsub=mock_pubsub)

        async def run():
            await _collect(sse_event_generator(1, None))

        with (
            patch("redis.asyncio.from_url", return_value=mock_redis),
            patch("notifications.sse.sse_active_connections", active),
            patch("notifications.sse.sse_connection_drops_total", drops),
        ):
            asyncio.run(run())

        metrics = generate_latest(registry).decode()

        self.assertIn("sse_active_connections 0.0", metrics)
        self.assertIn("sse_connection_drops_total 1.0", metrics)

# ─────────────────────────────────────────────────────────────────────────────
# 4. Generator – heartbeat tests
# ─────────────────────────────────────────────────────────────────────────────

class SSEGeneratorHeartbeatTests(TestCase):
    """
    Verify that sse_event_generator emits SSE comment heartbeats when the
    HEARTBEAT_INTERVAL elapses.

    Setting HEARTBEAT_INTERVAL to 0 means the condition ``elapsed >= interval``
    is always True, so a heartbeat is emitted on every loop iteration.
    """

    def _run_with_heartbeat_interval_zero(self, user_id: int = 1, iterations: int = 3) -> list[str]:
        mock_pubsub = _make_mock_pubsub(stop_after=iterations)
        mock_redis = _make_mock_redis(pubsub=mock_pubsub)

        async def run():
            return await _collect(sse_event_generator(user_id, None))

        with (
            patch("redis.asyncio.from_url", return_value=mock_redis),
            # No replay needed – no last_event_id
            patch("notifications.sse.HEARTBEAT_INTERVAL", 0),
        ):
            return asyncio.run(run())

    def test_heartbeat_comment_is_emitted(self):
        """The generator must yield an SSE comment line for keepalive."""
        events = self._run_with_heartbeat_interval_zero()
        heartbeats = [e for e in events if e.strip().startswith(": heartbeat")]
        self.assertTrue(
            len(heartbeats) >= 1,
            f"Expected at least one heartbeat comment, got events={events!r}",
        )

    def test_heartbeat_format_is_sse_comment(self):
        """Heartbeat must be a valid SSE comment (starts with ': ')."""
        events = self._run_with_heartbeat_interval_zero()
        for event in events:
            if "heartbeat" in event:
                self.assertTrue(
                    event.startswith(": "),
                    f"Heartbeat event must start with ': ', got {event!r}",
                )

    def test_no_data_events_when_no_messages(self):
        """
        When the Redis pub/sub returns no messages, only heartbeat comments
        should be yielded (no spurious 'data:' lines).
        """
        events = self._run_with_heartbeat_interval_zero()
        data_events = [e for e in events if e.strip().startswith("data:")]
        self.assertEqual(
            len(data_events),
            0,
            f"Expected no data: events when pub/sub is empty, got {data_events!r}",
        )
