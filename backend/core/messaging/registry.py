"""Kafka domain registry: topic mappings, models, and signal profiles."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

SignalProfile = Literal[
    'crud_status_soft_delete',
    'crud_status_hard_delete',
    'crud_status',
    'project_soft_delete',
    'retrospective',
    'budget_request',
    'metric_upload',
    'optimization',
    'workflow_run',
]


@dataclass(frozen=True)
class DomainConfig:
    """Configuration for one Kafka producer domain."""

    consumer_domain: str
    model_label: str
    topic_by_event: dict[str, str]
    payload_builder: str
    signal_profile: SignalProfile
    status_field: str = 'status'
    create_event: str | None = None
    id_field: str = 'id'


DOMAIN_CONFIGS: dict[str, DomainConfig] = {
    'campaign': DomainConfig(
        consumer_domain='campaign',
        model_label='campaign.Campaign',
        signal_profile='crud_status_soft_delete',
        payload_builder='campaign_event_payload',
        topic_by_event={
            'created': 'CAMPAIGN_CREATED',
            'updated': 'CAMPAIGN_UPDATED',
            'deleted': 'CAMPAIGN_DELETED',
            'status_changed': 'CAMPAIGN_STATUS_CHANGED',
        },
    ),
    'asset': DomainConfig(
        consumer_domain='asset',
        model_label='asset.Asset',
        signal_profile='crud_status',
        payload_builder='asset_event_payload',
        topic_by_event={
            'created': 'ASSET_CREATED',
            'updated': 'ASSET_UPDATED',
            'deleted': 'ASSET_DELETED',
            'status_changed': 'ASSET_STATUS_CHANGED',
        },
    ),
    'task': DomainConfig(
        consumer_domain='task',
        model_label='task.Task',
        signal_profile='crud_status_hard_delete',
        payload_builder='task_event_payload',
        topic_by_event={
            'created': 'TASK_CREATED',
            'updated': 'TASK_UPDATED',
            'deleted': 'TASK_DELETED',
            'status_changed': 'TASK_STATUS_CHANGED',
        },
    ),
    'decision': DomainConfig(
        consumer_domain='decision',
        model_label='decision.Decision',
        signal_profile='crud_status_soft_delete',
        payload_builder='decision_event_payload',
        topic_by_event={
            'created': 'DECISION_CREATED',
            'updated': 'DECISION_UPDATED',
            'deleted': 'DECISION_DELETED',
            'status_changed': 'DECISION_STATUS_CHANGED',
        },
    ),
    'retrospective': DomainConfig(
        consumer_domain='retrospective',
        model_label='retrospective.RetrospectiveTask',
        signal_profile='retrospective',
        payload_builder='retrospective_event_payload',
        topic_by_event={
            'created': 'RETROSPECTIVE_CREATED',
            'updated': 'RETROSPECTIVE_UPDATED',
            'completed': 'RETROSPECTIVE_COMPLETED',
        },
    ),
    'budget_approval': DomainConfig(
        consumer_domain='budget_approval',
        model_label='budget_approval.BudgetRequest',
        signal_profile='budget_request',
        payload_builder='budget_request_event_payload',
        topic_by_event={
            'request_created': 'BUDGET_REQUEST_CREATED',
            'request_approved': 'BUDGET_REQUEST_APPROVED',
            'request_rejected': 'BUDGET_REQUEST_REJECTED',
        },
    ),
    'metric_upload': DomainConfig(
        consumer_domain='metric_upload',
        model_label='metric_upload.MetricFile',
        signal_profile='metric_upload',
        payload_builder='metric_file_event_payload',
        topic_by_event={
            'uploaded': 'METRIC_UPLOADED',
            'processed': 'METRIC_PROCESSED',
        },
    ),
    'optimization': DomainConfig(
        consumer_domain='optimization',
        model_label='optimization.OptimizationExperiment',
        signal_profile='optimization',
        payload_builder='optimization_event_payload',
        topic_by_event={
            'experiment_created': 'OPTIMIZATION_EXPERIMENT_CREATED',
            'experiment_completed': 'OPTIMIZATION_EXPERIMENT_COMPLETED',
        },
    ),
    'workflow': DomainConfig(
        consumer_domain='workflow',
        model_label='agent.AgentWorkflowRun',
        signal_profile='workflow_run',
        payload_builder='workflow_run_event_payload',
        topic_by_event={
            'workflow_triggered': 'WORKFLOW_TRIGGERED',
            'workflow_completed': 'WORKFLOW_COMPLETED',
        },
    ),
    'automation_workflow': DomainConfig(
        consumer_domain='automation_workflow',
        model_label='agent.AgentWorkflowDefinition',
        signal_profile='crud_status_soft_delete',
        payload_builder='automation_workflow_event_payload',
        topic_by_event={
            'created': 'AUTOMATION_WORKFLOW_CREATED',
            'updated': 'AUTOMATION_WORKFLOW_UPDATED',
            'deleted': 'AUTOMATION_WORKFLOW_DELETED',
            'status_changed': 'AUTOMATION_WORKFLOW_STATUS_CHANGED',
        },
    ),
    'spreadsheet': DomainConfig(
        consumer_domain='spreadsheet',
        model_label='spreadsheet.Spreadsheet',
        signal_profile='project_soft_delete',
        payload_builder='spreadsheet_event_payload',
        topic_by_event={
            'created': 'SPREADSHEET_CREATED',
            'updated': 'SPREADSHEET_UPDATED',
            'deleted': 'SPREADSHEET_DELETED',
        },
    ),
    'notion': DomainConfig(
        consumer_domain='notion',
        model_label='notion_editor.Draft',
        signal_profile='crud_status_soft_delete',
        payload_builder='notion_draft_event_payload',
        topic_by_event={
            'created': 'NOTION_CREATED',
            'updated': 'NOTION_UPDATED',
            'deleted': 'NOTION_DELETED',
            'status_changed': 'NOTION_STATUS_CHANGED',
        },
    ),
    'meetings': DomainConfig(
        consumer_domain='meetings',
        model_label='meetings.Meeting',
        signal_profile='crud_status_soft_delete',
        payload_builder='meeting_event_payload',
        topic_by_event={
            'created': 'MEETING_CREATED',
            'updated': 'MEETING_UPDATED',
            'deleted': 'MEETING_DELETED',
            'status_changed': 'MEETING_STATUS_CHANGED',
        },
    ),
    'calendar': DomainConfig(
        consumer_domain='calendar',
        model_label='calendars.Event',
        signal_profile='crud_status_soft_delete',
        payload_builder='calendar_event_payload',
        topic_by_event={
            'created': 'CALENDAR_EVENT_CREATED',
            'updated': 'CALENDAR_EVENT_UPDATED',
            'deleted': 'CALENDAR_EVENT_DELETED',
            'status_changed': 'CALENDAR_EVENT_STATUS_CHANGED',
        },
    ),
    'messages': DomainConfig(
        consumer_domain='messages',
        model_label='chat.Message',
        signal_profile='project_soft_delete',
        payload_builder='message_event_payload',
        topic_by_event={
            'created': 'MESSAGE_CREATED',
            'updated': 'MESSAGE_UPDATED',
            'deleted': 'MESSAGE_DELETED',
        },
    ),
}


def consumer_domains() -> tuple[str, ...]:
    """Unique consumer CLI domain names in stable order."""
    seen: list[str] = []
    for config in DOMAIN_CONFIGS.values():
        if config.consumer_domain not in seen:
            seen.append(config.consumer_domain)
    return tuple(seen)


def topics_for_consumer_domain(consumer_domain: str) -> list[str]:
    """Collect all Kafka topic names for a consumer domain."""
    from django.conf import settings

    topic_keys: list[str] = []
    for config in DOMAIN_CONFIGS.values():
        if config.consumer_domain == consumer_domain:
            topic_keys.extend(config.topic_by_event.values())
    # dedupe preserving order
    seen: set[str] = set()
    topics: list[str] = []
    for key in topic_keys:
        if key in seen:
            continue
        seen.add(key)
        topics.append(settings.KAFKA_TOPICS[key])
    return topics
