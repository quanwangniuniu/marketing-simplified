import json
import logging
import os
import requests
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db.models import Max

from django.utils import timezone as django_timezone

from spreadsheet.models import Spreadsheet, Sheet, Cell
from decision.models import Decision, Signal, Option
from task.models import Task
from .models import (
    AgentSession, AgentMessage, AgentWorkflowRun, ImportedCSVFile,
    AgentWorkflowDefinition, AgentStepExecution,
)
from . import data_service
from . import file_parser
from .dify_workflows import json_input, run_dify_workflow, serialize_agent_messages

logger = logging.getLogger(__name__)


def _create_agent_status_message(session, content, *, event_type, message_type='text', **metadata):
    if not isinstance(session, AgentSession):
        logger.debug(
            "Skipping agent status message creation for non-model session=%s event_type=%s",
            getattr(session, 'id', session),
            event_type,
        )
        return None
    logger.info(
        "Creating agent status message for session=%s event_type=%s",
        session.id,
        event_type,
    )
    return AgentMessage.objects.create(
        session=session,
        role='assistant',
        content=content,
        message_type=message_type,
        metadata={'event_type': event_type, **metadata},
    )


def _get_llm_client():
    """Return an Anthropic client if API key is set, else None."""
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        logger.warning("anthropic package not installed, using mock LLM")
        return None


def _extract_spreadsheet_data(spreadsheet):
    """Extract spreadsheet data into a structured dict for LLM analysis."""
    data = {"name": spreadsheet.name, "sheets": []}
    for sheet in spreadsheet.sheets.filter(is_deleted=False).order_by('position'):
        columns = list(
            sheet.columns.filter(is_deleted=False)
            .order_by('position')
            .values_list('name', flat=True)
        )
        rows_data = []
        rows = sheet.rows.filter(is_deleted=False).order_by('position')[:100]  # limit rows
        for row in rows:
            cells = Cell.objects.filter(
                sheet=sheet, row=row, is_deleted=False
            ).select_related('column').order_by('column__position')
            row_dict = {}
            for cell in cells:
                col_name = cell.column.name if cell.column else f"col_{cell.column_id}"
                if cell.computed_type == 'NUMBER' and cell.computed_number is not None:
                    row_dict[col_name] = float(cell.computed_number)
                elif cell.computed_string:
                    row_dict[col_name] = cell.computed_string
                elif cell.string_value:
                    row_dict[col_name] = cell.string_value
                elif cell.number_value is not None:
                    row_dict[col_name] = float(cell.number_value)
                elif cell.boolean_value is not None:
                    row_dict[col_name] = cell.boolean_value
            if row_dict:
                rows_data.append(row_dict)
        data["sheets"].append({
            "name": sheet.name,
            "columns": columns,
            "rows": rows_data,
        })
    return data


def _call_llm(client, spreadsheet_data):
    """Call Claude API to analyze spreadsheet data."""
    system_prompt = (
        "You are a media buying analyst AI. Analyze spreadsheet data and identify "
        "anomalies in campaign performance metrics like ROAS, CPA, CTR, conversion "
        "rate, ad spend, etc.\n\n"
        "Return your analysis as JSON with this structure:\n"
        '{"anomalies": [{"metric": "...", "movement": "...", "scope_type": "...", '
        '"scope_value": "...", "delta_value": ..., "delta_unit": "...", '
        '"period": "...", "description": "..."}], '
        '"suggested_decision": {"title": "...", "context_summary": "...", '
        '"reasoning": "...", "risk_level": "LOW|MEDIUM|HIGH", "confidence": 1-5, '
        '"options": [{"text": "...", "order": 0}]}, '
        '"recommended_tasks": [{"type": "optimization|alert|asset|execution", '
        '"summary": "...", "priority": "HIGH|MEDIUM|LOW"}]}\n\n'
        "Only return valid JSON, no markdown code fences."
    )
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": f"Analyze this spreadsheet data:\n{json.dumps(spreadsheet_data, default=str)}",
            }
        ],
    )
    text = response.content[0].text
    return json.loads(text)


def _get_dify_config():
    """Return Dify API config if configured, else None."""
    api_url = getattr(settings, 'DIFY_API_URL', os.environ.get('DIFY_API_URL'))
    api_key = getattr(settings, 'DIFY_API_KEY', os.environ.get('DIFY_API_KEY'))
    if api_url and api_key:
        return {'url': api_url, 'key': api_key}
    return None


def _call_dify(spreadsheet_data, user_id=None):
    """Call Dify workflow API to analyze spreadsheet data.

    Dify workflows accept inputs and return structured outputs.
    Expected workflow: Input (spreadsheet_data JSON) → LLM analysis → structured output.
    """
    config = _get_dify_config()
    if not config:
        raise RuntimeError("Dify not configured (DIFY_API_URL / DIFY_API_KEY missing)")

    try:
        outputs = run_dify_workflow(
            api_url=config['url'],
            api_key=config['key'],
            inputs={
                'spreadsheet_data': json_input(spreadsheet_data),
            },
            user_id=user_id,
        )
    except requests.HTTPError as e:
        status_code = getattr(getattr(e, 'response', None), 'status_code', None)
        logger.error(f"Dify API error: HTTP {status_code}")
        raise RuntimeError(f"Dify API returned {status_code}") from e

    # The workflow should return our expected JSON structure.
    # It may be in a 'result' or 'text' key, or directly as structured data.
    if isinstance(outputs, dict):
        # If the output has our expected keys directly
        if 'anomalies' in outputs:
            return outputs
        # If wrapped in a 'result' or 'text' key
        for key in ('result', 'text', 'output', 'analysis'):
            val = outputs.get(key)
            if val:
                if isinstance(val, str):
                    try:
                        return json.loads(val)
                    except json.JSONDecodeError:
                        pass
                elif isinstance(val, dict) and 'anomalies' in val:
                    return val

    # Fallback: try to parse the entire output as our structure
    logger.warning(f"Unexpected Dify output format, falling back. Keys: {list(outputs.keys()) if isinstance(outputs, dict) else type(outputs)}")
    raise RuntimeError("Dify returned unexpected output format")


def _run_analysis(spreadsheet_data, user_id=None):
    """Run analysis using the best available provider: Dify > Claude.

    Raises RuntimeError if no provider is configured or all providers fail.
    """
    # 1. Try Dify first if configured
    dify_config = _get_dify_config()
    if dify_config:
        try:
            return _call_dify(spreadsheet_data, user_id)
        except Exception as e:
            logger.error(f"Dify call failed, falling back to Claude: {e}")

    # 2. Try Claude API
    client = _get_llm_client()
    if client:
        try:
            return _call_llm(client, spreadsheet_data)
        except Exception as e:
            logger.error(f"LLM call failed: {e}")

    # 3. No LLM available
    raise RuntimeError(
        "No analysis provider available. Configure DIFY_API_URL/DIFY_API_KEY "
        "or ANTHROPIC_API_KEY to enable analysis."
    )


def _serialize_project_members(project, excluded_users=None):
    """Return a minimal project member list for Dify follow-up disambiguation."""
    from core.models import ProjectMember

    excluded_user_ids = {
        user.id for user in (excluded_users or []) if getattr(user, 'id', None)
    }
    members = (
        ProjectMember.objects.filter(project=project, is_active=True)
        .exclude(user_id__in=excluded_user_ids)
        .select_related('user')
    )

    serialized = []
    for member in members:
        user = member.user
        display_name = user.get_full_name().strip() or user.username or user.email
        serialized.append(
            {
                'username': user.username,
                'email': user.email,
                'display_name': display_name,
            }
        )
    return serialized


def _coerce_json(value):
    """Parse a JSON string if possible, otherwise return the original value."""
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return value


def _normalize_dify_chat_output(output):
    """Normalize Dify follow-up output to {status, text, forwards}."""
    parsed = _coerce_json(output)
    if isinstance(parsed, dict):
        status = parsed.get('status') or 'completed'
        if status not in ('completed', 'needs_clarification'):
            status = 'completed'

        text = parsed.get('text')
        if not isinstance(text, str) or not text.strip():
            fallback_text = parsed.get('result') or parsed.get('output') or parsed.get('answer')
            if isinstance(fallback_text, str) and fallback_text.strip():
                text = fallback_text
            else:
                text = ''

        forwards = _coerce_json(parsed.get('forwards', []))
        if not isinstance(forwards, list):
            forwards = []

        normalized_forwards = []
        for item in forwards:
            if not isinstance(item, dict):
                continue
            username = item.get('username')
            content = item.get('content')
            if not isinstance(username, str) or not username.strip():
                continue
            if not isinstance(content, str) or not content.strip():
                continue
            normalized_forwards.append(
                {
                    'username': username.strip(),
                    'content': content.strip(),
                }
            )

        if text.strip():
            return {
                'status': status,
                'text': text.strip(),
                'forwards': normalized_forwards,
            }

    if isinstance(parsed, str) and parsed.strip():
        return {
            'status': 'completed',
            'text': parsed.strip(),
            'forwards': [],
        }
    return None


def _call_dify_chat(
    chat_messages,
    user_id=None,
    analysis_result=None,
    project_members=None,
    current_username='',
):
    """Call Dify chat workflow API with conversation context."""
    api_url = getattr(settings, 'DIFY_API_URL', '') or os.environ.get('DIFY_API_URL', '')
    api_key = getattr(settings, 'DIFY_CHAT_API_KEY', '') or os.environ.get('DIFY_CHAT_API_KEY', '')
    if not api_url or not api_key:
        raise RuntimeError("Dify chat not configured (DIFY_API_URL / DIFY_CHAT_API_KEY missing)")

    try:
        outputs = run_dify_workflow(
            api_url=api_url,
            api_key=api_key,
            inputs={
                'chat_messages': chat_messages,
                'analysis_result': json_input(analysis_result) if analysis_result else '',
                'project_members': json_input(project_members or []),
                'current_username': current_username or '',
            },
            user_id=user_id,
        )
    except requests.HTTPError as e:
        status_code = getattr(getattr(e, 'response', None), 'status_code', None)
        logger.error(f"Dify chat API error: HTTP {status_code}")
        raise RuntimeError(f"Dify chat API returned {status_code}") from e

    if isinstance(outputs, dict):
        candidates = [outputs]
        for key in ('result', 'text', 'output', 'answer'):
            val = outputs.get(key)
            if val:
                candidates.append(val)
        for candidate in candidates:
            normalized = _normalize_dify_chat_output(candidate)
            if normalized:
                return normalized
    else:
        normalized = _normalize_dify_chat_output(outputs)
        if normalized:
            return normalized

    # Extract text reply and forwards
    reply = ''
    forwards = []

    if isinstance(outputs, dict):
        for key in ('result', 'text', 'output', 'answer'):
            val = outputs.get(key)
            if val and isinstance(val, str):
                # Try to parse as JSON — Dify may wrap {text, forwards} in a string
                try:
                    parsed = json.loads(val)
                    if isinstance(parsed, dict) and 'text' in parsed:
                        reply = parsed['text']
                        ft = parsed.get('forwards', [])
                        if isinstance(ft, str):
                            try:
                                ft = json.loads(ft)
                            except (json.JSONDecodeError, TypeError):
                                ft = []
                        if isinstance(ft, list):
                            forwards = ft
                        break
                except (json.JSONDecodeError, TypeError):
                    pass
                # Not JSON or no 'text' key — use as plain reply
                reply = val
                break
    elif isinstance(outputs, str):
        try:
            parsed = json.loads(outputs)
            if isinstance(parsed, dict) and 'text' in parsed:
                reply = parsed['text']
                ft = parsed.get('forwards', [])
                if isinstance(ft, str):
                    try:
                        ft = json.loads(ft)
                    except (json.JSONDecodeError, TypeError):
                        ft = []
                if isinstance(ft, list):
                    forwards = ft
        except (json.JSONDecodeError, TypeError):
            reply = outputs

    if not reply:
        logger.warning(f"Unexpected Dify chat output format: {type(outputs)}")
        raise RuntimeError("Dify chat returned unexpected output format")

    # Fallback: if forwards not extracted above, check outputs directly
    if not forwards and isinstance(outputs, dict):
        ft = outputs.get('forwards', [])
        if isinstance(ft, str):
            try:
                ft = json.loads(ft)
            except (json.JSONDecodeError, TypeError):
                ft = []
        if isinstance(ft, list):
            forwards = ft

    return {"reply": reply, "forwards": forwards}


def _generate_miro_board_for_workflow_run(orchestrator, workflow_run):
    """Generate and persist a Miro board from an existing workflow run."""
    from .miro_board_service import create_board_from_snapshot
    from .miro_generation import (
        build_miro_generation_context_from_run,
        call_dify_miro_generator,
    )

    context = build_miro_generation_context_from_run(
        session=orchestrator.session,
        workflow_run=workflow_run,
    )
    snapshot = call_dify_miro_generator(context, user_id=orchestrator.user.id)
    board, persisted_snapshot = create_board_from_snapshot(
        project=orchestrator.project,
        session=orchestrator.session,
        workflow_run=workflow_run,
        snapshot=snapshot,
    )

    workflow_run.miro_snapshot = persisted_snapshot
    workflow_run.miro_board = board
    workflow_run.save(update_fields=['miro_snapshot', 'miro_board'])

    return persisted_snapshot, board


def _enqueue_miro_generation_for_workflow_run(orchestrator, workflow_run):
    """Queue Miro generation so task creation can return immediately."""
    from .tasks import generate_miro_board_for_workflow_run_task

    logger.info(
        "Queueing background Miro generation for workflow_run=%s session=%s",
        workflow_run.id,
        orchestrator.session.id,
    )
    generate_miro_board_for_workflow_run_task.delay(str(workflow_run.id))
def _get_or_create_bot_private_chat(bot, target_user, project):
    """Find or create a private chat with exactly 2 participants: bot and target.

    Unlike ChatService.create_private_chat, this enforces participant_count==2
    so it won't accidentally match a group-like chat where bot was added as a
    third participant (e.g. via @Agent lazy-join).
    """
    from chat.models import Chat, ChatType, ChatParticipant

    # First, find chats that contain both bot and target_user
    chat = (
        Chat.objects.filter(
            project=project,
            type=ChatType.PRIVATE,
            participants__user=bot,
        )
        .filter(participants__user=target_user)
        .distinct()
        .first()
    )

    # Second, verify it has exactly 2 participants (not a group chat)
    if chat:
        participant_count = chat.participants.count()
        if participant_count != 2:
            # Not exactly 2 participants, might be a group chat
            chat = None

    # If found, reactivate any inactive participants
    if chat:
        participants = ChatParticipant.objects.filter(chat=chat, user__in=[bot, target_user])
        for participant in participants:
            if not participant.is_active:
                participant.is_active = True
                participant.save(update_fields=['is_active', 'updated_at'])
        return chat, False

    # Not found, create new chat
    chat = Chat.objects.create(project=project, type=ChatType.PRIVATE)
    ChatParticipant.objects.create(chat=chat, user=bot, is_active=True)
    ChatParticipant.objects.create(chat=chat, user=target_user, is_active=True)
    return chat, True


def _forward_to_users(forwards, sender, project):
    """Send messages to users based on Dify forwards structure.

    Uses the Agent Bot system user as the chat sender so that
    the private chat always involves two distinct users — avoiding the
    sender==target bug when forwarding to oneself.
    """
    from chat.services import MessageService
    from chat.tasks import notify_new_message
    from core.models import ProjectMember
    from core.utils.bot_user import get_agent_bot_user

    bot = get_agent_bot_user()
    sender_name = sender.get_full_name() or sender.username or sender.email

    results = []
    for item in forwards:
        username = (item.get('username') or '').strip()
        content = (item.get('content') or '').strip()
        if not username or not content:
            continue

        prefixed_content = f"from {sender_name} by agent:\n{content}"

        members = (
            ProjectMember.objects.filter(project=project, is_active=True)
            .exclude(user=bot)
            .filter(user__username__iexact=username)
            .select_related('user')
        )
        if not members.exists():
            members = (
                ProjectMember.objects.filter(project=project, is_active=True)
                .exclude(user=bot)
                .filter(user__email__iexact=username)
                .select_related('user')
            )

        if not members.exists():
            logger.warning(f"Forward target '{username}' not found in project {project.id}")
            results.append({"username": username, "status": "not_found"})
            continue

        if members.count() > 1:
            logger.warning(f"Forward target '{username}' is ambiguous in project {project.id}")
            results.append({"username": username, "status": "ambiguous"})
            continue

        target_user = members.first().user
        try:
            chat, _ = _get_or_create_bot_private_chat(bot, target_user, project)
            message = MessageService.create_message(chat=chat, sender=bot, content=prefixed_content)
            notify_new_message.delay(message.id)
            logger.info(
                "Agent forwarded message for project=%s sender=%s target_user=%s username=%s chat=%s message=%s",
                project.id,
                sender.id,
                target_user.id,
                username,
                chat.id,
                message.id,
            )
            results.append({"username": username, "status": "sent", "user_id": target_user.id})
        except Exception as e:
            logger.error(f"Failed to forward to {username}: {e}")
            results.append({"username": username, "status": "error", "detail": str(e)})

    return results


class AgentOrchestrator:
    def __init__(self, user, project, session):
        self.user = user
        self.project = project
        self.session = session

    def handle_message(self, message, spreadsheet_id=None, csv_filename=None,
                       action=None, file_id=None, calendar_context=None,
                       workflow_id=None, column_mapping=None):
        """Main entry point. Routes calendar context first, then workflow engine or legacy logic.

        Yields SSE chunks as dicts.
        """
        # --- Calendar context takes priority over all other routing ---
        if calendar_context:
            yield from self.answer_calendar_question(message, calendar_context)
            yield {"type": "done"}
            return

        # --- Resume a paused workflow ---
        if action in ('confirm_decision', 'create_tasks'):
            latest_run = self.session.workflow_runs.filter(
                is_deleted=False
            ).order_by('-created_at').first()

            if latest_run and latest_run.workflow_definition:
                yield from self._resume_workflow(latest_run)
                yield {"type": "done"}
                return
            else:
                yield from self._legacy_confirm(action, latest_run)
                yield {"type": "done"}
                return

        # Resume after user confirms / edits the detected column mapping.
        if action == 'confirm_columns':
            latest_run = self.session.workflow_runs.filter(
                is_deleted=False
            ).order_by('-created_at').first()

            if latest_run and latest_run.workflow_definition:
                # Inject the user-approved mapping so NormalizeDataExecutor
                # can pick it up from input_data.
                extra = {'column_mapping': column_mapping} if column_mapping else {}
                yield from self._resume_workflow(latest_run, extra_input=extra)
            else:
                yield {"type": "error", "content": "No paused workflow to confirm."}
            yield {"type": "done"}
            return

        if action == 'generate_miro':
            latest_run = self.session.workflow_runs.filter(
                is_deleted=False
            ).order_by('-created_at').first()
            yield from self._legacy_confirm(action, latest_run)
            yield {"type": "done"}
            return

        if action == 'distribute_message':
            yield {
                "type": "text",
                "content": "Message distribution is being configured. This feature will be available soon.",
            }
            yield {"type": "done"}
            return

        if action == 'start_follow_up':
            latest_run = self.session.workflow_runs.filter(
                status='awaiting_confirmation',
                analysis_result__isnull=False,
                is_deleted=False,
            ).order_by('-created_at').first()
            yield from self._start_follow_up(latest_run)
            yield {"type": "done"}
            return

        if action == 'cancel_follow_up':
            latest_run = self.session.workflow_runs.filter(
                status='awaiting_confirmation',
                analysis_result__isnull=False,
                is_deleted=False,
            ).order_by('-created_at').first()
            yield from self._cancel_follow_up(latest_run)
            yield {"type": "done"}
            return

        # --- Start a new workflow ---
        if file_id or spreadsheet_id or csv_filename or (action == 'analyze'):
            workflow_def = self._resolve_workflow(workflow_id)
            if workflow_def:
                yield from self._start_workflow(
                    workflow_def,
                    file_id=file_id,
                    spreadsheet_id=spreadsheet_id,
                    csv_filename=csv_filename,
                )
                yield {"type": "done"}
                return

        # --- No workflow match → full legacy logic (includes follow-up chat) ---
        yield from self._legacy_handle(
            message, spreadsheet_id, csv_filename, action, file_id
        )

    def _fetch_events_for_context(self, calendar_context):
        """Fetch calendar events for the given context.

        For a specific event: returns just that event.
        For a calendar view: returns events within the currently visible date
        range (day / week / month), so the AI only discusses what the user sees.
        Falls back to a ±7-day window when no view info is available.
        """
        try:
            from calendars.models import Event
        except ImportError:
            return []

        org_id = getattr(self.user, 'organization_id', None)
        if not org_id:
            return []

        event_id = calendar_context.get('eventId')

        # Specific event — return it regardless of time
        if event_id:
            try:
                return [Event.objects.select_related('calendar').get(
                    id=event_id, organization_id=org_id
                )]
            except Event.DoesNotExist:
                return []

        # Determine window from the calendar view the user is currently on
        import pytz as _pytz
        from datetime import datetime as _dt, timedelta as _td, time as _time

        current_date_str = calendar_context.get('currentDate')
        current_view = (calendar_context.get('currentView') or 'week').lower()
        user_tz_name = (calendar_context.get('userTimezone') or 'UTC').strip()
        try:
            user_tz = _pytz.timezone(user_tz_name)
        except _pytz.UnknownTimeZoneError:
            user_tz = _pytz.utc

        if current_date_str:
            try:
                base = _dt.strptime(current_date_str, '%Y-%m-%d').date()
                if current_view == 'day':
                    view_start = base
                    view_end = base
                elif current_view == 'month':
                    import calendar as _cal
                    view_start = base.replace(day=1)
                    view_end = base.replace(day=_cal.monthrange(base.year, base.month)[1])
                else:  # week (default)
                    # Monday of the week containing base; extend 2 extra weeks so
                    # follow-up questions like "what about next week?" have data.
                    monday = base - _td(days=base.weekday())
                    view_start = monday
                    view_end = monday + _td(days=20)

                window_start = user_tz.localize(_dt.combine(view_start, _time.min)).astimezone(_pytz.utc)
                window_end = user_tz.localize(_dt.combine(view_end, _time.max)).astimezone(_pytz.utc)
            except (ValueError, Exception):
                now = django_timezone.now()
                window_start = now - django_timezone.timedelta(days=7)
                window_end = now + django_timezone.timedelta(days=7)
        else:
            now = django_timezone.now()
            window_start = now - django_timezone.timedelta(days=7)
            window_end = now + django_timezone.timedelta(days=7)

        qs = Event.objects.filter(
            organization_id=org_id,
            start_datetime__gte=window_start,
            start_datetime__lte=window_end,
            is_deleted=False,
        ).select_related('calendar').order_by('start_datetime')

        # Filter by visible calendar IDs if provided in context
        calendar_ids = calendar_context.get('calendarIds') or []
        calendar_id = calendar_context.get('calendarId')
        if calendar_ids:
            qs = qs.filter(calendar__id__in=calendar_ids)
        elif calendar_id:
            qs = qs.filter(calendar__id=calendar_id)

        return list(qs[:30])

    def _create_calendar_event(self, org_id, event_spec, user_tz=None):
        """Create a single calendar event from a dict spec. Returns event id or None."""
        try:
            from calendars.models import Calendar as CalendarModel, Event as EventModel
            from dateutil import parser as date_parser
            import pytz

            def _parse_dt(dt_str):
                if not dt_str:
                    return None
                # Dify may echo back the timezone-name suffix we used for existing
                # events (e.g. "2026-03-31T14:00:00 Australia/Melbourne").
                # dateutil cannot parse IANA timezone names inline, so strip the
                # suffix and let user_tz.localize() apply the correct timezone.
                raw = str(dt_str).strip()
                date_part = raw.split(" ")[0] if " " in raw else raw
                dt = date_parser.parse(date_part)
                if dt.tzinfo is None and user_tz:
                    dt = user_tz.localize(dt)
                elif dt.tzinfo is None:
                    dt = pytz.utc.localize(dt)
                return dt

            # Prefer the user's primary calendar; fall back to any calendar they own
            cal = (
                CalendarModel.objects.filter(
                    organization_id=org_id,
                    owner=self.user,
                    is_deleted=False,
                ).order_by('-is_primary').first()
            )
            if not cal:
                return None
            tz_name = str(user_tz) if user_tz else "UTC"
            new_event = EventModel.objects.create(
                organization_id=org_id,
                calendar=cal,
                created_by=self.user,
                title=event_spec.get("title", "New Event"),
                description=event_spec.get("description", ""),
                start_datetime=_parse_dt(event_spec.get("start_datetime")),
                end_datetime=_parse_dt(event_spec.get("end_datetime")),
                timezone=tz_name,
            )
            return str(new_event.id)
        except Exception as e:
            logger.error(f"Failed to create calendar event: {e}")
            return None

    def answer_calendar_question(self, message, calendar_context):
        """Answer calendar-related questions using real event data via Dify AI."""
        yield {"type": "text", "content": "Looking up your calendar data..."}

        events = self._fetch_events_for_context(calendar_context)

        # Resolve user timezone from context (fallback to UTC)
        import pytz
        user_tz_name = (calendar_context.get('userTimezone') or 'UTC').strip()
        try:
            user_tz = pytz.timezone(user_tz_name)
        except pytz.UnknownTimeZoneError:
            user_tz = pytz.utc
            user_tz_name = 'UTC'

        # Serialize events for Dify using user's local timezone
        now = django_timezone.now()
        now_local = now.astimezone(user_tz)
        events_data = []
        for evt in events:
            is_past = evt.start_datetime < now
            local_start = evt.start_datetime.astimezone(user_tz)
            local_end = evt.end_datetime.astimezone(user_tz)
            events_data.append({
                "id": str(evt.id),
                "title": evt.title or "(No title)",
                "start_datetime": local_start.strftime(f'%Y-%m-%dT%H:%M:%S {user_tz_name}'),
                "end_datetime": local_end.strftime(f'%Y-%m-%dT%H:%M:%S {user_tz_name}'),
                "is_past": is_past,
                "calendar": evt.calendar.name,
                "location": evt.location or "",
                "description": evt.description or "",
            })

        calendar_payload = {
            "current_time_local": now_local.strftime(f'%Y-%m-%dT%H:%M:%S {user_tz_name}'),
            "user_timezone": user_tz_name,
            "events": events_data,
        }
        calendar_data_str = json.dumps(calendar_payload, ensure_ascii=False)

        # Call Dify Calendar Assistant workflow
        dify_api_key = getattr(settings, 'DIFY_CALENDAR_API_KEY', '') or os.environ.get('DIFY_CALENDAR_API_KEY', '')
        dify_api_url = getattr(settings, 'DIFY_API_URL', '') or os.environ.get('DIFY_API_URL', 'https://api.dify.ai')

        if not dify_api_key:
            yield {"type": "error", "content": "Calendar AI is not configured. Please set DIFY_CALENDAR_API_KEY."}
            return

        try:
            resp = requests.post(
                f"{dify_api_url}/v1/workflows/run",
                headers={
                    "Authorization": f"Bearer {dify_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "inputs": {
                        "calendar_data": calendar_data_str,
                        "user_question": message,
                    },
                    "response_mode": "blocking",
                    "user": str(self.user.id),
                },
                timeout=90,
            )
            resp.raise_for_status()
            result = resp.json()
            raw_answer = result.get("data", {}).get("outputs", {}).get("answer", "")
        except Exception as e:
            logger.error(f"Dify calendar workflow error: {e}")
            yield {"type": "error", "content": "Failed to get AI response. Please try again."}
            return

        # Parse AI response (expects JSON with answer + create_events array)
        text = raw_answer.strip()
        for fence in ('```json', '```'):
            if text.startswith(fence):
                text = text[len(fence):]
        if text.endswith('```'):
            text = text[:-3]
        text = text.strip()

        try:
            parsed = json.loads(text)
            answer_text = parsed.get("answer", raw_answer)
            # Prefer create_events (array); only fall back to create_event (single) when
            # the array is absent/empty — avoids duplicates if Dify returns both keys.
            events_to_create = parsed.get("create_events") or []
            if not events_to_create:
                single = parsed.get("create_event")
                if single and isinstance(single, dict):
                    events_to_create = [single]
            # Track whether Dify included ANY creation-related key (even if empty/declined).
            # Used to suppress the calendar invite when the user already asked to create.
            # Only True when Dify actually provided event data to create.
            # Key presence alone (e.g. create_events: null / []) does not count.
            had_creation_intent = bool(parsed.get("create_events")) or bool(parsed.get("create_event"))
        except (json.JSONDecodeError, AttributeError):
            answer_text = raw_answer
            events_to_create = []
            had_creation_intent = False

        # Create all suggested events
        org_id = getattr(self.user, 'organization_id', None)
        created_count = 0
        failed_count = 0
        if events_to_create and org_id:
            for event_spec in events_to_create:
                if not isinstance(event_spec, dict):
                    continue
                event_id_created = self._create_calendar_event(org_id, event_spec, user_tz=user_tz)
                if event_id_created:
                    created_count += 1
                else:
                    failed_count += 1

            if created_count:
                answer_text += f"\n\n✅ {created_count} calendar event{'s' if created_count != 1 else ''} created successfully."
            if failed_count:
                answer_text += f"\n⚠️ {failed_count} event{'s' if failed_count != 1 else ''} could not be created automatically."

        yield {
            "type": "text",
            "content": answer_text,
        }
        if created_count:
            # Notify the calendar page to refresh
            yield {"type": "calendar_updated"}
        elif not had_creation_intent:
            # Only invite when the user asked a general calendar question,
            # not when they explicitly requested creation (even if Dify declined).
            yield {
                "type": "calendar_invite",
                "content": "Do you need me to create an event for you? If so, please tell me the specific time (down to the hour).",
            }

    def analyze_file(self, file_id):
        """Analyse any uploaded file (CSV/Excel) by its DB id."""
        yield {"type": "text", "content": "Analyzing file data..."}

        try:
            record = ImportedCSVFile.objects.get(
                id=file_id, project=self.project, is_deleted=False,
            )
        except ImportedCSVFile.DoesNotExist:
            yield {"type": "error", "content": f"File {file_id} not found."}
            return

        csv_dir = data_service._get_csv_dir()
        filepath = os.path.join(csv_dir, os.path.basename(record.filename))

        if not os.path.isfile(filepath):
            yield {"type": "error", "content": "File not found on disk."}
            return

        try:
            spreadsheet_data = file_parser.parse_file_to_json(filepath, record.filename)
        except Exception as e:
            yield {"type": "error", "content": f"Failed to parse file: {e}"}
            return

        workflow_run = AgentWorkflowRun.objects.create(
            session=self.session,
            status='analyzing',
        )

        try:
            analysis = _run_analysis(spreadsheet_data, user_id=self.user.id)
        except RuntimeError as e:
            workflow_run.status = 'failed'
            workflow_run.error_message = str(e)
            workflow_run.save()
            yield {"type": "error", "content": str(e)}
            return

        workflow_run.analysis_result = analysis
        workflow_run.status = 'awaiting_confirmation'
        workflow_run.save()

        anomalies = analysis.get("anomalies", [])
        summary_parts = [f"Found {len(anomalies)} anomalies:"]
        for a in anomalies:
            summary_parts.append(f"- {a.get('description', str(a))}")

        yield {
            "type": "analysis",
            "content": "\n".join(summary_parts),
            "data": analysis,
        }

    def analyze_spreadsheet(self, spreadsheet_id):
        """Read spreadsheet data via ORM, send to LLM for analysis."""
        yield {"type": "text", "content": "Analyzing spreadsheet data..."}

        try:
            spreadsheet = Spreadsheet.objects.get(
                id=spreadsheet_id,
                project=self.project,
                is_deleted=False,
            )
        except Spreadsheet.DoesNotExist:
            yield {"type": "error", "content": f"Spreadsheet {spreadsheet_id} not found."}
            return

        workflow_run = AgentWorkflowRun.objects.create(
            session=self.session,
            spreadsheet=spreadsheet,
            status='analyzing',
        )

        spreadsheet_data = _extract_spreadsheet_data(spreadsheet)

        try:
            analysis = _run_analysis(spreadsheet_data, user_id=self.user.id)
        except RuntimeError as e:
            workflow_run.status = 'failed'
            workflow_run.error_message = str(e)
            workflow_run.save()
            yield {"type": "error", "content": str(e)}
            return

        workflow_run.analysis_result = analysis
        workflow_run.status = 'awaiting_confirmation'
        workflow_run.save()

        anomalies = analysis.get("anomalies", [])
        summary_parts = [f"Found {len(anomalies)} anomalies:"]
        for a in anomalies:
            summary_parts.append(f"- {a['description']}")

        yield {
            "type": "analysis",
            "content": "\n".join(summary_parts),
            "data": analysis,
        }

    def analyze_csv(self, csv_filename):
        """Read an uploaded CSV file from disk, send to LLM for analysis."""
        yield {"type": "text", "content": "Analyzing CSV data..."}

        safe_name = os.path.basename(csv_filename)

        # Verify file belongs to this project
        record = ImportedCSVFile.objects.filter(
            filename=safe_name, project=self.project, is_deleted=False
        ).first()
        if not record:
            yield {"type": "error", "content": f"CSV file not found: {safe_name}"}
            return

        csv_dir = data_service._get_csv_dir()
        filepath = os.path.join(csv_dir, safe_name)

        if not os.path.isfile(filepath):
            yield {"type": "error", "content": f"CSV file not found on disk: {safe_name}"}
            return

        columns, rows = data_service._read_csv_file(filepath)
        if not rows:
            yield {"type": "error", "content": "CSV file is empty or could not be parsed."}
            return

        workflow_run = AgentWorkflowRun.objects.create(
            session=self.session,
            status='analyzing',
        )

        # Build spreadsheet-like data structure for the analysis pipeline
        spreadsheet_data = {
            "name": safe_name,
            "sheets": [{
                "name": "Sheet1",
                "columns": columns,
                "rows": rows[:100],  # limit rows sent to LLM
            }],
        }

        try:
            analysis = _run_analysis(spreadsheet_data, user_id=self.user.id)
        except RuntimeError as e:
            workflow_run.status = 'failed'
            workflow_run.error_message = str(e)
            workflow_run.save()
            yield {"type": "error", "content": str(e)}
            return

        workflow_run.analysis_result = analysis
        workflow_run.status = 'awaiting_confirmation'
        workflow_run.save()

        anomalies = analysis.get("anomalies", [])
        summary_parts = [f"Found {len(anomalies)} anomalies:"]
        for a in anomalies:
            summary_parts.append(f"- {a.get('description', str(a))}")

        yield {
            "type": "analysis",
            "content": "\n".join(summary_parts),
            "data": analysis,
        }

    def _start_follow_up(self, workflow_run):
        if not workflow_run or not workflow_run.analysis_result:
            yield {"type": "error", "content": "No analysis found to start a follow-up chat."}
            return

        if workflow_run.chat_followed_up:
            yield {"type": "error", "content": "Follow-up chat is already completed for this analysis."}
            return

        if not workflow_run.chat_follow_up_started:
            workflow_run.chat_follow_up_started = True
            workflow_run.save(update_fields=['chat_follow_up_started'])

        yield {
            "type": "follow_up_prompt",
            "content": "Follow-up chat started. Ask one follow-up question about the analysis, or include the exact username/email if you want me to prepare a forwarded message.",
            "data": {"workflow_run_id": str(workflow_run.id)},
        }

    def _cancel_follow_up(self, workflow_run):
        if not workflow_run or not workflow_run.analysis_result:
            yield {"type": "error", "content": "No analysis found to cancel a follow-up chat for."}
            return

        if workflow_run.chat_followed_up:
            yield {"type": "error", "content": "Follow-up chat is already completed for this analysis."}
            return

        if not workflow_run.chat_follow_up_started:
            yield {"type": "text", "content": "Follow-up chat is already inactive."}
            return

        workflow_run.chat_follow_up_started = False
        workflow_run.save(update_fields=['chat_follow_up_started'])
        yield {
            "type": "text",
            "content": "Follow-up chat closed.",
            "data": {"workflow_run_id": str(workflow_run.id)},
        }

    def create_decision_draft(self, analysis_result, workflow_run=None):
        """Create a Decision draft with Signals and Options from analysis."""
        yield {"type": "text", "content": "Creating decision pre-draft..."}

        if workflow_run:
            workflow_run.status = 'creating_decision'
            workflow_run.save()

        suggested = analysis_result.get("suggested_decision", {})

        # Calculate next project_seq
        max_seq = Decision.objects.filter(
            project=self.project
        ).aggregate(Max('project_seq'))['project_seq__max'] or 0

        decision = Decision.objects.create(
            title=suggested.get("title") or "AI Agent Analysis",
            context_summary=suggested.get("context_summary", ""),
            reasoning=suggested.get("reasoning", ""),
            risk_level=suggested.get("risk_level", "MEDIUM"),
            confidence=suggested.get("confidence", 3),
            status=Decision.Status.PREDRAFT,
            project=self.project,
            project_seq=max_seq + 1,
            author=self.user,
            created_by_agent=True,
            agent_session_id=self.session.id,
            is_pre_draft=True,
        )

        # Create signals from anomalies
        anomalies = analysis_result.get("anomalies", [])
        for anomaly in anomalies:
            Signal.objects.create(
                decision=decision,
                author=self.user,
                metric=anomaly.get("metric", ""),
                movement=anomaly.get("movement", ""),
                period=anomaly.get("period", ""),
                scope_type=anomaly.get("scope_type", ""),
                scope_value=anomaly.get("scope_value", ""),
                delta_value=anomaly.get("delta_value"),
                delta_unit=anomaly.get("delta_unit", ""),
                display_text=anomaly.get("description", ""),
            )

        # Create options — first option is selected by default so the decision
        # satisfies validate_can_commit() (exactly one option must be selected).
        options = suggested.get("options", [])
        for idx, opt in enumerate(options):
            Option.objects.create(
                decision=decision,
                text=opt.get("text", ""),
                order=opt.get("order", idx),
                is_selected=(idx == 0),
            )

        if workflow_run:
            workflow_run.decision = decision
            workflow_run.status = 'creating_tasks'
            workflow_run.save()

        yield {
            "type": "decision_draft",
            "content": f"Created decision draft: {decision.title}",
            "data": {"decision_id": decision.id},
        }
        yield {
            "type": "confirmation_request",
            "content": "Decision draft created. Would you like me to create tasks based on the recommended actions?",
            "data": {"decision_id": decision.id},
        }

    def create_tasks_from_analysis(self, workflow_run):
        """Create Tasks directly from analysis results, optionally linking to Decision if it exists."""
        yield {"type": "text", "content": "Creating tasks..."}

        existing_task_ids = getattr(workflow_run, "created_tasks", []) or []
        if existing_task_ids:
            decision = workflow_run.decision
            yield {
                "type": "task_created",
                "content": f"Tasks already created ({len(existing_task_ids)}).",
                "data": {
                    "task_ids": existing_task_ids,
                    "decision_id": decision.id if decision else None,
                },
            }
            return

        analysis = workflow_run.analysis_result or {}
        recommended_tasks = analysis.get("recommended_tasks", [])
        if not recommended_tasks:
            yield {"type": "error", "content": "No recommended tasks found in analysis."}
            return

        # If a decision exists, link tasks to it; otherwise leave unlinked
        decision = workflow_run.decision
        if decision:
            decision_ct = ContentType.objects.get_for_model(Decision)
            link_kwargs = {
                "content_type": decision_ct,
                "object_id": str(decision.id),
            }
            desc_suffix = f" (Decision: {decision.title})"
        else:
            link_kwargs = {}
            desc_suffix = ""

        task_ids = []
        for task_data in recommended_tasks:
            summary = task_data.get("summary", "AI Agent Generated Task")[:255]
            task = Task.objects.create(
                summary=summary,
                description=f"Auto-generated from AI analysis{desc_suffix}",
                type=task_data.get("type", "optimization"),
                priority=task_data.get("priority", "MEDIUM"),
                project=self.project,
                owner=self.user,
                **link_kwargs,
            )
            task_ids.append(task.id)

        workflow_run.created_tasks = task_ids
        workflow_run.save(update_fields=['created_tasks'])

        yield {
            "type": "task_created",
            "content": f"Created {len(task_ids)} tasks.",
            "data": {"task_ids": task_ids, "decision_id": decision.id if decision else None},
        }

        workflow_run.status = 'completed'
        workflow_run.save(update_fields=['status'])

    # ------------------------------------------------------------------
    # Workflow engine methods (AGENT-9)
    # ------------------------------------------------------------------

    def _resolve_workflow(self, workflow_id=None):
        """Find workflow definition: explicit ID > project default > system default."""
        if workflow_id:
            try:
                return AgentWorkflowDefinition.objects.get(
                    id=workflow_id, status='active', is_deleted=False,
                )
            except AgentWorkflowDefinition.DoesNotExist:
                return None

        # Project-level default
        project_default = AgentWorkflowDefinition.objects.filter(
            project=self.project, is_default=True,
            status='active', is_deleted=False,
        ).first()
        if project_default:
            return project_default

        # System-level default
        return AgentWorkflowDefinition.objects.filter(
            project__isnull=True, is_system=True, is_default=True,
            status='active', is_deleted=False,
        ).first()

    def _prepare_input_data(self, file_id=None, spreadsheet_id=None, csv_filename=None):
        """Build the initial input_data dict for the workflow engine.

        file_id is included in the returned dict so NormalizeDataExecutor can
        persist confirmed column mappings and row data to ImportedDataField /
        ImportedDataRecord without needing a separate DB lookup.
        """
        import os as _os

        if file_id:
            record = ImportedCSVFile.objects.get(
                id=file_id, project=self.project, is_deleted=False,
            )
            csv_dir = data_service._get_csv_dir()
            filepath = _os.path.join(csv_dir, _os.path.basename(record.filename))
            return {
                'spreadsheet_data': file_parser.parse_file_to_json(filepath, record.filename),
                'file_id': str(file_id),
            }

        if spreadsheet_id:
            spreadsheet = Spreadsheet.objects.get(
                id=spreadsheet_id, project=self.project, is_deleted=False,
            )
            return {
                'spreadsheet_data': _extract_spreadsheet_data(spreadsheet),
                'spreadsheet': spreadsheet,
            }

        if csv_filename:
            record = ImportedCSVFile.objects.get(
                filename=csv_filename, project=self.project, is_deleted=False,
            )
            csv_dir = data_service._get_csv_dir()
            filepath = _os.path.join(csv_dir, _os.path.basename(record.filename))
            columns, rows = data_service._read_csv_file(filepath)
            return {
                'spreadsheet_data': {
                    'name': record.original_filename,
                    'sheets': [{'name': 'Sheet1', 'columns': columns, 'rows': rows}],
                },
                'file_id': str(record.id),
            }

        return {}

    def _start_workflow(self, workflow_def, file_id=None, spreadsheet_id=None,
                        csv_filename=None):
        """Create a new WorkflowRun and execute steps."""
        input_data = self._prepare_input_data(
            file_id=file_id,
            spreadsheet_id=spreadsheet_id,
            csv_filename=csv_filename,
        )

        workflow_run = AgentWorkflowRun.objects.create(
            session=self.session,
            workflow_definition=workflow_def,
            status='analyzing',
            current_step_order=1,
            spreadsheet=input_data.get('spreadsheet'),
        )

        yield from self._execute_steps(workflow_run, input_data)

    def _execute_steps(self, workflow_run, input_data):
        """Run steps in order. Pause on await_confirmation. Record AgentStepExecution."""
        from .executors import get_executor
        from django.utils import timezone as tz

        steps = workflow_run.workflow_definition.steps.filter(
            order__gte=workflow_run.current_step_order, is_deleted=False,
        ).order_by('order')

        total_steps = workflow_run.workflow_definition.steps.filter(
            is_deleted=False
        ).count()
        current_data = input_data

        for step in steps:
            execution = AgentStepExecution.objects.create(
                workflow_run=workflow_run,
                step=step,
                step_order=step.order,
                step_name=step.name,
                status='running',
                input_data=current_data,
                started_at=tz.now(),
            )

            yield {
                'type': 'step_progress',
                'data': {
                    'step_order': step.order,
                    'step_name': step.name,
                    'step_type': step.step_type,
                    'status': 'running',
                    'total_steps': total_steps,
                },
            }

            executor = get_executor(step, workflow_run, self)
            result = executor.execute(current_data)

            if result.success:
                execution.status = 'completed'
                execution.output_data = result.output_data
                execution.completed_at = tz.now()
                execution.save()

                for event in result.sse_events:
                    yield event

                # Pause on await_confirmation
                if step.step_type == 'await_confirmation':
                    workflow_run.status = 'awaiting_confirmation'
                    workflow_run.current_step_order = step.order + 1
                    workflow_run.save()
                    return

                current_data = result.output_data or current_data
            else:
                execution.status = 'failed'
                execution.error_message = result.error
                execution.completed_at = tz.now()
                execution.save()

                workflow_run.status = 'failed'
                workflow_run.error_message = result.error
                workflow_run.save()

                yield {'type': 'error', 'content': result.error}
                return

        workflow_run.status = 'completed'
        workflow_run.save()

    def _resume_workflow(self, workflow_run, extra_input=None):
        """Resume a paused workflow from the last completed step's output.

        extra_input is merged into the input data before execution, allowing
        callers to inject user-provided values (e.g. confirmed column_mapping).
        """
        last_execution = workflow_run.step_executions.filter(
            status='completed'
        ).order_by('-step_order').first()

        input_data = last_execution.output_data if last_execution else {}
        if extra_input:
            input_data = {**input_data, **extra_input}
        yield from self._execute_steps(workflow_run, input_data)

    def _legacy_confirm(self, action, workflow_run):
        """Backward compat: confirm_decision / create_tasks for legacy runs."""
        if action == 'confirm_decision':
            if workflow_run and workflow_run.analysis_result:
                yield from self.create_decision_draft(
                    workflow_run.analysis_result, workflow_run
                )
            else:
                yield {"type": "error", "content": "No pending analysis to confirm."}
        elif action == 'create_tasks':
            if workflow_run and workflow_run.analysis_result:
                yield from self.create_tasks_from_analysis(workflow_run)
            else:
                yield {"type": "error", "content": "No analysis found to create tasks from."}
        elif action == 'generate_miro':
            if not workflow_run or not workflow_run.analysis_result:
                yield {"type": "error", "content": "No analysis found to generate a Miro board from."}
                return
            if getattr(workflow_run, "miro_board_id", None):
                logger.info(
                    "Generate Miro requested but board already exists for workflow_run=%s board=%s",
                    workflow_run.id,
                    workflow_run.miro_board_id,
                )
                yield {
                    "type": "text",
                    "content": f"Miro board already exists: {workflow_run.miro_board.title}",
                }
                return
            try:
                _enqueue_miro_generation_for_workflow_run(self, workflow_run)
                _create_agent_status_message(
                    self.session,
                    "Miro board generation started in background.",
                    event_type="miro_generation_started",
                    workflow_run_id=str(workflow_run.id),
                )
                yield {
                    "type": "miro_status",
                    "content": "Miro board generation started in background.",
                    "data": {"workflow_run_id": str(workflow_run.id), "status": "running"},
                }
            except Exception as e:
                logger.exception("Failed to enqueue legacy Miro generation for workflow_run=%s", workflow_run.id)
                yield {"type": "error", "content": f"Failed to start Miro generation: {e}"}

    def _legacy_handle(self, message, spreadsheet_id=None, csv_filename=None,
                       action=None, file_id=None):
        """Full legacy logic — preserves original handle_message behavior
        including the follow-up chat path."""
        if file_id:
            yield from self.analyze_file(file_id)
            yield {"type": "done"}
            return
        if action == 'analyze' and csv_filename:
            yield from self.analyze_csv(csv_filename)
        elif action == 'analyze' and spreadsheet_id:
            yield from self.analyze_spreadsheet(spreadsheet_id)
        elif action == 'confirm_decision':
            workflow_run = self.session.workflow_runs.filter(
                status='awaiting_confirmation'
            ).order_by('-created_at').first()
            if workflow_run and workflow_run.analysis_result:
                yield from self.create_decision_draft(
                    workflow_run.analysis_result, workflow_run
                )
            else:
                yield {"type": "error", "content": "No pending analysis to confirm."}
        elif action == 'create_tasks':
            workflow_run = self.session.workflow_runs.filter(
                analysis_result__isnull=False
            ).order_by('-created_at').first()
            if workflow_run and workflow_run.analysis_result:
                yield from self.create_tasks_from_analysis(workflow_run)
            else:
                yield {"type": "error", "content": "No analysis found to create tasks from."}
        else:
            # Follow-up chat path
            latest_run = self.session.workflow_runs.filter(
                status='awaiting_confirmation',
                chat_follow_up_started=True,
                chat_followed_up=False,
            ).order_by('-created_at').first()

            if latest_run:
                yield {"type": "text", "content": "Thinking..."}
                history = AgentMessage.objects.filter(
                    session=self.session
                ).order_by('created_at')
                chat_context = serialize_agent_messages(history)
                full_input = f"{chat_context}\n\n[user]: {message}"
                try:
                    from core.utils.bot_user import get_agent_bot_user

                    bot = get_agent_bot_user()
                    project_members = _serialize_project_members(
                        self.project,
                        excluded_users=[bot],
                    )
                    logger.info(
                        "Running agent follow-up chat for project=%s session=%s workflow_run=%s user=%s project_members=%s",
                        self.project.id,
                        self.session.id,
                        latest_run.id,
                        self.user.id,
                        len(project_members),
                    )
                    result = _call_dify_chat(
                        full_input,
                        user_id=self.user.id,
                        analysis_result=latest_run.analysis_result,
                        project_members=project_members,
                        current_username=self.user.username or '',
                    )
                    follow_up_status = result.get("status", "completed")
                    reply = result.get("text") or result.get("reply", "")
                    forwards = result.get("forwards", [])
                    close_follow_up = follow_up_status == 'completed' or bool(forwards)
                    logger.info(
                        "Agent follow-up chat completed for workflow_run=%s status=%s forwards=%s close_follow_up=%s",
                        latest_run.id,
                        follow_up_status,
                        len(forwards),
                        close_follow_up,
                    )

                    if close_follow_up:
                        latest_run.chat_followed_up = True
                        latest_run.save(update_fields=['chat_followed_up'])
                    yield {"type": "text", "content": reply}

                    if forwards:
                        fwd_results = _forward_to_users(forwards, self.user, self.project)
                        sent = [r["username"] for r in fwd_results if r["status"] == "sent"]
                        failed = [r["username"] for r in fwd_results if r["status"] != "sent"]
                        if sent:
                            yield {"type": "text", "content": f"Message forwarded to: {', '.join(sent)}"}
                        if failed:
                            yield {"type": "text", "content": f"Could not forward to: {', '.join(failed)}"}
                except Exception as e:
                    logger.error(f"Dify chat call failed: {e}")
                    yield {"type": "error", "content": str(e)}
            else:
                yield {
                    "type": "text",
                    "content": (
                        "I can help you analyze spreadsheet data and create decisions. "
                        "To get started, select a spreadsheet and use the 'analyze' action."
                    ),
                }
        yield {"type": "done"}
