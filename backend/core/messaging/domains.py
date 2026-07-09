from core.messaging.registry import consumer_domains, topics_for_consumer_domain

ALL_CONSUMER_DOMAIN = 'all'
SUPPORTED_DOMAINS = (*consumer_domains(), ALL_CONSUMER_DOMAIN)


def topics_for_all_domains() -> list[str]:
    """Return every Kafka topic name across all producer domains (deduped)."""
    topics: list[str] = []
    seen: set[str] = set()
    for domain in consumer_domains():
        for topic in topics_for_consumer_domain(domain):
            if topic in seen:
                continue
            seen.add(topic)
            topics.append(topic)
    return topics


def topics_for_domain(domain: str) -> list[str]:
    """Return Kafka topic names for a supported consumer domain."""
    if domain == ALL_CONSUMER_DOMAIN:
        return topics_for_all_domains()
    if domain not in SUPPORTED_DOMAINS:
        supported = ', '.join(SUPPORTED_DOMAINS)
        raise ValueError(f'Unsupported Kafka domain {domain!r}. Expected one of: {supported}')
    return topics_for_consumer_domain(domain)


def consumer_group_id(domain: str) -> str:
    return f'mediajira-{domain}-consumer'
