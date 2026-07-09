import logging

from celery import shared_task
from django.conf import settings

from core.messaging.kafka_producer import publish
from core.messaging.payloads import PAYLOAD_BUILDERS
from core.messaging.registry import DOMAIN_CONFIGS

logger = logging.getLogger(__name__)


@shared_task
def publish_kafka_event(
    domain_key: str,
    event_type: str,
    entity_id: str,
    payload: dict | None = None,
) -> None:
    """Publish a domain Kafka event with W3C trace propagation."""
    from django.apps import apps

    config = DOMAIN_CONFIGS[domain_key]
    topic_key = config.topic_by_event[event_type]
    topic = settings.KAFKA_TOPICS[topic_key]

    if payload is None:
        model = apps.get_model(config.model_label)
        instance = model.objects.get(pk=entity_id)
        builder = PAYLOAD_BUILDERS[config.payload_builder]
        payload = builder(instance, event_type)

    publish(topic, payload, key=str(entity_id))
    logger.info(
        'Published Kafka event domain=%s type=%s entity_id=%s topic=%s',
        domain_key,
        event_type,
        entity_id,
        topic,
    )


# Backward-compatible task aliases used by existing tests and imports.
@shared_task
def publish_campaign_kafka_event(event_type: str, campaign_id: str) -> None:
    publish_kafka_event('campaign', event_type, campaign_id)


@shared_task
def publish_asset_kafka_event(event_type: str, asset_id: int, payload: dict | None = None) -> None:
    publish_kafka_event('asset', event_type, str(asset_id), payload)


@shared_task
def publish_optimization_kafka_event(event_type: str, experiment_id: int) -> None:
    publish_kafka_event('optimization', event_type, str(experiment_id))
