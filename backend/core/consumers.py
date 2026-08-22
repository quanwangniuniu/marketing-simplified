"""Base Channels consumer that reports live session counts to Prometheus."""

from channels.generic.websocket import AsyncWebsocketConsumer

from .metrics import ws_sessions_active


class InstrumentedAsyncWebsocketConsumer(AsyncWebsocketConsumer):
    """AsyncWebsocketConsumer that keeps ``ws_sessions_active`` accurate.

    Subclasses only declare ``ws_channel``; their ``connect``/``disconnect``
    stay untouched. The counting deliberately hangs off ``accept()`` and
    ``__call__`` rather than the ``connect``/``disconnect`` hooks:

    - ``connect()`` is the wrong place to count. Consumers reject handshakes by
      calling ``close()`` and returning before ``accept()``, and Channels still
      delivers ``websocket.disconnect`` afterwards, so counting every connect
      would let rejected handshakes decrement the gauge below zero.
    - ``disconnect()`` is the wrong place to release. It only runs on an orderly
      shutdown: a consumer that raises after accepting (or is cancelled) never
      reaches it, and would stay counted until the process restarted. ``__call__``
      wraps the whole connection, so every exit path releases the session.

    A session is therefore counted once the handshake is actually accepted, and
    released exactly once when the connection ends, however it ends.
    """

    #: Value of the ``channel`` label, e.g. ``"chat"``. Required.
    ws_channel = None

    # Class-level default: subclasses need no __init__ to get a starting value.
    _ws_session_counted = False

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if not cls.ws_channel:
            raise TypeError(
                f'{cls.__name__} must set ws_channel to label its '
                f'ws_sessions_active series'
            )
        # Instantiate the child gauge at import time so an idle channel reports
        # 0 instead of dropping out of /metrics until its first connection.
        ws_sessions_active.labels(channel=cls.ws_channel)

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            if self._ws_session_counted:
                self._ws_session_counted = False
                ws_sessions_active.labels(channel=self.ws_channel).dec()

    async def accept(self, *args, **kwargs):
        await super().accept(*args, **kwargs)
        if not self._ws_session_counted:
            self._ws_session_counted = True
            ws_sessions_active.labels(channel=self.ws_channel).inc()
