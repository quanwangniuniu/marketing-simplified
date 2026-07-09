from django.apps import apps
from django.db import transaction

from core.messaging.tasks import publish_kafka_event


def schedule_kafka_event(
    domain_key: str,
    event_type: str,
    entity_id,
    payload: dict | None = None,
    *,
    on_commit: bool = True,
) -> None:
    """Enqueue a Celery publish task (optionally after transaction commit)."""
    entity_id_str = str(entity_id)

    def _enqueue() -> None:
        publish_kafka_event.delay(domain_key, event_type, entity_id_str, payload)

    if on_commit:
        transaction.on_commit(_enqueue)
    else:
        _enqueue()


def build_payload(domain_key: str, instance, event_type: str) -> dict:
    from core.messaging.payloads import PAYLOAD_BUILDERS
    from core.messaging.registry import DOMAIN_CONFIGS

    config = DOMAIN_CONFIGS[domain_key]
    builder = PAYLOAD_BUILDERS[config.payload_builder]
    return builder(instance, event_type)


def load_instance(domain_key: str, entity_id: str):
    from core.messaging.registry import DOMAIN_CONFIGS

    config = DOMAIN_CONFIGS[domain_key]
    model = apps.get_model(config.model_label)
    return model.objects.get(pk=entity_id)
