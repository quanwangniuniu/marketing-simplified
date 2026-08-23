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


# --- Link previews (MED-279) -------------------------------------------------
# The guard refusing a URL is normally routine (someone pasted an intranet link),
# but a sudden spike is what an SSRF probe looks like. Logs alone are not a signal
# anyone watches, so every refusal is counted and labelled by reason.
chat_link_preview_refusals_total = Counter(
    'chat_link_preview_refusals_total',
    'Link preview fetches refused before or during the request',
    ['reason'],  # reason: guard | redirect | rate_limit | content_type | size
)

# A create race means two workers reached the same brand-new URL at once. It is
# handled, but a rising count means the single-flight window is wider than assumed.
chat_link_preview_create_races_total = Counter(
    'chat_link_preview_create_races_total',
    'Link preview rows that lost the create race and reused an existing row',
)

# Retries are deliberately disabled, so a spike in failures has no self-healing
# behaviour behind it — this is the only thing that makes such a spike visible.
chat_link_preview_fetch_outcomes_total = Counter(
    'chat_link_preview_fetch_outcomes_total',
    'Outcome of link preview fetch attempts',
    ['outcome'],  # outcome: ready | failed | blocked | empty
)
