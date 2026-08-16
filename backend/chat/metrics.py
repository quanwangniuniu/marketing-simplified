"""Prometheus metrics for chat delivery.

Scraped through django_prometheus alongside the rest of the application's
metrics.
"""

from prometheus_client import Counter, Gauge

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

# Chat-group subscriptions owned by live ChatConsumer registries in this
# process. Personal ``chat_user_<id>`` groups are connection lifecycle state
# and deliberately excluded: this gauge measures the bookkeeping extracted
# into chat.subscriptions, not every Channels group in the application.
chat_active_subscriptions = Gauge(
    'chat_active_subscriptions',
    'Active chat-group subscriptions tracked by live chat consumers',
)

# A failed discard can leave a dead channel name in a Redis group until the
# channel layer's group expiry removes it. Keep the label bounded; group, chat,
# channel and user identifiers must never become metric labels.
chat_subscription_leaks_total = Counter(
    'chat_subscription_leaks_total',
    'Chat-group subscriptions that could not be discarded during cleanup',
    ['reason'],  # reason: discard_failed
)

# Export the bounded series at zero before the first failure, so dashboards and
# alerts do not confuse an idle process with a missing metric.
chat_subscription_leaks_total.labels(reason='discard_failed')
