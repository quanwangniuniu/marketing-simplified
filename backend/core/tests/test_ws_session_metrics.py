"""Tests for the ws_sessions_active gauge on the instrumented consumer base."""

import pytest
from channels.testing import WebsocketCommunicator
from prometheus_client import REGISTRY

from asset.consumers import AssetConsumer
from chat.consumers import ChatConsumer
from core.consumers import InstrumentedAsyncWebsocketConsumer
from csm.consumers import CsmConversationConsumer
from meetings.consumers import MeetingDocumentConsumer
from portal.consumers import PortalConversationConsumer
from retrospective.consumers import RetrospectiveConsumer
from spreadsheet.consumers import SheetConsumer

WEBSOCKET_CONSUMERS = [
    AssetConsumer,
    ChatConsumer,
    CsmConversationConsumer,
    MeetingDocumentConsumer,
    PortalConversationConsumer,
    RetrospectiveConsumer,
    SheetConsumer,
]


class AcceptingConsumer(InstrumentedAsyncWebsocketConsumer):
    ws_channel = 'test_accepting'

    async def connect(self):
        await self.accept()


class RejectingConsumer(InstrumentedAsyncWebsocketConsumer):
    ws_channel = 'test_rejecting'

    async def connect(self):
        # Same shape as the real consumers' auth failures: close, no accept.
        await self.close(code=4001)


class CrashingConsumer(InstrumentedAsyncWebsocketConsumer):
    ws_channel = 'test_crashing'

    async def connect(self):
        await self.accept()
        raise RuntimeError('post-accept initialization blew up')


class DoubleAcceptConsumer(InstrumentedAsyncWebsocketConsumer):
    ws_channel = 'test_double_accept'

    async def connect(self):
        await self.accept()
        await self.accept()


class DoubleCloseConsumer(InstrumentedAsyncWebsocketConsumer):
    """chat closes in 6 places and spreadsheet in 7; some paths can overlap."""

    ws_channel = 'test_double_close'

    async def connect(self):
        await self.accept()
        await self.close(code=1011)
        await self.close(code=1011)


@pytest.fixture(autouse=True)
def in_memory_channel_layer(settings):
    """Keep the consumers off the Redis layer these tests do not need."""
    settings.CHANNEL_LAYERS = {
        'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}
    }


def active_sessions(channel):
    return REGISTRY.get_sample_value('ws_sessions_active', {'channel': channel})


async def test_accepted_connection_is_counted_until_disconnect():
    communicator = WebsocketCommunicator(AcceptingConsumer.as_asgi(), '/ws/test/')

    connected, _ = await communicator.connect()
    assert connected
    assert active_sessions('test_accepting') == 1

    await communicator.disconnect()
    assert active_sessions('test_accepting') == 0


async def test_concurrent_sessions_are_counted_independently():
    first = WebsocketCommunicator(AcceptingConsumer.as_asgi(), '/ws/test/')
    second = WebsocketCommunicator(AcceptingConsumer.as_asgi(), '/ws/test/')
    await first.connect()
    await second.connect()
    assert active_sessions('test_accepting') == 2

    await first.disconnect()
    assert active_sessions('test_accepting') == 1

    await second.disconnect()
    assert active_sessions('test_accepting') == 0


async def test_rejected_handshake_is_never_counted():
    """Channels delivers websocket.disconnect for rejected handshakes too.

    Counting on connect() rather than accept() would decrement a session that
    was never counted and drive the gauge negative.
    """
    communicator = WebsocketCommunicator(RejectingConsumer.as_asgi(), '/ws/test/')

    connected, _ = await communicator.connect()
    assert not connected
    assert active_sessions('test_rejecting') == 0

    await communicator.disconnect()
    assert active_sessions('test_rejecting') == 0


async def test_session_is_released_when_the_consumer_crashes_after_accepting():
    """A consumer that raises post-accept never reaches disconnect().

    Releasing there instead of around the whole connection would keep the
    session counted until the process restarted.
    """
    communicator = WebsocketCommunicator(CrashingConsumer.as_asgi(), '/ws/test/')

    await communicator.connect()
    with pytest.raises(RuntimeError, match='post-accept'):
        await communicator.wait(timeout=5)

    assert active_sessions('test_crashing') == 0


async def test_accepting_twice_counts_one_session():
    communicator = WebsocketCommunicator(DoubleAcceptConsumer.as_asgi(), '/ws/test/')

    await communicator.connect()
    assert active_sessions('test_double_accept') == 1

    await communicator.disconnect()
    assert active_sessions('test_double_accept') == 0


async def test_closing_twice_releases_one_session():
    communicator = WebsocketCommunicator(DoubleCloseConsumer.as_asgi(), '/ws/test/')

    await communicator.connect()
    await communicator.disconnect()

    # A second release would show up as -1, not 0.
    assert active_sessions('test_double_close') == 0


async def test_repeated_connect_disconnect_cycles_leave_no_drift():
    """The integrity guard: churn must not accumulate phantom sessions.

    A gauge that drifts up by a fraction of a session per cycle looks fine for
    an hour and is badly wrong by the next day, which is exactly the failure
    mode that makes a capacity dashboard untrustworthy.
    """
    baseline = active_sessions('test_accepting')

    for _ in range(25):
        communicator = WebsocketCommunicator(AcceptingConsumer.as_asgi(), '/ws/test/')
        connected, _ = await communicator.connect()
        assert connected
        await communicator.disconnect()

    assert active_sessions('test_accepting') == baseline


def test_every_websocket_consumer_exports_its_own_channel_series():
    labels = [consumer.ws_channel for consumer in WEBSOCKET_CONSUMERS]
    assert len(set(labels)) == len(labels), f'duplicate ws_channel labels: {labels}'

    # Declaring a subclass registers the series, so a channel is scrapeable
    # before its first connection instead of missing from /metrics. Asserting
    # presence rather than 0: other test modules sharing this xdist worker may
    # legitimately have sessions open.
    for label in labels:
        assert active_sessions(label) is not None


def test_consumer_without_a_channel_label_is_rejected():
    with pytest.raises(TypeError, match='ws_channel'):

        class UnlabelledConsumer(InstrumentedAsyncWebsocketConsumer):
            pass
