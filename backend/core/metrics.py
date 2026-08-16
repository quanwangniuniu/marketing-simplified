"""Prometheus metrics shared across apps.

Scraped through django_prometheus alongside the rest of the application's
metrics. The backend serves HTTP and WebSocket traffic from a single daphne
process (see backend/Dockerfile), so an in-process gauge and the /metrics
endpoint always agree; with several replicas, sum across instances in Grafana.
"""

from prometheus_client import Gauge

# Sessions that completed the WebSocket handshake and have not disconnected
# yet. Rejected handshakes never count: connect() closes those before accept().
#
# Cardinality: ``channel`` is bounded by the number of consumer classes, not by
# traffic. Its only source is the class-level ``ws_channel`` constant that each
# consumer declares (see InstrumentedAsyncWebsocketConsumer); the label is never
# derived from the connection -- not from scope, url_route kwargs, the user, the
# room or the sheet id -- so no volume of sessions can mint a new series. The
# allowed values are exactly:
#
#     asset | chat | csm | meetings | portal | retrospective | spreadsheet
#
# Adding a per-room or per-user label would mean editing the base class, and
# test_channel_label_set_is_bounded_and_declared fails on any label value that
# is not in that list. Keep it that way: a label whose values track connections
# is what turns a gauge into a series explosion.
ws_sessions_active = Gauge(
    'ws_sessions_active',
    'Currently connected WebSocket sessions',
    ['channel'],
)
