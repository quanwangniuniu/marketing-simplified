from django.core.management.base import BaseCommand

from core.messaging.domains import SUPPORTED_DOMAINS
from core.messaging.kafka_consumer import run_consumer


class Command(BaseCommand):
    help = 'Run a Kafka consumer for any supported domain topics.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--domain',
            required=True,
            choices=SUPPORTED_DOMAINS,
            help='Domain whose Kafka topics to consume (use "all" for every topic)',
        )
        parser.add_argument(
            '--group-id',
            default=None,
            help='Optional consumer group id (defaults to mediajira-<domain>-consumer)',
        )
        parser.add_argument(
            '--assign-latest',
            action='store_true',
            help='Skip consumer group; assign partitions and only read new messages (local dev)',
        )

    def handle(self, *args, **options):
        run_consumer(
            domain=options['domain'],
            group_id=options['group_id'],
            assign_latest=options['assign_latest'],
        )
