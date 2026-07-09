from unittest.mock import MagicMock, patch

from django.test import override_settings

from core.messaging.domains import consumer_group_id, topics_for_domain
from core.messaging.kafka_consumer import run_consumer


@override_settings(KAFKA_ENABLED=True, KAFKA_BROKER='kafka:9092')
def test_run_consumer_invokes_consume_message(otel_tracer_provider):
    handled = []

    def handler(topic, key, value, headers):
        handled.append(topic)

    mock_message = MagicMock()
    mock_message.topic = 'campaign.created.json'
    mock_message.key = b'1'
    mock_message.value = b'{"id": 1}'
    mock_message.headers = []

    mock_consumer = MagicMock()
    mock_consumer.__iter__.return_value = iter([mock_message])

    run_consumer('campaign', handler=handler, consumer=mock_consumer)

    assert handled == ['campaign.created.json']
    mock_consumer.close.assert_called_once()


@override_settings(KAFKA_ENABLED=False)
def test_run_consumer_exits_when_kafka_disabled():
    run_consumer('campaign')
