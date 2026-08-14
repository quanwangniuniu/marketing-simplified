"""Tests for the ws_sessions_active gauge on the instrumented consumer base."""

import pytest
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from prometheus_client import REGISTRY

from backend.asgi import application
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

# RetrospectiveConsumer is deliberately absent from backend/asgi.py. Its
# connect() never rejects an unauthenticated user -- the check is commented out
# -- so routing it would publish retrospective broadcasts to anyone who can
# guess an id. It is instrumented already and will be picked up automatically
# once its authentication is implemented and the route registered; remove it
# from here at that point.
KNOWN_UNROUTED_CHANNELS = {'retrospective'}


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


def routed_consumer_classes():
    """Consumer classes reachable through the real websocket application."""
    app = application.application_mapping['websocket']
    for _ in range(10):
        if isinstance(app, URLRouter):
            break
        app = getattr(app, 'inner', None) or getattr(app, 'application', None)
        if app is None:
            raise AssertionError('no URLRouter found in the websocket application')
    else:
        raise AssertionError('no URLRouter found in the websocket application')

    found = []
    pending = list(app.routes)
    while pending:
        callback = pending.pop().callback
        if isinstance(callback, URLRouter):
            pending.extend(callback.routes)
            continue
        consumer_cls = getattr(callback, 'consumer_class', None)
        if consumer_cls is not None:
            found.append(consumer_cls)
    return found


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


def test_every_routed_consumer_exports_its_channel_series():
    """Checked through the real ASGI router, not by importing the consumers.

    Importing a consumer registers its series in the test process, so a suite
    that imports them directly would create the very series it claims to be
    verifying and report coverage production does not have.
    """
    routed = routed_consumer_classes()
    assert routed, 'no consumers found in the websocket ASGI router'

    labels = [consumer.ws_channel for consumer in WEBSOCKET_CONSUMERS]
    assert len(set(labels)) == len(labels), f'duplicate ws_channel labels: {labels}'

    for consumer in routed:
        assert issubclass(consumer, InstrumentedAsyncWebsocketConsumer), (
            f'{consumer.__name__} is routed but does not report sessions'
        )
        # Declaring a subclass registers the series, so a channel is scrapeable
        # before its first connection instead of missing from /metrics.
        assert active_sessions(consumer.ws_channel) is not None, (
            f'{consumer.ws_channel} is routed but has no registered series'
        )


def test_no_consumer_is_silently_left_out_of_the_asgi_router():
    """A consumer production never imports never registers its series.

    Anything newly missing from the router has to be acknowledged here rather
    than passing unnoticed, and anything that becomes routed has to be removed
    from the exemption.
    """
    routed = {consumer.ws_channel for consumer in routed_consumer_classes()}
    declared = {consumer.ws_channel for consumer in WEBSOCKET_CONSUMERS}
    unrouted = declared - routed

    assert unrouted == KNOWN_UNROUTED_CHANNELS, (
        f'missing from backend/asgi.py: {sorted(unrouted - KNOWN_UNROUTED_CHANNELS)}; '
        f'now routed, remove from KNOWN_UNROUTED_CHANNELS: '
        f'{sorted(KNOWN_UNROUTED_CHANNELS - unrouted)}'
    )


def test_consumer_without_a_channel_label_is_rejected():
    with pytest.raises(TypeError, match='ws_channel'):

        class UnlabelledConsumer(InstrumentedAsyncWebsocketConsumer):
            pass
