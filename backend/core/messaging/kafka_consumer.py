import logging
from typing import Callable, Optional

from django.conf import settings
from kafka import KafkaConsumer, TopicPartition
from opentelemetry import propagate, trace
from opentelemetry.trace import SpanKind

from core.messaging.domains import SUPPORTED_DOMAINS, consumer_group_id, topics_for_domain
from core.messaging.handlers import DOMAIN_HANDLERS

logger = logging.getLogger(__name__)

MessageHandler = Callable[[str, bytes | None, bytes, list], None]


def _get_tracer():
    return trace.get_tracer(__name__)


def headers_to_carrier(headers: list[tuple[bytes, bytes]]) -> dict[str, str]:
    carrier: dict[str, str] = {}
    for key, value in headers or []:
        header_key = key.decode('utf-8') if isinstance(key, bytes) else str(key)
        header_value = value.decode('utf-8') if isinstance(value, bytes) else str(value)
        carrier[header_key] = header_value
    return carrier


def consume_message(
    topic: str,
    key: bytes | None,
    value: bytes,
    headers: list[tuple[bytes, bytes]],
    handler: MessageHandler,
) -> None:
    """Extract W3C trace context from Kafka headers and run the domain handler."""
    carrier = headers_to_carrier(headers)
    ctx = propagate.extract(carrier)
    with _get_tracer().start_as_current_span(
        'kafka.consume',
        context=ctx,
        kind=SpanKind.CONSUMER,
        attributes={
            'messaging.system': 'kafka',
            'messaging.destination.name': topic,
        },
    ):
        handler(topic, key, value, list(headers))


def _consumer_assigned_at_latest(topics: list[str]) -> KafkaConsumer:
    """Assign all topic partitions and seek to end (no consumer group; local dev)."""
    consumer = KafkaConsumer(
        bootstrap_servers=settings.KAFKA_BROKER,
        enable_auto_commit=False,
    )
    partitions: list[TopicPartition] = []
    for topic in topics:
        for partition_id in sorted(consumer.partitions_for_topic(topic) or []):
            partitions.append(TopicPartition(topic, partition_id))
    if not partitions:
        raise RuntimeError(f'No partitions found for topics={topics}')
    consumer.assign(partitions)
    consumer.seek_to_end(*partitions)
    return consumer


def run_consumer(
    domain: str,
    *,
    group_id: Optional[str] = None,
    assign_latest: bool = False,
    handler: Optional[MessageHandler] = None,
    consumer: Optional[KafkaConsumer] = None,
) -> None:
    """
    Blocking consumer loop for a domain or ``all`` (every registered topic).
    """
    if domain not in SUPPORTED_DOMAINS:
        supported = ', '.join(SUPPORTED_DOMAINS)
        raise ValueError(f'Unsupported Kafka domain {domain!r}. Expected one of: {supported}')

    if not settings.KAFKA_ENABLED:
        logger.warning('Kafka disabled; consumer for domain=%s will not start', domain)
        return

    topics = topics_for_domain(domain)
    resolved_handler = handler or DOMAIN_HANDLERS[domain]

    if consumer is not None:
        kafka_consumer = consumer
        mode_label = group_id or 'injected'
    elif assign_latest:
        kafka_consumer = _consumer_assigned_at_latest(topics)
        mode_label = 'assign-latest'
    else:
        mode_label = group_id or consumer_group_id(domain)
        kafka_consumer = KafkaConsumer(
            *topics,
            bootstrap_servers=settings.KAFKA_BROKER,
            group_id=mode_label,
            auto_offset_reset='earliest',
            enable_auto_commit=True,
        )

    logger.info(
        'Starting Kafka consumer domain=%s mode=%s topics=%s broker=%s',
        domain,
        mode_label,
        topics,
        settings.KAFKA_BROKER,
    )

    try:
        for message in kafka_consumer:
            logger.info(
                'Received Kafka message topic=%s partition=%s offset=%s',
                message.topic,
                message.partition,
                message.offset,
            )
            consume_message(
                message.topic,
                message.key,
                message.value,
                list(message.headers or []),
                resolved_handler,
            )
    except KeyboardInterrupt:
        logger.info('Stopping Kafka consumer domain=%s', domain)
    except Exception:
        logger.exception('Kafka consumer failed for domain=%s', domain)
        raise
    finally:
        kafka_consumer.close()
