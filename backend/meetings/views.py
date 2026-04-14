import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Project, ProjectMember
from meetings.lifecycle import execute_transition, get_available_transitions
from meetings.models import (
    Meeting,
    AgendaItem,
    ParticipantLink,
    ArtifactLink,
    MeetingTemplate,
    MeetingDocument,
    MeetingActionItem,
)
from meetings.serializers import (
    MeetingSerializer,
    MeetingListSerializer,
    MeetingKnowledgeDiscoveryQuerySerializer,
    AgendaItemSerializer,
    ParticipantLinkSerializer,
    ArtifactLinkSerializer,
    MeetingLifecycleSerializer,
    TransitionRequestSerializer,
    MeetingDocumentSerializer,
    MeetingActionItemSerializer,
    ActionItemConvertSerializer,
    BulkActionItemConvertSerializer,
)
from meetings.services import (
    reorder_agenda_items,
    get_or_create_meeting_document,
    update_meeting_document_content,
    user_has_meeting_document_access,
    meetings_base_queryset_for_project,
    apply_meeting_knowledge_filters,
    meeting_list_order_by_fields,
    hub_split_meeting_pks_for_project,
)


logger = logging.getLogger(__name__)

# Default workspace module order (matches frontend initial blocks).
DEFAULT_MEETING_LAYOUT = [
    {"id": "header", "type": "header"},
    {"id": "agenda", "type": "agenda"},
    {"id": "participants", "type": "participants"},
    {"id": "artifacts", "type": "artifacts"},
]

def _ensure_project_membership(user, project: Project) -> None:
    if not ProjectMember.objects.filter(
        user=user,
        project=project,
        is_active=True,
    ).exists():
        raise PermissionDenied("You do not have access to this project.")


def _ensure_meeting_document_access(user, meeting: Meeting) -> None:
    if user_has_meeting_document_access(user.id, meeting):
        return
    raise PermissionDenied("You do not have access to this meeting document.")


class MeetingViewSet(viewsets.ModelViewSet):
    serializer_class = MeetingSerializer
    permission_classes = [IsAuthenticated]

    def get_project(self) -> Project:
        project_id = self.kwargs.get("project_id")
        project = get_object_or_404(Project, id=project_id)
        _ensure_project_membership(self.request.user, project)
        return project

    def get_queryset(self):
        return meetings_base_queryset_for_project(self.get_project())

    def get_serializer_class(self):
        if self.action == "list":
            return MeetingListSerializer
        return MeetingSerializer

    def list(self, request, *args, **kwargs):
        project = self.get_project()
        query_serializer = MeetingKnowledgeDiscoveryQuerySerializer(
            data=request.query_params,
            context={"project": project, "request": request},
        )
        query_serializer.is_valid(raise_exception=True)
        filters = dict(query_serializer.validated_data)

        qs_base = meetings_base_queryset_for_project(project)

        incoming_pks, completed_pks = hub_split_meeting_pks_for_project(project)
        qs_incoming_lane = qs_base.filter(pk__in=incoming_pks).distinct()
        qs_completed_lane = qs_base.filter(pk__in=completed_pks).distinct()

        incoming_result_count = (
            apply_meeting_knowledge_filters(qs_incoming_lane, filters).distinct().count()
        )
        completed_result_count = (
            apply_meeting_knowledge_filters(qs_completed_lane, filters).distinct().count()
        )

        qs_filtered = apply_meeting_knowledge_filters(qs_base, filters).distinct()

        ordering = filters.get("ordering") or "-created_at"
        qs = qs_filtered.order_by(*meeting_list_order_by_fields(ordering))

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            paginated = self.get_paginated_response(serializer.data)
            # Build a plain dict so hub fields always appear in JSON (avoid mutating ReturnDict edge cases).
            hub = {
                "incoming_lane_total": len(incoming_pks),
                "incoming_result_count": incoming_result_count,
                "completed_lane_total": len(completed_pks),
                "completed_result_count": completed_result_count,
                # Deprecated aliases (same values as *_result_count); kept for older clients.
                "incoming_lane_filtered": incoming_result_count,
                "completed_lane_filtered": completed_result_count,
            }
            payload = {**dict(paginated.data), **hub}
            return Response(payload)

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        project = self.get_project()
        raw_ids = serializer.validated_data.pop("participant_user_ids", None)
        if raw_ids is None:
            participant_user_ids: list[int] = []
        else:
            participant_user_ids = list(dict.fromkeys(int(x) for x in raw_ids))

        # Strict mode used to require the client to send ids; create flow no longer asks
        # for participants on the form �?default to the creator so the meeting always has
        # at least one participant when the setting is enabled.
        if getattr(settings, "MEETINGS_REQUIRE_PARTICIPANTS_AT_CREATE", False):
            if len(participant_user_ids) < 1:
                participant_user_ids = [self.request.user.id]

        User = get_user_model()

        with transaction.atomic():
            meeting = serializer.save(project=project)

            if not participant_user_ids:
                return

            for uid in participant_user_ids:
                if not User.objects.filter(pk=uid).exists():
                    raise ValidationError(
                        {"participant_user_ids": [f"Unknown user id: {uid}."]}
                    )
                if not ProjectMember.objects.filter(
                    user_id=uid,
                    project=project,
                    is_active=True,
                ).exists():
                    raise ValidationError(
                        {
                            "participant_user_ids": [
                                f"User {uid} is not an active member of this project."
                            ]
                        }
                    )

            for uid in participant_user_ids:
                try:
                    ParticipantLink.objects.get_or_create(
                        meeting=meeting,
                        user_id=uid,
                        defaults={"role": None},
                    )
                except IntegrityError as exc:
                    raise ValidationError(
                        {
                            "participant_user_ids": [
                                "Could not attach participants; please retry."
                            ]
                        }
                    ) from exc

    def destroy(self, request, *args, **kwargs):
        """
        Deleting a meeting is blocked when it has converted action items, because
        tasks keep immutable lineage via Task.origin_action_item (PROTECT).
        Return a clear API error instead of a 500.
        """
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": "This meeting cannot be deleted because it has action items that were converted into tasks. Delete or unlink those tasks first."
                },
                status=status.HTTP_409_CONFLICT,
            )

    @action(detail=True, methods=["get"], url_path="tasks")
    def meeting_tasks(self, request, project_id=None, pk=None):
        """Tasks anchored to this meeting via ``MeetingTaskOrigin`` (paginated)."""
        meeting = self.get_object()
        _ensure_project_membership(request.user, meeting.project)
        from meetings.models import MeetingTaskOrigin
        from task.models import Task
        from task.serializers import TaskListSerializer

        task_ids = MeetingTaskOrigin.objects.filter(meeting=meeting).values_list(
            "task_id", flat=True
        )
        qs = (
            Task.objects.filter(id__in=task_ids, project_id=meeting.project_id)
            .select_related("owner", "project")
            .order_by("-id")
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = TaskListSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(ser.data)
        ser = TaskListSerializer(qs, many=True, context={"request": request})
        return Response(ser.data)

    @action(detail=True, methods=["get"], url_path="lifecycle")
    def lifecycle(self, request, project_id=None, pk=None):
        """Return current lifecycle state and available transitions."""
        meeting = self.get_object()
        data = {
            "status": meeting.status,
            "available_transitions": get_available_transitions(meeting),
        }
        serializer = MeetingLifecycleSerializer(data)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="lifecycle/transition")
    def transition(self, request, project_id=None, pk=None):
        """Execute a lifecycle transition."""
        meeting = self.get_object()
        serializer = TransitionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = execute_transition(meeting, serializer.validated_data["to_state"])
        return Response(
            {
                "status": updated.status,
                "available_transitions": get_available_transitions(updated),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="lifecycle")
    def lifecycle(self, request, project_id=None, pk=None):
        """Return current lifecycle state and available transitions."""
        meeting = self.get_object()
        data = {
            "status": meeting.status,
            "available_transitions": get_available_transitions(meeting),
        }
        serializer = MeetingLifecycleSerializer(data)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="lifecycle/transition")
    def transition(self, request, project_id=None, pk=None):
        """Execute a lifecycle transition."""
        meeting = self.get_object()
        serializer = TransitionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = execute_transition(meeting, serializer.validated_data["to_state"])
        return Response(
            {
                "status": updated.status,
                "available_transitions": get_available_transitions(updated),
            },
            status=status.HTTP_200_OK,
        )


class AgendaItemViewSet(viewsets.ModelViewSet):
    serializer_class = AgendaItemSerializer
    permission_classes = [IsAuthenticated]

    def get_meeting(self) -> Meeting:
        project_id = self.kwargs.get("project_id")
        meeting_id = self.kwargs.get("meeting_id")
        meeting = get_object_or_404(
            Meeting.objects.select_related("project"),
            id=meeting_id,
            project_id=project_id,
        )
        _ensure_project_membership(self.request.user, meeting.project)
        return meeting

    def get_queryset(self):
        meeting = self.get_meeting()
        return meeting.agenda_items.all().order_by("order_index", "id")

    def perform_create(self, serializer):
        meeting = self.get_meeting()
        try:
            serializer.save(meeting=meeting)
        except IntegrityError:
            from rest_framework.exceptions import ValidationError

            raise ValidationError(
                {"order_index": ["This order_index is already used for this meeting."]}
            )

    @action(detail=False, methods=["patch"], url_path="reorder")
    def reorder(self, request, project_id=None, meeting_id=None):
        meeting = self.get_meeting()
        items = request.data.get("items", [])
        if not isinstance(items, list):
            return Response(
                {"items": ["This field must be a list of objects."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized = []
        for item in items:
            try:
                normalized.append(
                    {
                        "id": int(item["id"]),
                        "order_index": int(item["order_index"]),
                    }
                )
            except (KeyError, TypeError, ValueError):
                return Response(
                    {
                        "items": [
                            "Each item must contain integer 'id' and 'order_index'."
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        updated_items = reorder_agenda_items(meeting.id, normalized)
        serializer = self.get_serializer(updated_items, many=True)
        return Response(serializer.data)


class ParticipantLinkViewSet(viewsets.ModelViewSet):
    serializer_class = ParticipantLinkSerializer
    permission_classes = [IsAuthenticated]

    def get_meeting(self) -> Meeting:
        project_id = self.kwargs.get("project_id")
        meeting_id = self.kwargs.get("meeting_id")
        meeting = get_object_or_404(
            Meeting.objects.select_related("project"),
            id=meeting_id,
            project_id=project_id,
        )
        _ensure_project_membership(self.request.user, meeting.project)
        return meeting

    def get_queryset(self):
        meeting = self.get_meeting()
        return meeting.participant_links.all()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action in {"create", "update", "partial_update"}:
            context["meeting"] = self.get_meeting()
        return context

    def perform_create(self, serializer):
        meeting = self.get_meeting()
        serializer.save(meeting=meeting)


class ActionItemViewSet(viewsets.ModelViewSet):
    serializer_class = MeetingActionItemSerializer 
    permission_classes = [IsAuthenticated]

    def get_meeting(self) -> Meeting:
        project_id = self.kwargs.get("project_id")
        meeting_id = self.kwargs.get("meeting_id")
        meeting = get_object_or_404(
            Meeting.objects.select_related("project"),
            id=meeting_id,
            project_id=project_id,
        )
        _ensure_project_membership(self.request.user, meeting.project)
        return meeting

    def get_queryset(self):
        meeting = self.get_meeting()
        return meeting.action_items.all().order_by("id")

    def perform_create(self, serializer):
        meeting = self.get_meeting()
        serializer.save(meeting=meeting)


class ArtifactLinkViewSet(viewsets.ModelViewSet):
    serializer_class = ArtifactLinkSerializer
    permission_classes = [IsAuthenticated]

    def get_meeting(self) -> Meeting:
        project_id = self.kwargs.get("project_id")
        meeting_id = self.kwargs.get("meeting_id")
        meeting = get_object_or_404(
            Meeting.objects.select_related("project"),
            id=meeting_id,
            project_id=project_id,
        )
        _ensure_project_membership(self.request.user, meeting.project)
        return meeting

    def get_queryset(self):
        meeting = self.get_meeting()
        return meeting.artifact_links.all()

    def perform_create(self, serializer):
        meeting = self.get_meeting()
        serializer.save(meeting=meeting)


class MeetingActionItemViewSet(viewsets.ModelViewSet):
    """
    Meeting follow-up action items and conversion to executable tasks (SMP-489).
    """

    serializer_class = MeetingActionItemSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_meeting(self) -> Meeting:
        project_id = self.kwargs.get("project_id")
        meeting_id = self.kwargs.get("meeting_id")
        meeting = get_object_or_404(
            Meeting.objects.select_related("project"),
            id=meeting_id,
            project_id=project_id,
        )
        _ensure_project_membership(self.request.user, meeting.project)
        return meeting

    def get_queryset(self):
        meeting = self.get_meeting()
        return meeting.action_items.all().order_by("order_index", "id")

    def perform_create(self, serializer):
        meeting = self.get_meeting()
        serializer.save(meeting=meeting)

    @action(detail=True, methods=["post"], url_path="convert-to-task")
    def convert_to_task(self, request, project_id=None, meeting_id=None, pk=None):
        from meetings.action_item_tasks import convert_meeting_action_item_to_task
        from task.serializers import TaskSerializer

        meeting = self.get_meeting()
        action_item = get_object_or_404(
            MeetingActionItem,
            pk=pk,
            meeting_id=meeting.id,
        )
        sz = ActionItemConvertSerializer(data=request.data)
        sz.is_valid(raise_exception=True)
        vd = sz.validated_data
        task = convert_meeting_action_item_to_task(
            user=request.user,
            meeting=meeting,
            action_item=action_item,
            owner_id=vd.get("owner_id"),
            due_date=vd.get("due_date"),
            priority=vd.get("priority"),
            task_type=vd.get("type", "execution"),
            current_approver_id=vd.get("current_approver_id"),
            create_as_draft=vd.get("create_as_draft", False),
        )
        return Response(
            TaskSerializer(task, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="bulk-convert-to-task")
    def bulk_convert_to_task(self, request, project_id=None, meeting_id=None):
        from meetings.action_item_tasks import bulk_convert_meeting_action_items
        from task.serializers import TaskSerializer

        meeting = self.get_meeting()
        sz = BulkActionItemConvertSerializer(data=request.data)
        sz.is_valid(raise_exception=True)
        items = [dict(x) for x in sz.validated_data["items"]]
        tasks = bulk_convert_meeting_action_items(
            user=request.user,
            meeting=meeting,
            items=items,
        )
        data = TaskSerializer(tasks, many=True, context={"request": request}).data
        return Response({"tasks": data}, status=status.HTTP_201_CREATED)

    # Backwards-compat / typo-tolerance: some clients hit ".../bulk-convert-to-tasks/" (plural).
    @action(detail=False, methods=["post"], url_path="bulk-convert-to-tasks")
    def bulk_convert_to_tasks(self, request, project_id=None, meeting_id=None):
        return self.bulk_convert_to_task(request, project_id=project_id, meeting_id=meeting_id)


class MeetingDocumentAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_meeting(self, project_id: int, meeting_id: int) -> Meeting:
        meeting = get_object_or_404(
            Meeting.objects.select_related("project"),
            id=meeting_id,
            project_id=project_id,
        )
        _ensure_meeting_document_access(self.request.user, meeting)
        return meeting

    def get(self, request, project_id: int, meeting_id: int):
        meeting = self._get_meeting(project_id, meeting_id)
        document = get_or_create_meeting_document(meeting.id)
        serializer = MeetingDocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, project_id: int, meeting_id: int):
        meeting = self._get_meeting(project_id, meeting_id)
        content = request.data.get("content")
        if not isinstance(content, str):
            raise ValidationError({"content": ["This field is required and must be a string."]})
        yjs_state = request.data.get("yjs_state")
        if yjs_state is not None and not isinstance(yjs_state, str):
            raise ValidationError({"yjs_state": ["This field must be a string."]})
        document = update_meeting_document_content(
            meeting_id=meeting.id,
            content=content,
            yjs_state=yjs_state,
            user_id=request.user.id,
        )
        serializer = MeetingDocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_200_OK)

