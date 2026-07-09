from __future__ import annotations

from typing import Any


def _base(event_type: str, **fields: Any) -> dict[str, Any]:
    return {'event': event_type, **fields}


def campaign_event_payload(campaign, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        campaign_id=str(campaign.id),
        name=campaign.name,
        status=campaign.status,
        project_id=str(campaign.project_id),
        is_deleted=bool(campaign.is_deleted),
    )


def asset_event_payload(asset, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        asset_id=asset.id,
        status=asset.status,
        owner_id=asset.owner_id,
        task_id=asset.task_id,
        team_id=asset.team_id,
    )


def task_event_payload(task, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        task_id=task.id,
        summary=task.summary,
        status=task.status,
        project_id=task.project_id,
        owner_id=task.owner_id,
        type=task.type,
    )


def decision_event_payload(decision, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        decision_id=str(decision.id),
        slug=decision.slug,
        title=decision.title,
        status=decision.status,
        project_id=decision.project_id,
        topic=decision.topic,
        risk_level=decision.risk_level,
        is_deleted=bool(decision.is_deleted),
    )


def retrospective_event_payload(retrospective, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        retrospective_id=str(retrospective.id),
        status=retrospective.status,
        project_id=retrospective.campaign_id,
    )


def budget_request_event_payload(budget_request, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        budget_request_id=budget_request.id,
        status=budget_request.status,
        amount=str(budget_request.amount),
        currency=budget_request.currency,
        requested_by_id=budget_request.requested_by_id,
    )


def metric_file_event_payload(metric_file, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        metric_file_id=metric_file.id,
        status=metric_file.status,
        uploaded_by_id=metric_file.uploaded_by_id,
        original_filename=metric_file.original_filename,
    )


def optimization_event_payload(experiment, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        experiment_id=experiment.id,
        name=experiment.name,
        status=experiment.status,
        experiment_type=experiment.experiment_type,
        created_by_id=experiment.created_by_id,
    )


def workflow_run_event_payload(workflow_run, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        workflow_run_id=str(workflow_run.id),
        status=workflow_run.status,
        session_id=str(workflow_run.session_id),
    )


def notion_draft_event_payload(draft, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        draft_id=draft.id,
        slug=draft.slug,
        title=getattr(draft, 'title', None),
        status=getattr(draft, 'status', None),
        user_id=draft.user_id,
        is_deleted=bool(draft.is_deleted),
    )


def spreadsheet_event_payload(spreadsheet, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        spreadsheet_id=spreadsheet.id,
        slug=spreadsheet.slug,
        name=spreadsheet.name,
        project_id=spreadsheet.project_id,
        is_deleted=bool(spreadsheet.is_deleted),
    )


def meeting_event_payload(meeting, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        meeting_id=meeting.id,
        slug=meeting.slug,
        title=meeting.title,
        status=meeting.status,
        project_id=meeting.project_id,
        is_deleted=bool(meeting.is_deleted),
    )


def automation_workflow_event_payload(workflow, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        workflow_id=str(workflow.id),
        slug=workflow.slug,
        name=workflow.name,
        status=workflow.status,
        project_id=workflow.project_id,
        is_system=bool(workflow.is_system),
        is_deleted=bool(workflow.is_deleted),
    )


def calendar_event_payload(event, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        event_id=str(event.id),
        title=event.title,
        status=event.status,
        calendar_id=str(event.calendar_id),
        organization_id=event.organization_id,
        is_deleted=bool(event.is_deleted),
    )


def message_event_payload(message, event_type: str) -> dict[str, Any]:
    return _base(
        event_type,
        message_id=message.id,
        chat_id=message.chat_id,
        sender_id=message.sender_id,
        is_deleted=bool(message.is_deleted),
        is_revoked=bool(message.is_revoked),
    )


PAYLOAD_BUILDERS = {
    'campaign_event_payload': campaign_event_payload,
    'asset_event_payload': asset_event_payload,
    'task_event_payload': task_event_payload,
    'decision_event_payload': decision_event_payload,
    'retrospective_event_payload': retrospective_event_payload,
    'budget_request_event_payload': budget_request_event_payload,
    'metric_file_event_payload': metric_file_event_payload,
    'optimization_event_payload': optimization_event_payload,
    'workflow_run_event_payload': workflow_run_event_payload,
    'notion_draft_event_payload': notion_draft_event_payload,
    'spreadsheet_event_payload': spreadsheet_event_payload,
    'meeting_event_payload': meeting_event_payload,
    'automation_workflow_event_payload': automation_workflow_event_payload,
    'calendar_event_payload': calendar_event_payload,
    'message_event_payload': message_event_payload,
}
