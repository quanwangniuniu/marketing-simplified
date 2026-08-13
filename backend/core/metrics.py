"""Prometheus metrics shared across apps.

Scraped through django_prometheus alongside the rest of the application's
metrics. The backend serves HTTP and WebSocket traffic from a single daphne
process (see backend/Dockerfile), so an in-process gauge and the /metrics
endpoint always agree; with several replicas, sum across instances in Grafana.
"""

from prometheus_client import Gauge

# Sessions that completed the WebSocket handshake and have not disconnected
# yet. Rejected handshakes never count: connect() closes those before accept().
ws_sessions_active = Gauge(
    'ws_sessions_active',
    'Currently connected WebSocket sessions',
    ['channel'],  # channel: chat | spreadsheet | csm | portal | meetings | retrospective | asset
)
