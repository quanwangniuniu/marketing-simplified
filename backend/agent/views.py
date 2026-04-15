import json
import logging
import os

from django.conf import settings as django_settings
from django.db.models import Count, Max, Q
from django.http import StreamingHttpResponse
from django.utils.translation import activate as activate_language
from rest_framework import viewsets, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView


class EventStreamRenderer(BaseRenderer):
    """Renderer that accepts text/event-stream for SSE endpoints."""
    media_type = 'text/event-stream'
    format = 'event-stream'
    charset = 'utf-8'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        # Error responses (DRF Response) fall through here; serialize as JSON.
        if data is None:
            return b''
        return json.dumps(data).encode('utf-8')

from core.models import Project, ProjectMember
from decision.models import Decision
from spreadsheet.models import Spreadsheet
from .models import (
    AgentSession, AgentMessage, AgentWorkflowDefinition,
    AgentWorkflowStep, AgentWorkflowRun, AgentStepExecution,
)
from .serializers import (
    AgentSessionListSerializer,
    AgentSessionDetailSerializer,
    ChatInputSerializer,
    AgentWorkflowDefinitionListSerializer,
    AgentWorkflowDefinitionDetailSerializer,
    AgentWorkflowStepSerializer,
    AgentStepExecutionSerializer,
    AgentWorkflowRunSerializer,
    StepReorderSerializer,
)
from .services import AgentOrchestrator
from . import data_service

logger = logging.getLogger(__name__)


class EnglishResponseMixin:
    """Force English for DRF validation messages in all agent views."""
    def initial(self, request, *args, **kwargs):
        activate_language('en')
        super().initial(request, *args, **kwargs)


def _get_user_project(request):
    """Get the active project for the current user, with membership check."""
    project_id = request.headers.get('X-Project-Id') or request.query_params.get('project_id')
    if project_id:
        try:
            project = Project.objects.get(id=project_id, is_deleted=False)
            if not ProjectMember.objects.filter(project=project, user=request.user).exists():
                return None
            return project
        except Project.DoesNotExist:
            return None
    return getattr(request.user, 'active_project', None)


class AgentSessionViewSet(EnglishResponseMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'list':
            return AgentSessionListSerializer
        return AgentSessionDetailSerializer

    def get_queryset(self):
        project = _get_user_project(self.request)
        qs = AgentSession.objects.filter(
            user=self.request.user,
            is_deleted=False,
        )
        if project:
            qs = qs.filter(project=project)
        qs = qs.order_by('-created_at')
        if self.action == 'list':
            return qs[:50]
        return qs

    def perform_create(self, serializer):
        project = _get_user_project(self.request)
        if not project:
            project_id = self.request.data.get('project_id')
            if project_id:
                project = Project.objects.get(id=project_id, is_deleted=False)
        serializer.save(user=self.request.user, project=project)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


class ChatView(EnglishResponseMixin, APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [EventStreamRenderer, JSONRenderer]

    def post(self, request, session_id):
        serializer = ChatInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            session = AgentSession.objects.get(
                id=session_id,
                user=request.user,
                is_deleted=False,
            )
        except AgentSession.DoesNotExist:
            return Response(
                {"detail": "Session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        message_text = serializer.validated_data['message']
        spreadsheet_id = serializer.validated_data.get('spreadsheet_id')
        csv_filename = serializer.validated_data.get('csv_filename')
        file_id = serializer.validated_data.get('file_id')
        action = serializer.validated_data.get('action')
        calendar_context = serializer.validated_data.get('calendar_context')
        workflow_id = serializer.validated_data.get('workflow_id')
        column_mapping = serializer.validated_data.get('column_mapping')

        should_persist_user_message = action not in {
            'start_follow_up', 'cancel_follow_up',
            'confirm_decision', 'create_tasks', 'generate_miro',
            'distribute_message', 'confirm_columns',
        }

        # Auto-generate title from first real user message
        if should_persist_user_message and not session.title and message_text:
            session.title = message_text[:100]
            session.save(update_fields=['title'])

        if should_persist_user_message:
            AgentMessage.objects.create(
                session=session,
                role='user',
                content=message_text,
                metadata={
                    'spreadsheet_id': spreadsheet_id,
                    'action': action,
                },
            )

        project = session.project
        orchestrator = AgentOrchestrator(
            user=request.user,
            project=project,
            session=session,
        )

        def event_stream():
            assistant_content_parts = []
            assistant_metadata = {}
            last_message_type = 'text'
            standalone_message_types = {'miro_status', 'miro_suggestion'}

            def _flush_message():
                """Save accumulated content as an assistant message and reset state."""
                nonlocal assistant_content_parts, assistant_metadata, last_message_type
                body = '\n'.join(p for p in assistant_content_parts if p)
                if body:
                    AgentMessage.objects.create(
                        session=session,
                        role='assistant',
                        content=body,
                        message_type=last_message_type,
                        metadata=assistant_metadata,
                    )
                assistant_content_parts = []
                assistant_metadata = {}
                last_message_type = 'text'

            try:
                for chunk in orchestrator.handle_message(
                    message_text,
                    spreadsheet_id=spreadsheet_id,
                    csv_filename=csv_filename,
                    action=action,
                    file_id=file_id,
                    calendar_context=calendar_context,
                    workflow_id=workflow_id,
                    column_mapping=column_mapping,
                ):
                    chunk_type = chunk.get('type', 'text')
                    content = chunk.get('content', '')
                    data = chunk.get('data')

                    # Save calendar_invite as a separate message so it can be
                    # restored independently from the preceding calendar answer.
                    if chunk_type == 'calendar_invite':
                        _flush_message()
                        sse_data = json.dumps(chunk, default=str)
                        yield f"data: {sse_data}\n\n"
                        if content:
                            AgentMessage.objects.create(
                                session=session,
                                role='assistant',
                                content=content,
                                message_type='calendar_invite',
                                metadata={},
                            )
                        continue

                    # Skip internal signalling events from content accumulation
                    if chunk_type not in ('done', 'calendar_updated'):
                        if content:
                            assistant_content_parts.append(content)
                        last_message_type = chunk_type
                        if data:
                            assistant_metadata.update(data)

                    sse_data = json.dumps(chunk, default=str)
                    yield f"data: {sse_data}\n\n"

                    if chunk_type == 'done':
                        _flush_message()
            except Exception:
                logger.exception("Error during agent SSE stream")
                _flush_message()
                error_payload = json.dumps({
                    "type": "error",
                    "content": "An internal error occurred. Please try again.",
                })
                yield f"data: {error_payload}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"

        response = StreamingHttpResponse(
            event_stream(),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class SpreadsheetListView(EnglishResponseMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project = _get_user_project(request)
        if not project:
            return Response(
                {"detail": "No active project."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        spreadsheets = Spreadsheet.objects.filter(
            project=project,
            is_deleted=False,
        ).values('id', 'name', 'created_at').order_by('-created_at')
        result = [
            {**s, 'project_id': project.id, 'updated_at': s['created_at']}
            for s in spreadsheets
        ]
        return Response(result)



class DataReportListView(EnglishResponseMixin, APIView):
    """GET /api/agent/data/reports/ — list imported CSV files."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project = _get_user_project(request)
        if not project:
            return Response(
                {"detail": "No active project."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reports = data_service.list_reports(project)
        return Response(reports)


class DataReportDetailView(EnglishResponseMixin, APIView):
    """GET/DELETE /api/agent/data/reports/<uuid:file_id>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, file_id):
        project = _get_user_project(request)
        if not project:
            return Response(
                {"detail": "No active project."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = data_service.get_report_data(file_id, project)
        if data is None:
            return Response(
                {"detail": "Report not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(data)

    def delete(self, request, file_id):
        project = _get_user_project(request)
        if not project:
            return Response(
                {"detail": "No active project."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deleted = data_service.delete_report(file_id, project)
        if not deleted:
            return Response(
                {"detail": "File not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DataUploadView(EnglishResponseMixin, APIView):
    """POST /api/agent/data/upload/ — upload a CSV file."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        project = _get_user_project(request)
        if not project:
            return Response(
                {"detail": "No active project."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file = request.FILES.get('file')
        if not file:
            return Response(
                {"detail": "No file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_exts = ('.csv', '.xlsx', '.xls')
        if not file.name.lower().endswith(allowed_exts):
            return Response(
                {"detail": "Only CSV and Excel files are accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_size = 10 * 1024 * 1024  # 10MB
        if file.size > max_size:
            return Response(
                {"detail": "File too large (max 10MB)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = data_service.save_uploaded_file(file, request.user, project)
        if result is None:
            return Response(
                {"detail": "Failed to save file."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(result, status=status.HTTP_201_CREATED)


class FileUploadAnalyzeView(EnglishResponseMixin, APIView):
    """POST /api/agent/upload-analyze/ — upload a file and stream analysis."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    renderer_classes = [EventStreamRenderer, JSONRenderer]

    def post(self, request):
        project = _get_user_project(request)
        if not project:
            return Response(
                {"detail": "No active project."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file = request.FILES.get('file')
        if not file:
            return Response(
                {"detail": "No file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_exts = ('.csv', '.xlsx', '.xls')
        if not file.name.lower().endswith(allowed_exts):
            return Response(
                {"detail": "Only CSV and Excel files are accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_size = 10 * 1024 * 1024  # 10MB
        if file.size > max_size:
            return Response(
                {"detail": "File too large (max 10MB)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Save file
        result = data_service.save_uploaded_file(file, request.user, project)
        if result is None:
            return Response(
                {"detail": "Failed to save file."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Create or reuse session
        session_id = request.data.get('session_id')
        if session_id:
            try:
                session = AgentSession.objects.get(
                    id=session_id, user=request.user, is_deleted=False,
                )
            except AgentSession.DoesNotExist:
                session = AgentSession.objects.create(
                    user=request.user, project=project,
                    title=f"Analysis: {result['original_filename']}",
                )
        else:
            session = AgentSession.objects.create(
                user=request.user, project=project,
                title=f"Analysis: {result['original_filename']}",
            )

        orchestrator = AgentOrchestrator(
            user=request.user, project=project, session=session,
        )

        def event_stream():
            # Immediately emit file_uploaded event
            file_event = {
                "type": "file_uploaded",
                "content": f"Uploaded \"{result['original_filename']}\" ({result['row_count']} rows, {result['column_count']} columns).",
                "data": {
                    "file_id": result['id'],
                    "filename": result['filename'],
                    "original_filename": result['original_filename'],
                    "row_count": result['row_count'],
                    "column_count": result['column_count'],
                },
            }
            yield f"data: {json.dumps(file_event)}\n\n"

            # Route through the workflow engine (column detection + analysis).
            assistant_content_parts = []
            assistant_metadata = {"file_id": result['id']}
            last_message_type = 'text'

            try:
                for chunk in orchestrator.handle_message("", file_id=result['id']):
                    chunk_type = chunk.get('type', 'text')
                    content = chunk.get('content', '')
                    data = chunk.get('data')

                    if chunk_type == 'done':
                        # Intercept done event to attach session_id for the frontend.
                        break

                    if content:
                        assistant_content_parts.append(content)
                    last_message_type = chunk_type
                    if data:
                        assistant_metadata.update(data)

                    yield f"data: {json.dumps(chunk, default=str)}\n\n"
            except Exception:
                logger.exception("FileUploadAnalyzeView workflow error")
                yield f"data: {json.dumps({'type': 'error', 'content': 'An internal error occurred. Please try again.'})}\n\n"

            # Save accumulated assistant message
            if assistant_content_parts:
                AgentMessage.objects.create(
                    session=session,
                    role='assistant',
                    content='\n'.join(assistant_content_parts),
                    message_type=last_message_type,
                    metadata=assistant_metadata,
                )

            # Done event with session_id so the frontend can persist the session.
            done_event = {
                "type": "done",
                "data": {"session_id": str(session.id)},
            }
            yield f"data: {json.dumps(done_event)}\n\n"

        response = StreamingHttpResponse(
            event_stream(),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class DataReportSummaryView(EnglishResponseMixin, APIView):
    """GET /api/agent/data/reports/summary/ — aggregated KPI data."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project = _get_user_project(request)
        if not project:
            return Response(
                {"detail": "No active project."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        summary = data_service.get_reports_summary(project)
        if summary is None:
            return Response({"detail": "No data available."}, status=status.HTTP_200_OK)
        return Response(summary)


class DecisionStatsView(EnglishResponseMixin, APIView):
    """GET /api/agent/decisions/stats/ — Decision status counts."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project = _get_user_project(request)
        if not project:
            return Response(
                {"detail": "No active project."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = Decision.objects.filter(project=project, is_deleted=False, is_pre_draft=False)

        counts = qs.values('status').annotate(count=Count('id'))
        stats = {}
        for item in counts:
            stats[item['status'].lower()] = item['count']
        return Response(stats)


class DecisionRecentView(EnglishResponseMixin, APIView):
    """GET /api/agent/decisions/recent/ — latest 5 decisions."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project = _get_user_project(request)
        if not project:
            return Response(
                {"detail": "No active project."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = Decision.objects.filter(project=project, is_deleted=False)

        decisions = qs.order_by('-created_at')[:5]
        result = []
        for d in decisions:
            result.append({
                'id': d.id,
                'title': d.title or f'Decision #{d.project_seq}',
                'status': d.status.lower(),
                'risk_level': (d.risk_level or '').lower(),
                'confidence': d.confidence,
                'author': d.author.get_full_name() if d.author else 'AI Agent',
                'created_at': d.created_at.isoformat(),
                'is_pre_draft': d.is_pre_draft,
            })
        return Response(result)


class DecisionPromoteView(EnglishResponseMixin, APIView):
    """POST /api/agent/decisions/<id>/promote/ — promote a pre-draft to a real draft."""
    permission_classes = [IsAuthenticated]

    def post(self, request, decision_id):
        try:
            decision = Decision.objects.get(
                id=decision_id,
                is_deleted=False,
            )
        except Decision.DoesNotExist:
            return Response(
                {"detail": "Decision not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not ProjectMember.objects.filter(project=decision.project, user=request.user).exists():
            return Response(
                {"detail": "Permission denied."},
                status=status.HTTP_403_FORBIDDEN,
            )
        decision.is_pre_draft = False
        decision.save(update_fields=['is_pre_draft', 'updated_at'])
        return Response({
            'id': decision.id,
            'title': decision.title,
            'status': decision.status,
            'is_pre_draft': False,
        })


class AnomalyLatestView(EnglishResponseMixin, APIView):
    """GET /api/agent/anomalies/latest/ — latest anomalies from most recent analysis."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project = _get_user_project(request)
        if not project:
            return Response(
                {"detail": "No active project."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Find the most recent assistant message that has anomalies in metadata
        msg = (
            AgentMessage.objects
            .filter(
                session__project=project,
                session__user=request.user,
                role='assistant',
            )
            .filter(metadata__has_key='anomalies')
            .order_by('-created_at')
            .first()
        )
        if not msg or not msg.metadata.get('anomalies'):
            return Response([])
        return Response(msg.metadata['anomalies'])


class AgentWorkflowDefinitionViewSet(EnglishResponseMixin, viewsets.ModelViewSet):
    """CRUD for workflow definitions. Shows project-level + system-level workflows."""
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'list':
            return AgentWorkflowDefinitionListSerializer
        return AgentWorkflowDefinitionDetailSerializer

    def get_queryset(self):
        project = _get_user_project(self.request)
        qs = AgentWorkflowDefinition.objects.filter(is_deleted=False)
        if project:
            qs = qs.filter(Q(project=project) | Q(is_system=True))
        else:
            qs = qs.filter(is_system=True)
        return qs.order_by('-is_system', '-is_default', '-created_at')

    def perform_create(self, serializer):
        project = _get_user_project(self.request)
        serializer.save(
            project=project,
            created_by=self.request.user,
            is_system=False,
        )

    def perform_update(self, serializer):
        if serializer.instance.is_system:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("System workflows cannot be modified.")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_system:
            return Response(
                {"detail": "System workflows cannot be deleted."},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance.is_deleted = True
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _get_workflow_or_404(request, workflow_id):
    """Fetch workflow with project-level access check. Returns (workflow, error_response)."""
    try:
        workflow = AgentWorkflowDefinition.objects.get(
            id=workflow_id, is_deleted=False,
        )
    except AgentWorkflowDefinition.DoesNotExist:
        return None, Response(
            {"detail": "Workflow not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    # System workflows are visible to all authenticated users
    if not workflow.is_system:
        project = _get_user_project(request)
        if workflow.project != project:
            return None, Response(
                {"detail": "Workflow not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
    return workflow, None


class WorkflowStepView(EnglishResponseMixin, APIView):
    """GET list / POST add step for a workflow definition."""
    permission_classes = [IsAuthenticated]

    def get(self, request, workflow_id):
        workflow, err = _get_workflow_or_404(request, workflow_id)
        if err:
            return err
        steps = workflow.steps.filter(is_deleted=False).order_by('order')
        serializer = AgentWorkflowStepSerializer(steps, many=True)
        return Response(serializer.data)

    def post(self, request, workflow_id):
        workflow, err = _get_workflow_or_404(request, workflow_id)
        if err:
            return err
        if workflow.is_system:
            return Response(
                {"detail": "Cannot modify system workflow steps."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = AgentWorkflowStepSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Auto-assign order if not provided
        max_order = workflow.steps.filter(is_deleted=False).aggregate(
            max_order=Max('order')
        )['max_order'] or 0
        serializer.save(
            workflow=workflow,
            order=serializer.validated_data.get('order', max_order + 1),
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def delete(self, request, workflow_id):
        """Delete a step by step_id query param."""
        workflow, err = _get_workflow_or_404(request, workflow_id)
        if err:
            return err
        if workflow.is_system:
            return Response(
                {"detail": "Cannot modify system workflow steps."},
                status=status.HTTP_403_FORBIDDEN,
            )
        step_id = request.query_params.get('step_id')
        if not step_id:
            return Response(
                {"detail": "step_id query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            step = workflow.steps.get(id=step_id, is_deleted=False)
        except AgentWorkflowStep.DoesNotExist:
            return Response(
                {"detail": "Step not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        step.is_deleted = True
        step.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StepReorderView(EnglishResponseMixin, APIView):
    """POST reorder steps within a workflow."""
    permission_classes = [IsAuthenticated]

    def post(self, request, workflow_id):
        workflow, err = _get_workflow_or_404(request, workflow_id)
        if err:
            return err
        if workflow.is_system:
            return Response(
                {"detail": "Cannot modify system workflow steps."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = StepReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        step_ids = serializer.validated_data['step_ids']
        steps = workflow.steps.filter(
            id__in=step_ids, is_deleted=False,
        )
        if steps.count() != len(step_ids):
            return Response(
                {"detail": "Some step IDs are invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.db import transaction
        with transaction.atomic():
            # Use negative values to avoid unique_together conflict
            for idx, step_id in enumerate(step_ids):
                AgentWorkflowStep.objects.filter(id=step_id).update(order=-(idx + 1))
            for idx, step_id in enumerate(step_ids, start=1):
                AgentWorkflowStep.objects.filter(id=step_id).update(order=idx)

        updated_steps = workflow.steps.filter(is_deleted=False).order_by('order')
        return Response(
            AgentWorkflowStepSerializer(updated_steps, many=True).data,
        )


class WorkflowRunDetailView(EnglishResponseMixin, APIView):
    """GET execution detail for a workflow run, including step executions."""
    permission_classes = [IsAuthenticated]

    def get(self, request, run_id):
        try:
            run = AgentWorkflowRun.objects.get(
                id=run_id,
                session__user=request.user,
                is_deleted=False,
            )
        except AgentWorkflowRun.DoesNotExist:
            return Response(
                {"detail": "Workflow run not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        run_data = AgentWorkflowRunSerializer(run).data
        executions = run.step_executions.order_by('step_order')
        run_data['step_executions'] = AgentStepExecutionSerializer(
            executions, many=True,
        ).data
        return Response(run_data)


class AgentConfigStatusView(EnglishResponseMixin, APIView):
    """GET /api/agent/config/status/ — check which API keys are configured."""
    permission_classes = [IsAuthenticated]

    # Mapping of response key -> (settings attr, env var fallback)
    KEY_MAP = {
        'dify_api': ('DIFY_API_KEY', 'DIFY_API_KEY'),
        'dify_chat': ('DIFY_CHAT_API_KEY', 'DIFY_CHAT_API_KEY'),
        'dify_calendar': ('DIFY_CALENDAR_API_KEY', 'DIFY_CALENDAR_API_KEY'),
        'dify_miro': ('DIFY_MIRO_API_KEY', 'DIFY_MIRO_API_KEY'),
        'anthropic': ('ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY'),
    }

    def get(self, request):
        result = {}
        for key, (settings_attr, env_var) in self.KEY_MAP.items():
            val = getattr(django_settings, settings_attr, None) or os.environ.get(env_var, '')
            result[key] = bool(val and val.strip())
        return Response(result)
