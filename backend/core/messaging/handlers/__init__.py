from core.messaging.domains import ALL_CONSUMER_DOMAIN, SUPPORTED_DOMAINS
from core.messaging.handlers.base import make_domain_handler
from core.messaging.registry import consumer_domains

DOMAIN_HANDLERS = {domain: make_domain_handler(domain) for domain in consumer_domains()}
DOMAIN_HANDLERS[ALL_CONSUMER_DOMAIN] = make_domain_handler(ALL_CONSUMER_DOMAIN)

handle_campaign_message = DOMAIN_HANDLERS['campaign']
handle_asset_message = DOMAIN_HANDLERS['asset']
handle_optimization_message = DOMAIN_HANDLERS['optimization']
handle_all_message = DOMAIN_HANDLERS[ALL_CONSUMER_DOMAIN]
