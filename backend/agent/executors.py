"""
Step executors — strategy pattern for workflow step types.

Each step_type maps to an Executor subclass that encapsulates
the logic for that particular action.
"""
import logging
import requests as http_requests

logger = logging.getLogger(__name__)


class StepResult:
    """Unified return type for all executors."""

    def __init__(self, success, output_data=None, error=None, sse_events=None):
        self.success = success
        self.output_data = output_data
        self.error = error
        self.sse_events = sse_events or []


class BaseStepExecutor:
    """Base class — subclasses implement execute()."""

    def __init__(self, step, workflow_run, orchestrator):
        self.step = step
        self.workflow_run = workflow_run
        self.orchestrator = orchestrator
        self.config = step.config or {}

    def execute(self, input_data: dict) -> StepResult:
        raise NotImplementedError


class AnalyzeDataExecutor(BaseStepExecutor):
    """Runs the Dify->Claude analysis fallback chain via _run_analysis()."""

    def execute(self, input_data):
        from .services import _run_analysis

        spreadsheet_data = input_data.get('spreadsheet_data')
        if not spreadsheet_data:
            return StepResult(success=False, error='No spreadsheet_data in input')

        try:
            user_id = str(self.orchestrator.user.id)
            analysis = _run_analysis(spreadsheet_data, user_id=user_id)

            self.workflow_run.analysis_result = analysis
            self.workflow_run.save(update_fields=['analysis_result'])

            anomalies = analysis.get('anomalies', [])
            content = f"Found {len(anomalies)} anomalies in the data."

            return StepResult(
                success=True,
                output_data={
                    'analysis_result': analysis,
                    'spreadsheet_data': spreadsheet_data,
                },
                sse_events=[{
                    'type': 'analysis',
                    'content': content,
                    'data': analysis,
                }],
            )
        except Exception as e:
            logger.exception("AnalyzeDataExecutor failed")
            return StepResult(success=False, error=str(e))


class CallDifyExecutor(BaseStepExecutor):
    """Calls Dify API, supports per-step config override."""

    def execute(self, input_data):
        from .services import _call_dify, _get_dify_config

        spreadsheet_data = input_data.get('spreadsheet_data', input_data)
        try:
            user_id = str(self.orchestrator.user.id)

            if not _get_dify_config():
                return StepResult(success=False, error='No Dify API configured')

            result = _call_dify(spreadsheet_data, user_id=user_id)

            return StepResult(
                success=True,
                output_data={
                    'analysis_result': result,
                    'spreadsheet_data': spreadsheet_data,
                },
                sse_events=[{'type': 'text', 'content': 'Dify analysis completed.'}],
            )
        except Exception as e:
            logger.exception("CallDifyExecutor failed")
            return StepResult(success=False, error=str(e))


class CallLLMExecutor(BaseStepExecutor):
    """Calls Claude directly, supports per-step config override."""

    def execute(self, input_data):
        from .services import _call_llm, _get_llm_client

        spreadsheet_data = input_data.get('spreadsheet_data', input_data)
        try:
            client = _get_llm_client()
            if not client:
                return StepResult(success=False, error='No LLM API key configured')

            result = _call_llm(client, spreadsheet_data)

            return StepResult(
                success=True,
                output_data={
                    'analysis_result': result,
                    'spreadsheet_data': spreadsheet_data,
                },
                sse_events=[{'type': 'text', 'content': 'LLM analysis completed.'}],
            )
        except Exception as e:
            logger.exception("CallLLMExecutor failed")
            return StepResult(success=False, error=str(e))


class CreateDecisionExecutor(BaseStepExecutor):
    """Creates Decision + Signals + Options from analysis_result.

    Mirrors the logic in AgentOrchestrator.create_decision_draft().
    """

    def execute(self, input_data):
        from django.db.models import Max
        from decision.models import Decision, Signal, Option

        analysis = input_data.get('analysis_result')
        if not analysis:
            return StepResult(success=False, error='No analysis_result in input')

        try:
            suggested = analysis.get('suggested_decision', {})
            user = self.orchestrator.user
            project = self.orchestrator.project

            max_seq = Decision.objects.filter(
                project=project
            ).aggregate(max_seq=Max('project_seq'))['max_seq'] or 0

            decision = Decision.objects.create(
                title=suggested.get('title') or 'AI Agent Analysis',
                context_summary=suggested.get('context_summary', ''),
                reasoning=suggested.get('reasoning', ''),
                risk_level=suggested.get('risk_level', 'MEDIUM'),
                confidence=suggested.get('confidence', 3),
                status=Decision.Status.PREDRAFT,
                project=project,
                project_seq=max_seq + 1,
                author=user,
                created_by_agent=True,
                agent_session_id=self.orchestrator.session.id,
                is_pre_draft=True,
            )

            for anomaly in analysis.get('anomalies', []):
                Signal.objects.create(
                    decision=decision,
                    author=user,
                    metric=anomaly.get('metric', ''),
                    movement=anomaly.get('movement', ''),
                    period=anomaly.get('period', ''),
                    scope_type=anomaly.get('scope_type', ''),
                    scope_value=anomaly.get('scope_value', ''),
                    delta_value=anomaly.get('delta_value'),
                    delta_unit=anomaly.get('delta_unit', ''),
                    display_text=anomaly.get('description', ''),
                )

            options = suggested.get('options', [])
            for idx, opt in enumerate(options):
                Option.objects.create(
                    decision=decision,
                    text=opt.get('text', ''),
                    order=opt.get('order', idx),
                    is_selected=(idx == 0),
                )

            self.workflow_run.decision = decision
            self.workflow_run.save(update_fields=['decision'])

            return StepResult(
                success=True,
                output_data={**input_data, 'decision_id': decision.id},
                sse_events=[{
                    'type': 'decision_draft',
                    'content': f'Decision draft created: {decision.title}',
                    'data': {'decision_id': decision.id},
                }],
            )
        except Exception as e:
            logger.exception("CreateDecisionExecutor failed")
            return StepResult(success=False, error=str(e))


class CreateTasksExecutor(BaseStepExecutor):
    """Creates Tasks from analysis recommended_tasks.

    Mirrors the logic in AgentOrchestrator.create_tasks_from_analysis().
    """

    def execute(self, input_data):
        from django.contrib.contenttypes.models import ContentType
        from decision.models import Decision
        from task.models import Task

        analysis = input_data.get('analysis_result')
        if not analysis:
            return StepResult(success=False, error='No analysis_result in input')

        try:
            tasks_data = analysis.get('recommended_tasks', [])
            user = self.orchestrator.user
            project = self.orchestrator.project
            decision = self.workflow_run.decision

            if decision:
                decision_ct = ContentType.objects.get_for_model(Decision)
                link_kwargs = {
                    'content_type': decision_ct,
                    'object_id': str(decision.id),
                }
                desc_suffix = f" (Decision: {decision.title})"
            else:
                link_kwargs = {}
                desc_suffix = ""

            created_ids = []
            for task_data in tasks_data:
                summary = task_data.get('summary', 'AI Agent Generated Task')[:255]
                task = Task.objects.create(
                    summary=summary,
                    description=f"Auto-generated from AI analysis{desc_suffix}",
                    type=task_data.get('type', 'optimization'),
                    priority=task_data.get('priority', 'MEDIUM'),
                    project=project,
                    owner=user,
                    **link_kwargs,
                )
                created_ids.append(task.id)

            self.workflow_run.created_tasks = created_ids
            self.workflow_run.save(update_fields=['created_tasks'])

            return StepResult(
                success=True,
                output_data={**input_data, 'created_task_ids': created_ids},
                sse_events=[{
                    'type': 'task_created',
                    'content': f'Created {len(created_ids)} tasks.',
                    'data': {
                        'task_ids': created_ids,
                        'decision_id': decision.id if decision else None,
                    },
                }],
            )
        except Exception as e:
            logger.exception("CreateTasksExecutor failed")
            return StepResult(success=False, error=str(e))


class GenerateMiroSnapshotExecutor(BaseStepExecutor):
    """Generate a validated Miro snapshot from workflow context via Dify."""

    def execute(self, input_data):
        from .miro_generation import (
            build_miro_generation_context_from_run,
            call_dify_miro_generator,
        )

        try:
            context = build_miro_generation_context_from_run(
                session=self.orchestrator.session,
                workflow_run=self.workflow_run,
            )
            snapshot = call_dify_miro_generator(
                context,
                user_id=str(self.orchestrator.user.id),
            )

            self.workflow_run.miro_snapshot = snapshot
            self.workflow_run.save(update_fields=['miro_snapshot'])

            return StepResult(
                success=True,
                output_data={**input_data, 'miro_snapshot': snapshot},
                sse_events=[{
                    'type': 'miro_snapshot_generated',
                    'content': 'Generated Miro snapshot from workflow results.',
                    'data': {'item_count': len(snapshot.get('items', []))},
                }],
            )
        except Exception as e:
            logger.exception("GenerateMiroSnapshotExecutor failed")
            return StepResult(success=False, error=str(e))


class CreateMiroBoardExecutor(BaseStepExecutor):
    """Create a persisted Miro board from a validated snapshot."""

    def execute(self, input_data):
        from .miro_board_service import create_board_from_snapshot

        snapshot = input_data.get('miro_snapshot') or self.workflow_run.miro_snapshot
        if not snapshot:
            return StepResult(success=False, error='No miro_snapshot available for board creation')

        try:
            board, persisted_snapshot = create_board_from_snapshot(
                project=self.orchestrator.project,
                session=self.orchestrator.session,
                workflow_run=self.workflow_run,
                snapshot=snapshot,
            )

            self.workflow_run.miro_board = board
            self.workflow_run.miro_snapshot = persisted_snapshot
            self.workflow_run.save(update_fields=['miro_board', 'miro_snapshot'])

            return StepResult(
                success=True,
                output_data={
                    **input_data,
                    'miro_snapshot': persisted_snapshot,
                    'miro_board_id': str(board.id),
                },
                sse_events=[{
                    'type': 'miro_board_created',
                    'content': f'Miro board created: {board.title}',
                    'data': {'board_id': str(board.id)},
                }],
            )
        except Exception as e:
            logger.exception("CreateMiroBoardExecutor failed")
            return StepResult(success=False, error=str(e))


class AwaitConfirmationExecutor(BaseStepExecutor):
    """Pauses workflow and sends a confirmation_request SSE event."""

    def execute(self, input_data):
        message = self.config.get('message', 'Please confirm to continue.')
        return StepResult(
            success=True,
            output_data=input_data,
            sse_events=[{
                'type': 'confirmation_request',
                'content': message,
                'data': {'workflow_run_id': str(self.workflow_run.id)},
            }],
        )


class CustomAPIExecutor(BaseStepExecutor):
    """Configurable HTTP request to an external endpoint."""

    def execute(self, input_data):
        import json

        method = self.config.get('method', 'POST').upper()
        url = self.config.get('url')
        headers = self.config.get('headers', {})
        body_template = self.config.get('body_template')
        timeout = self.config.get('timeout', 30)

        if not url:
            return StepResult(success=False, error='No URL configured for custom API step')

        try:
            body = None
            if body_template:
                body = json.dumps(input_data) if body_template == '__input__' else body_template

            resp = http_requests.request(
                method, url, headers=headers, data=body, timeout=timeout,
            )
            resp.raise_for_status()

            return StepResult(
                success=True,
                output_data={**input_data, 'api_response': resp.json()},
                sse_events=[{
                    'type': 'text',
                    'content': f'Custom API call completed ({resp.status_code}).',
                }],
            )
        except Exception as e:
            logger.exception("CustomAPIExecutor failed")
            return StepResult(success=False, error=str(e))


class DetectColumnsExecutor(BaseStepExecutor):
    """Detect what each column in the uploaded spreadsheet represents.

    Runs rule-based matching first; falls back to LLM for unknown formats.
    Stores the detection result in output_data so the next step can use it.
    Also emits a column_mapping SSE event so the frontend can render a
    confirmation UI for the user to review or correct the mappings.
    """

    def execute(self, input_data):
        from .column_registry import detect_columns

        spreadsheet_data = input_data.get('spreadsheet_data')
        if not spreadsheet_data:
            return StepResult(success=False, error='No spreadsheet_data in input')

        try:
            # Collect headers and sample rows from the first sheet.
            headers = []
            sample_rows = []
            sheets = spreadsheet_data.get('sheets', [])
            if sheets:
                first_sheet = sheets[0]
                headers = first_sheet.get('columns', [])
                sample_rows = first_sheet.get('rows', [])[:3]

            detection = detect_columns(headers, sample_rows=sample_rows)
            detection_dict = detection.to_dict()

            return StepResult(
                success=True,
                output_data={
                    **input_data,
                    'column_detection': detection_dict,
                    # column_mapping starts as the detected mapping;
                    # the user may override it via confirm_columns.
                    'column_mapping': detection_dict['mappings'],
                },
                sse_events=[{
                    'type': 'column_mapping',
                    'content': (
                        f"Detected schema: {detection.schema_name} "
                        f"(confidence {detection.confidence:.0%}, source: {detection.source})"
                    ),
                    'data': detection_dict,
                }],
            )
        except Exception as e:
            logger.exception("DetectColumnsExecutor failed")
            return StepResult(success=False, error=str(e))


class NormalizeDataExecutor(BaseStepExecutor):
    """Rename spreadsheet columns using the approved column_mapping.

    Reads column_mapping from input_data (set by DetectColumnsExecutor or
    overridden by the user during the confirm_columns step).

    After normalisation, persists the confirmed schema to ImportedDataField and
    all row values to ImportedDataRecord so downstream queries never need to
    re-parse the source file or rely on hard-coded column names.
    """

    def execute(self, input_data):
        from .column_registry import normalize_spreadsheet

        spreadsheet_data = input_data.get('spreadsheet_data')
        column_mapping = input_data.get('column_mapping')

        if not spreadsheet_data:
            return StepResult(success=False, error='No spreadsheet_data in input')

        if not column_mapping:
            # No mapping provided — pass data through unchanged
            return StepResult(
                success=True,
                output_data=input_data,
                sse_events=[{
                    'type': 'text',
                    'content': 'No column mapping provided; using original column names.',
                }],
            )

        try:
            normalized = normalize_spreadsheet(spreadsheet_data, column_mapping)

            # Persist schema + row data to the metadata tables when a file_id is
            # available. Failures here are non-fatal: analysis can still proceed
            # using the in-memory normalized data.
            file_id = input_data.get('file_id')
            if file_id:
                try:
                    self._persist_metadata(
                        file_id=file_id,
                        column_mapping=column_mapping,
                        column_detection=input_data.get('column_detection', {}),
                        spreadsheet_data=spreadsheet_data,
                    )
                except Exception:
                    logger.exception(
                        "NormalizeDataExecutor: metadata persistence failed for file_id=%s "
                        "(non-fatal, analysis continues)",
                        file_id,
                    )

            return StepResult(
                success=True,
                output_data={
                    **input_data,
                    'spreadsheet_data': normalized,
                },
                sse_events=[{
                    'type': 'text',
                    'content': 'Column names normalized. Starting analysis...',
                }],
            )
        except Exception as e:
            logger.exception("NormalizeDataExecutor failed")
            return StepResult(success=False, error=str(e))

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _persist_metadata(self, file_id, column_mapping, column_detection, spreadsheet_data):
        """
        Save ImportedDataField and ImportedDataRecord rows for the confirmed mapping.

        Clears any existing rows for the file first so re-uploads always reflect
        the latest confirmation.
        """
        from .models import ImportedCSVFile, ImportedDataField, ImportedDataRecord, FieldCategory
        from .column_registry import auto_categorize_by_name, CAT_UNKNOWN

        try:
            csv_file = ImportedCSVFile.objects.get(id=file_id, is_deleted=False)
        except ImportedCSVFile.DoesNotExist:
            logger.warning("NormalizeDataExecutor: ImportedCSVFile %s not found", file_id)
            return

        # Clear existing metadata for this file (re-upload scenario)
        ImportedDataField.objects.filter(file=csv_file).delete()
        ImportedDataRecord.objects.filter(file=csv_file).delete()

        categories = column_detection.get('categories', {})
        confidences = column_detection.get('column_confidences', {})

        # Infer value types from the first sheet's rows
        sheets = spreadsheet_data.get('sheets', [])
        first_rows = sheets[0].get('rows', [])[:50] if sheets else []

        # Build ImportedDataField rows
        fields_to_create = []
        field_by_original = {}  # original_name -> ImportedDataField (to be created)

        for position, (original_name, canonical_name) in enumerate(column_mapping.items()):
            raw_category = categories.get(canonical_name, CAT_UNKNOWN)

            # Auto-categorise unknowns via keyword rules
            if raw_category == CAT_UNKNOWN:
                raw_category = auto_categorize_by_name(
                    original_name if canonical_name == CAT_UNKNOWN else canonical_name
                )

            # Ensure the category exists in FieldCategory (creates if new)
            FieldCategory.get_or_create_by_name(
                raw_category, project=csv_file.project
            )

            col_values = [
                row.get(original_name)
                for row in first_rows
                if row.get(original_name) not in (None, '', '-')
            ]
            value_type = _infer_value_type(col_values)
            stats = _compute_column_stats(
                [row.get(original_name) for row in first_rows],
                value_type,
            )

            field = ImportedDataField(
                file=csv_file,
                original_name=original_name,
                canonical_name=canonical_name,
                value_type=value_type,
                category=raw_category,
                confidence=round(confidences.get(original_name, 0.0), 3),
                position=position,
                null_count=stats['null_count'],
                unique_count=stats['unique_count'],
                min_value=stats['min_value'],
                max_value=stats['max_value'],
                sample_values=stats['sample_values'],
            )
            fields_to_create.append(field)
            field_by_original[original_name] = field

        created_fields = ImportedDataField.objects.bulk_create(fields_to_create)

        # Rebuild lookup after bulk_create assigns PKs
        field_pk_by_original = {f.original_name: f for f in created_fields}

        # Build ImportedDataRecord rows
        total_confirmed = len([
            f for f in created_fields if f.canonical_name != CAT_UNKNOWN
        ])

        records_to_create = []
        for row_index, row in enumerate(first_rows if not sheets else sheets[0].get('rows', [])):
            data_dict = {}
            non_null_confirmed = 0

            for original_name, canonical_name in column_mapping.items():
                key = canonical_name if canonical_name != CAT_UNKNOWN else original_name
                value = row.get(original_name)
                data_dict[key] = value
                if canonical_name != CAT_UNKNOWN and value not in (None, '', '-'):
                    non_null_confirmed += 1

            quality = non_null_confirmed / total_confirmed if total_confirmed else 1.0

            records_to_create.append(ImportedDataRecord(
                file=csv_file,
                row_index=row_index,
                data=data_dict,
                quality_score=round(quality, 3),
            ))

        # Bulk-insert in batches to avoid very large INSERT statements
        batch_size = 500
        for i in range(0, len(records_to_create), batch_size):
            ImportedDataRecord.objects.bulk_create(records_to_create[i:i + batch_size])

        logger.info(
            "NormalizeDataExecutor: persisted %d fields and %d records for file_id=%s",
            len(fields_to_create),
            len(records_to_create),
            file_id,
        )


# ---------------------------------------------------------------------------
# Column metadata helpers used by NormalizeDataExecutor
# ---------------------------------------------------------------------------

def _infer_value_type(values: list) -> str:
    """Infer the value_type ('number', 'boolean', 'string') from a sample of values."""
    non_null = [v for v in values if v not in (None, '', '-')]
    if not non_null:
        return 'string'

    num_count = 0
    bool_count = 0
    for v in non_null[:20]:
        sv = str(v).strip().lower()
        if sv in ('true', 'false', '1', '0', 'yes', 'no'):
            bool_count += 1
        else:
            try:
                float(str(v).replace(',', ''))
                num_count += 1
            except (ValueError, TypeError):
                pass

    sample_size = min(len(non_null), 20)
    if num_count / sample_size >= 0.8:
        return 'number'
    if bool_count / sample_size >= 0.8:
        return 'boolean'
    return 'string'


def _compute_column_stats(values: list, value_type: str) -> dict:
    """Compute null_count, unique_count, min/max, and sample_values for one column."""
    null_count = sum(1 for v in values if v in (None, '', '-'))
    non_null = [v for v in values if v not in (None, '', '-')]
    unique_count = len(set(str(v) for v in non_null))
    sample_values = list({str(v) for v in non_null if v is not None})[:5]

    min_value = None
    max_value = None
    if value_type == 'number' and non_null:
        try:
            nums = [float(str(v).replace(',', '')) for v in non_null]
            min_value = str(min(nums))
            max_value = str(max(nums))
        except (ValueError, TypeError):
            pass

    return {
        'null_count': null_count,
        'unique_count': unique_count,
        'min_value': min_value,
        'max_value': max_value,
        'sample_values': sample_values,
    }


# Executor registry — maps step_type to executor class
EXECUTOR_REGISTRY = {
    'analyze_data': AnalyzeDataExecutor,
    'call_dify': CallDifyExecutor,
    'call_llm': CallLLMExecutor,
    'create_decision': CreateDecisionExecutor,
    'create_tasks': CreateTasksExecutor,
    'generate_miro_snapshot': GenerateMiroSnapshotExecutor,
    'create_miro_board': CreateMiroBoardExecutor,
    'await_confirmation': AwaitConfirmationExecutor,
    'custom_api': CustomAPIExecutor,
    'detect_columns': DetectColumnsExecutor,
    'normalize_data': NormalizeDataExecutor,
}


def get_executor(step, workflow_run, orchestrator):
    """Look up and instantiate the executor for a given step."""
    executor_cls = EXECUTOR_REGISTRY.get(step.step_type)
    if not executor_cls:
        raise ValueError(f"Unknown step type: {step.step_type}")
    return executor_cls(step, workflow_run, orchestrator)
