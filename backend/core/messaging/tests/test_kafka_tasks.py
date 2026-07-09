from datetime import date
from unittest.mock import patch

import pytest
from django.test import override_settings

from asset.models import Asset
from campaign.models import Campaign
from core.messaging.tasks import (
    publish_asset_kafka_event,
    publish_campaign_kafka_event,
    publish_optimization_kafka_event,
)
from core.models import Team
from optimization.models import OptimizationExperiment
from task.models import Task


@pytest.fixture
def team(organization):
    return Team.objects.create(name='Creative', organization=organization)


@pytest.fixture
def task(project, user):
    return Task.objects.create(
        project=project,
        owner=user,
        summary='Asset task',
        type='asset',
    )


@pytest.mark.django_db
@override_settings(KAFKA_ENABLED=True, KAFKA_BROKER='kafka:9092')
@patch('core.messaging.tasks.publish')
def test_publish_campaign_kafka_event(mock_publish, project, user):
    campaign = Campaign.objects.create(
        name='Launch',
        project=project,
        owner=user,
        creator=user,
        objective=Campaign.Objective.AWARENESS,
        platforms=[Campaign.Platform.META],
        start_date=date(2026, 1, 1),
    )

    publish_campaign_kafka_event('created', str(campaign.id))

    mock_publish.assert_called_once()
    assert mock_publish.call_args.args[0] == 'campaign.created.json'
    assert mock_publish.call_args.args[1]['campaign_id'] == str(campaign.id)
    assert mock_publish.call_args.kwargs['key'] == str(campaign.id)


@pytest.mark.django_db
@override_settings(KAFKA_ENABLED=True, KAFKA_BROKER='kafka:9092')
@patch('core.messaging.tasks.publish')
def test_publish_asset_kafka_event(mock_publish, task, user, team):
    asset = Asset.objects.create(task=task, owner=user, team=team)

    publish_asset_kafka_event('created', asset.id)

    mock_publish.assert_called_once()
    assert mock_publish.call_args.args[0] == 'asset.created.json'
    assert mock_publish.call_args.args[1]['asset_id'] == asset.id


@pytest.mark.django_db
@override_settings(KAFKA_ENABLED=True, KAFKA_BROKER='kafka:9092')
@patch('core.messaging.tasks.publish')
def test_publish_optimization_kafka_event(mock_publish, user):
    experiment = OptimizationExperiment.objects.create(
        name='CTR test',
        experiment_type=OptimizationExperiment.ExperimentType.AB_TEST,
        linked_campaign_ids=['fb:1'],
        hypothesis='Higher CTR',
        start_date=date(2026, 1, 1),
        end_date=date(2026, 2, 1),
        description='Test',
        created_by=user,
    )

    publish_optimization_kafka_event('experiment_created', experiment.id)

    mock_publish.assert_called_once()
    assert mock_publish.call_args.args[0] == 'optimization.experiment_created.json'
    assert mock_publish.call_args.args[1]['experiment_id'] == experiment.id


@pytest.mark.django_db(transaction=True)
@patch('core.messaging.tasks.publish_kafka_event.delay')
def test_campaign_create_enqueues_kafka_task(
    mock_delay,
    project,
    user,
    django_capture_on_commit_callbacks,
):
    campaign = Campaign.objects.create(
        name='Signal campaign',
        project=project,
        owner=user,
        creator=user,
        objective=Campaign.Objective.AWARENESS,
        platforms=[Campaign.Platform.META],
        start_date=date(2026, 1, 1),
    )
    django_capture_on_commit_callbacks()

    mock_delay.assert_called_once_with('campaign', 'created', str(campaign.id), None)


@pytest.mark.django_db(transaction=True)
@patch('core.messaging.tasks.publish_kafka_event.delay')
def test_asset_create_enqueues_kafka_task(
    mock_delay,
    task,
    user,
    team,
    django_capture_on_commit_callbacks,
):
    asset = Asset.objects.create(task=task, owner=user, team=team)
    django_capture_on_commit_callbacks()

    mock_delay.assert_called_once_with('asset', 'created', str(asset.id), None)


@pytest.mark.django_db(transaction=True)
@patch('core.messaging.tasks.publish_kafka_event.delay')
def test_decision_create_enqueues_kafka_task(
    mock_delay,
    project,
    user,
    django_capture_on_commit_callbacks,
):
    from decision.models import Decision

    decision = Decision.objects.create(
        title='Launch strategy',
        project=project,
        author=user,
        status=Decision.Status.DRAFT,
    )
    django_capture_on_commit_callbacks()

    mock_delay.assert_called_once_with('decision', 'created', str(decision.id), None)


@pytest.mark.django_db(transaction=True)
@patch('core.messaging.tasks.publish_kafka_event.delay')
def test_automation_workflow_create_enqueues_kafka_task(
    mock_delay,
    project,
    user,
    django_capture_on_commit_callbacks,
):
    from agent.models import AgentWorkflowDefinition

    workflow = AgentWorkflowDefinition.objects.create(
        name='Automation workflow',
        project=project,
        is_system=False,
        status='draft',
        created_by=user,
    )
    django_capture_on_commit_callbacks()

    mock_delay.assert_called_once_with(
        'automation_workflow',
        'created',
        str(workflow.id),
        None,
    )


@pytest.mark.django_db
def test_automation_workflow_payload_is_json_serializable(project, user):
    import json

    from agent.models import AgentWorkflowDefinition
    from core.messaging.payloads import automation_workflow_event_payload

    workflow = AgentWorkflowDefinition.objects.create(
        name='Automation workflow',
        project=project,
        is_system=False,
        status='draft',
        created_by=user,
    )
    payload = automation_workflow_event_payload(workflow, 'created')
    json.dumps(payload)
    assert payload['workflow_id'] == str(workflow.id)
    assert payload['slug'] == workflow.slug


@pytest.mark.django_db(transaction=True)
@patch('core.messaging.tasks.publish_kafka_event.delay')
def test_calendar_event_create_enqueues_kafka_task(
    mock_delay,
    organization,
    user,
    django_capture_on_commit_callbacks,
):
    from datetime import datetime, timezone as dt_timezone

    from calendars.models import Calendar, Event

    calendar = Calendar.objects.create(
        organization=organization,
        owner=user,
        name='Team Calendar',
        timezone='UTC',
        is_primary=True,
    )
    event = Event.objects.create(
        organization=organization,
        calendar=calendar,
        created_by=user,
        title='Standup',
        start_datetime=datetime(2026, 7, 9, 9, 0, tzinfo=dt_timezone.utc),
        end_datetime=datetime(2026, 7, 9, 9, 30, tzinfo=dt_timezone.utc),
        timezone='UTC',
    )
    django_capture_on_commit_callbacks()

    mock_delay.assert_called_once_with('calendar', 'created', str(event.id), None)


@pytest.mark.django_db
def test_calendar_event_payload_is_json_serializable(organization, user):
    import json
    from datetime import datetime, timezone as dt_timezone

    from calendars.models import Calendar, Event
    from core.messaging.payloads import calendar_event_payload

    calendar = Calendar.objects.create(
        organization=organization,
        owner=user,
        name='Team Calendar',
        timezone='UTC',
        is_primary=True,
    )
    event = Event.objects.create(
        organization=organization,
        calendar=calendar,
        created_by=user,
        title='Standup',
        start_datetime=datetime(2026, 7, 9, 9, 0, tzinfo=dt_timezone.utc),
        end_datetime=datetime(2026, 7, 9, 9, 30, tzinfo=dt_timezone.utc),
        timezone='UTC',
    )

    payload = calendar_event_payload(event, 'created')
    json.dumps(payload)

    assert payload['event_id'] == str(event.id)
    assert payload['calendar_id'] == str(calendar.id)
