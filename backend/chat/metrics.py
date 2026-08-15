"""Prometheus metrics for chat delivery.

Scraped through django_prometheus alongside the rest of the application's
metrics.
"""

from prometheus_client import Counter

chat_broadcast_enqueue_failures_total = Counter(
    'chat_broadcast_enqueue_failures_total',
    'Chat events that were persisted but could not be queued for realtime broadcast',
    ['event'],  # event: message | pin
)

# Queueing succeeding says nothing about the publish that follows it. A worker
# that cannot reach the channel layer fails after the request has already
# returned 200, so without this the failure is visible only in logs.
chat_broadcast_publish_failures_total = Counter(
    'chat_broadcast_publish_failures_total',
    'Recipients a queued chat event could not be published to',
    ['event'],  # event: pin
)
