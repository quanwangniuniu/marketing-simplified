import json
import logging

logger = logging.getLogger(__name__)


def _decode_payload(value: bytes) -> object:
    try:
        return json.loads(value.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {'raw': value.decode('utf-8', errors='replace')}


def make_domain_handler(domain: str):
    def handler(topic: str, key: bytes | None, value: bytes, headers: list) -> None:
        payload = _decode_payload(value)
        logger.info('%s Kafka message topic=%s key=%s payload=%s', domain, topic, key, payload)

    return handler
