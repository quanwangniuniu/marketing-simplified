from unittest.mock import MagicMock, patch

from django.test import override_settings
from opentelemetry import trace

from core.messaging.domains import consumer_group_id, topics_for_domain
from core.messaging.kafka_producer import (
    KafkaProducerWrapper,
    build_publish_headers,
    headers_to_dict,
    publish,
)

# Trace propagation assertions live in test_kafka_trace_propagation.py (Step 7).


@override_settings(KAFKA_ENABLED=False)
def test_publish_noop_when_kafka_disabled():
    assert publish('campaign.created.json', {'id': 1}) is None


@override_settings(KAFKA_ENABLED=True, KAFKA_BROKER='kafka:9092')
@patch('core.messaging.kafka_producer.KafkaProducer')
def test_publish_sends_via_wrapper(mock_producer_cls, otel_tracer_provider):
    mock_producer = MagicMock()
    mock_future = MagicMock()
    mock_producer.send.return_value = mock_future
    mock_future.get.return_value = MagicMock()
    mock_producer_cls.return_value = mock_producer

    KafkaProducerWrapper.reset()
    publish('campaign.created.json', {'id': 1}, key='42')

    mock_producer.send.assert_called_once()
    call_kwargs = mock_producer.send.call_args.kwargs
    header_map = headers_to_dict(call_kwargs['headers'])
    assert 'traceparent' in header_map
    assert header_map['traceparent'].decode('utf-8').count('-') == 3

    KafkaProducerWrapper.reset()


@override_settings(KAFKA_ENABLED=True, KAFKA_BROKER='kafka:9092')
def test_caller_headers_cannot_override_traceparent(otel_tracer_provider):
    tracer = trace.get_tracer('test.kafka')
    forged = [('traceparent', b'00-forged-forgedforgedforgedforgedforg-0123456789abcdef-01')]

    with tracer.start_as_current_span('producer-span'):
        headers = build_publish_headers(forged)

    header_map = headers_to_dict(headers)
    traceparent = header_map['traceparent'].decode('utf-8')
    assert 'forged' not in traceparent


def test_topics_for_domain_campaign():
    topics = topics_for_domain('campaign')
    assert 'campaign.created.json' in topics
    assert len(topics) == 4


def test_consumer_group_id():
    assert consumer_group_id('asset') == 'mediajira-asset-consumer'
