import json
import logging
import threading
from typing import Any, Iterable, Optional

from django.conf import settings
from kafka import KafkaProducer
from kafka.producer.future import RecordMetadata
from opentelemetry import propagate, trace
from opentelemetry.trace import SpanKind

logger = logging.getLogger(__name__)

_producer_lock = threading.Lock()
_producer_instance: Optional[KafkaProducer] = None

TRACE_HEADER_KEYS = frozenset({'traceparent', 'tracestate'})


def _get_tracer():
    return trace.get_tracer(__name__)


def _serialize_value(value: Any) -> bytes:
    if isinstance(value, bytes):
        return value
    if isinstance(value, str):
        return value.encode('utf-8')
    return json.dumps(value).encode('utf-8')


def _normalize_headers(
    headers: Optional[Iterable[tuple[str | bytes, bytes | str]]],
) -> list[tuple[str, bytes]]:
    if not headers:
        return []
    normalized: list[tuple[str, bytes]] = []
    for key, value in headers:
        header_key = key.decode('utf-8') if isinstance(key, bytes) else key
        if header_key in TRACE_HEADER_KEYS:
            continue
        header_value = value if isinstance(value, bytes) else str(value).encode('utf-8')
        normalized.append((header_key, header_value))
    return normalized


def build_publish_headers(
    caller_headers: Optional[Iterable[tuple[str | bytes, bytes | str]]] = None,
) -> list[tuple[str, bytes]]:
    """Inject W3C trace context; caller headers cannot override trace keys."""
    carrier: dict[str, str] = {}
    propagate.inject(carrier)
    trace_headers = [
        (key, value.encode('utf-8'))
        for key, value in carrier.items()
        if key in TRACE_HEADER_KEYS
    ]
    return trace_headers + _normalize_headers(caller_headers)


def headers_to_dict(headers: list[tuple[str, bytes]]) -> dict[str, bytes]:
    return dict(headers)


class KafkaProducerWrapper:
    """Singleton Kafka producer; all domain code must publish through ``publish()``."""

    @classmethod
    def get_producer(cls) -> KafkaProducer:
        global _producer_instance
        if _producer_instance is not None:
            return _producer_instance

        with _producer_lock:
            if _producer_instance is None:
                _producer_instance = KafkaProducer(
                    bootstrap_servers=settings.KAFKA_BROKER,
                    value_serializer=_serialize_value,
                    key_serializer=lambda key: key if key is None or isinstance(key, bytes) else str(key).encode('utf-8'),
                )
                logger.info('Kafka producer initialized (broker=%s)', settings.KAFKA_BROKER)
        return _producer_instance

    @classmethod
    def reset(cls) -> None:
        """Close and clear the singleton (used in tests)."""
        global _producer_instance
        with _producer_lock:
            if _producer_instance is not None:
                _producer_instance.close()
                _producer_instance = None


def publish(
    topic: str,
    value: Any,
    *,
    key: Optional[Any] = None,
    headers: Optional[Iterable[tuple[str | bytes, bytes | str]]] = None,
) -> Optional[RecordMetadata]:
    """
    Publish a message to Kafka with W3C trace context in record headers.

    Returns ``None`` when ``KAFKA_ENABLED`` is false.
    """
    if not settings.KAFKA_ENABLED:
        logger.debug('Kafka disabled; skipping publish to topic=%s', topic)
        return None

    producer = KafkaProducerWrapper.get_producer()

    with _get_tracer().start_as_current_span(
        f'kafka.produce {topic}',
        kind=SpanKind.PRODUCER,
        attributes={
            'messaging.system': 'kafka',
            'messaging.destination.name': topic,
        },
    ):
        merged_headers = build_publish_headers(headers)
        future = producer.send(
            topic,
            value=value,
            key=key,
            headers=merged_headers or None,
        )
        return future.get(timeout=10)
