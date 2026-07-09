import pytest
from django.test import override_settings

from core.messaging.registry import DOMAIN_CONFIGS, consumer_domains
from core.messaging.tasks import publish_kafka_event


@pytest.mark.parametrize('domain_key', list(DOMAIN_CONFIGS.keys()))
def test_domain_topic_keys_exist_in_settings(domain_key, settings):
    config = DOMAIN_CONFIGS[domain_key]
    for topic_key in config.topic_by_event.values():
        assert topic_key in settings.KAFKA_TOPICS


def test_consumer_domains_match_registry():
    domains = consumer_domains()
    expected = (
        'campaign',
        'asset',
        'task',
        'decision',
        'retrospective',
        'budget_approval',
        'metric_upload',
        'optimization',
        'workflow',
        'automation_workflow',
        'spreadsheet',
        'notion',
        'meetings',
        'calendar',
        'messages',
    )
    assert domains == expected


def test_topics_for_all_domains_includes_every_consumer_domain():
    from core.messaging.domains import ALL_CONSUMER_DOMAIN, topics_for_all_domains, topics_for_domain

    all_topics = topics_for_all_domains()
    assert 'campaign.created.json' in all_topics
    assert 'decision.created.json' in all_topics
    assert 'spreadsheet.created.json' in all_topics
    assert 'notion.created.json' in all_topics
    assert 'meetings.created.json' in all_topics
    assert 'calendar.event_created.json' in all_topics
    assert 'messages.created.json' in all_topics
    assert 'automation_workflow.created.json' in all_topics
    assert topics_for_domain(ALL_CONSUMER_DOMAIN) == all_topics
    assert len(all_topics) == len(consumer_domains())


@pytest.mark.django_db
@override_settings(KAFKA_ENABLED=True, KAFKA_BROKER='kafka:9092')
def test_publish_kafka_event_task_campaign(project, user):
    from datetime import date
    from unittest.mock import patch

    from campaign.models import Campaign

    with patch('core.messaging.tasks.publish') as mock_publish:
        campaign = Campaign.objects.create(
            name='Registry campaign',
            project=project,
            owner=user,
            creator=user,
            objective=Campaign.Objective.AWARENESS,
            platforms=[Campaign.Platform.META],
            start_date=date(2026, 1, 1),
        )
        publish_kafka_event('campaign', 'created', str(campaign.id))

    mock_publish.assert_called_once()
    assert mock_publish.call_args.args[0] == 'campaign.created.json'
