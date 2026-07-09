from unittest.mock import MagicMock, patch

from django.test import override_settings
from opentelemetry import propagate, trace

from core.messaging.kafka_consumer import consume_message, headers_to_carrier
from core.messaging.kafka_producer import (
    KafkaProducerWrapper,
    build_publish_headers,
    headers_to_dict,
    publish,
)


@override_settings(KAFKA_ENABLED=True, KAFKA_BROKER='kafka:9092')
@patch('core.messaging.kafka_producer.KafkaProducer')
def test_inject_adds_traceparent_header(mock_producer_cls, otel_tracer_provider):
    tracer = trace.get_tracer('test.kafka')

    mock_producer = MagicMock()
    mock_future = MagicMock()
    mock_producer.send.return_value = mock_future
    mock_future.get.return_value = MagicMock()
    mock_producer_cls.return_value = mock_producer

    KafkaProducerWrapper.reset()
    with tracer.start_as_current_span('parent-span') as parent:
        parent_trace_id = format(parent.get_span_context().trace_id, '032x')
        publish('campaign.created.json', {'id': 1})

    header_map = headers_to_dict(mock_producer.send.call_args.kwargs['headers'])
    traceparent = header_map['traceparent'].decode('utf-8')
    injected_trace_id = traceparent.split('-')[1]
    assert injected_trace_id == parent_trace_id

    KafkaProducerWrapper.reset()


@override_settings(KAFKA_ENABLED=True, KAFKA_BROKER='kafka:9092')
@patch('core.messaging.kafka_producer.KafkaProducer')
def test_inject_without_active_span(mock_producer_cls, otel_tracer_provider):
    mock_producer = MagicMock()
    mock_future = MagicMock()
    mock_producer.send.return_value = mock_future
    mock_future.get.return_value = MagicMock()
    mock_producer_cls.return_value = mock_producer

    KafkaProducerWrapper.reset()
    publish('campaign.created.json', {'id': 1})

    header_map = headers_to_dict(mock_producer.send.call_args.kwargs['headers'])
    traceparent = header_map['traceparent'].decode('utf-8')
    assert traceparent.startswith('00-')
    assert traceparent.count('-') == 3

    KafkaProducerWrapper.reset()


def test_extract_continues_trace(otel_tracer_provider):
    tracer = trace.get_tracer('test.kafka')

    with tracer.start_as_current_span('producer-span') as producer_span:
        producer_trace_id = format(producer_span.get_span_context().trace_id, '032x')
        headers = build_publish_headers()

    carrier = headers_to_carrier(headers)
    with tracer.start_as_current_span(
        'kafka.consume',
        context=propagate.extract(carrier),
    ) as consumer_span:
        consumer_trace_id = format(consumer_span.get_span_context().trace_id, '032x')

    assert consumer_trace_id == producer_trace_id


@override_settings(KAFKA_ENABLED=True, KAFKA_BROKER='kafka:9092')
@patch('core.messaging.kafka_producer.KafkaProducer')
def test_consumer_handler_linked(mock_producer_cls, otel_tracer_provider):
    exporter = otel_tracer_provider[1]
    tracer = trace.get_tracer('test.kafka')

    mock_producer = MagicMock()
    mock_future = MagicMock()
    mock_producer.send.return_value = mock_future
    mock_future.get.return_value = MagicMock()
    mock_producer_cls.return_value = mock_producer

    KafkaProducerWrapper.reset()

    with tracer.start_as_current_span('workflow-root'):
        publish('optimization.experiment_created.json', {'id': 1})

    headers = mock_producer.send.call_args.kwargs['headers']

    def handler(topic, key, value, headers):
        pass

    consume_message('optimization.experiment_created.json', None, b'{}', headers, handler)

    finished = exporter.get_finished_spans()
    span_names = [span.name for span in finished]
    assert 'workflow-root' in span_names
    assert any(name.startswith('kafka.produce') for name in span_names)
    assert 'kafka.consume' in span_names

    trace_ids = {format(span.context.trace_id, '032x') for span in finished}
    assert len(trace_ids) == 1

    carrier = headers_to_carrier(headers)
    assert carrier['traceparent'].split('-')[1] in trace_ids

    KafkaProducerWrapper.reset()
