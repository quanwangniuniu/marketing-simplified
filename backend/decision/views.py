from django.db import IntegrityError, transaction
from django.db.models import Max, Q
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from core.models import Project, ProjectMember
from meetings.models import MeetingDecisionOrigin
from .models import CommitRecord, Decision, DecisionEdge, Review, Signal
from calendars.models import CalendarEvent
from .permissions import DecisionPermission
from decision.services import invalid_state_response, validate_decision_edge
from .serializers import (
    CreateReviewSerializer,
    CommittedReviewSerializer,
    DecisionApproveActionSerializer,
    DecisionArchiveActionSerializer,
    DecisionCommitActionSerializer,
    DecisionCommittedSerializer,
    DecisionConnectionsUpdateSerializer,
    DecisionDraftSerializer,
    DecisionListSerializer,
    SignalCreateUpdateSerializer,
    SignalResponseSerializer,
)


class DecisionDraftViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [DecisionPermission]
    http_method_names = ["get", "post", "patch"]
    serializer_class = DecisionDraftSerializer

    def get_queryset(self):
        qs = Decision.objects.filter(is_deleted=False).select_related(
            "meeting_origin__meeting__type_definition",
        )
        raw = self.request.headers.get("x-project-id") or self.request.query_params.get(
            "project_id"
        )
        try:
            pid = int(raw)
            qs = qs.filter(project_id=pid)
        except (TypeError, ValueError):
            pass
        return qs

    def _apply_parent_edges(self, decision, parent_ids):
        if parent_ids is None:
            return
        if decision.project_id is None:
            raise ValidationError({"parentDecisionIds": "Decision must belong to a project."})

        parent_ids = list(parent_ids)
        if len(parent_ids) != len(set(parent_ids)):
            raise ValidationError({"parentDecisionIds": "Duplicate parent decision ids are not allowed."})

        parents = list(
            Decision.objects.filter(pk__in=parent_ids, is_deleted=False)
        )
        if len(parents) != len(parent_ids):
            raise ValidationError({"parentDecisionIds": "One or more parent decisions not found."})

        for parent in parents:
            if parent.project_id != decision.project_id:
                raise ValidationError({"parentDecisionIds": "Parent decisions must belong to the same project."})

        existing_ids = set(
            DecisionEdge.objects.filter(to_decision=decision).values_list("from_decision_id", flat=True)
        )
        new_ids = set(parent_ids)
        to_remove = existing_ids - new_ids
        if to_remove:
            DecisionEdge.objects.filter(
                to_decision=decision, from_decision_id__in=to_remove
            ).delete()

        to_add = new_ids - existing_ids
        parents_by_id = {parent.id: parent for parent in parents}
        for parent_id in to_add:
            parent = parents_by_id[parent_id]
            validate_decision_edge(parent, decision)
            DecisionEdge.objects.create(
                from_decision=parent,
                to_decision=decision,
                created_by=self.request.user,
            )

    def perform_create(self, serializer):
        raw_project_id = self.request.headers.get("x-project-id") or self.request.query_params.get(
            "project_id"
        )
        try:
            project_id = int(raw_project_id)
        except (TypeError, ValueError):
            raise ValidationError({"project_id": "Project context is required."})

        project = Project.objects.filter(pk=project_id).first()
        if not project:
            raise ValidationError({"project_id": "Invalid project."})

        parent_ids = serializer.validated_data.pop("parentDecisionIds", None)
        origin_meeting_id = serializer.validated_data.pop("origin_meeting_id", None)
        with transaction.atomic():
            project = Project.objects.select_for_update().get(pk=project_id)
            max_seq = (
                Decision.objects.filter(project=project)
                .aggregate(max_seq=Max("project_seq"))
                .get("max_seq")
            )
            next_seq = (max_seq or 0) + 1
            decision = serializer.save(
                author=self.request.user,
                last_edited_by=self.request.user,
                project=project,
                project_seq=next_seq,
            )
            if origin_meeting_id is not None:
                MeetingDecisionOrigin.objects.create(
                    meeting_id=origin_meeting_id,
                    decision=decision,
                )
            self._apply_parent_edges(decision, parent_ids)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            self.perform_create(serializer)
        except ValidationError as exc:
            return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def _ensure_editable(self, decision):
        if decision.status not in (
            Decision.Status.PREDRAFT,
            Decision.Status.DRAFT,
            Decision.Status.AWAITING_APPROVAL,
        ):
            return invalid_state_response(
                current_status=decision.status,
                allowed_statuses=[
                    Decision.Status.PREDRAFT,
                    Decision.Status.DRAFT,
                    Decision.Status.AWAITING_APPROVAL,
                ],
                suggested_action="Use GET /api/decisions/{id}/ for read-only view.",
            )
        return None

    def perform_update(self, serializer):
        instance = serializer.save(last_edited_by=self.request.user)
        # Auto-promote PREDRAFT to DRAFT when user explicitly saves
        if instance.status == Decision.Status.PREDRAFT:
            instance.promote_to_draft()
            instance.is_pre_draft = False
            instance.save()

    def retrieve(self, request, *args, **kwargs):
        decision = self.get_object()
        invalid_response = self._ensure_editable(decision)
        if invalid_response:
            return invalid_response
        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        decision = self.get_object()
        invalid_response = self._ensure_editable(decision)
        if invalid_response:
            return invalid_response
        serializer = self.get_serializer(decision, data=request.data)
        serializer.is_valid(raise_exception=True)
        parent_ids = serializer.validated_data.pop("parentDecisionIds", None)
        try:
            with transaction.atomic():
                self.perform_update(serializer)
                self._apply_parent_edges(decision, parent_ids)
        except ValidationError as exc:
            return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        decision = self.get_object()
        invalid_response = self._ensure_editable(decision)
        if invalid_response:
            return invalid_response
        serializer = self.get_serializer(decision, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        parent_ids = serializer.validated_data.pop("parentDecisionIds", None)
        try:
            with transaction.atomic():
                self.perform_update(serializer)
                self._apply_parent_edges(decision, parent_ids)
        except ValidationError as exc:
            return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data)


class DecisionViewSet(
    mixins.DestroyModelMixin,
    viewsets.ReadOnlyModelViewSet,
):
    permission_classes = [DecisionPermission]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        base = (
            Decision.objects.filter(is_deleted=False)
            .select_related(
                "project",
                "meeting_origin__meeting__type_definition",
            )
            .order_by("-updated_at")
        )

        if self.action == "list":
            if not self.request.user.is_superuser:
                project_ids = ProjectMember.objects.filter(
                    user=self.request.user, is_active=True
                ).values_list("project_id", flat=True)
                base = base.filter(project_id__in=project_ids)
            visibility = Q(
                status__in=[
                    Decision.Status.AWAITING_APPROVAL,
                    Decision.Status.COMMITTED,
                    Decision.Status.REVIEWED,
                    Decision.Status.ARCHIVED,
                ]
            ) | Q(status=Decision.Status.DRAFT, author=self.request.user)
            base = base.filter(visibility)

            status_q = self.request.query_params.get("status")
            if status_q in Decision.Status.values:
                base = base.filter(status=status_q)

            return base

        raw = self.request.headers.get("x-project-id") or self.request.query_params.get(
            "project_id"
        )
        try:
            pid = int(raw)
            base = base.filter(project_id=pid)
        except (TypeError, ValueError):
            pass

        status_q = self.request.query_params.get("status")
        if status_q in Decision.Status.values:
            base = base.filter(status=status_q)

        return base

    def retrieve(self, request, *args, **kwargs):
        decision = self.get_object()
        # Allow viewing decisions in all statuses - the original logic was preventing 
        # users from viewing and deleting draft decisions from the calendar interface
        
        serializer = self.get_serializer(decision)
        return Response(serializer.data)

    def get_serializer_class(self):
        if self.action == 'list':
            return DecisionListSerializer
        if self.action == 'retrieve':
            return DecisionCommittedSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return DecisionDraftSerializer
        return DecisionDraftSerializer

    def list(self, request, *args, **kwargs):
        try:
            page_size = int(request.query_params.get("pageSize", 20))
        except (TypeError, ValueError):
            page_size = 20
        page_size = max(1, min(page_size, 100))

        page_token = request.query_params.get("pageToken", "0")
        try:
            offset = int(page_token)
        except (TypeError, ValueError):
            offset = 0

        qs = self.get_queryset()
        page = list(qs[offset : offset + page_size + 1])
        items = self.get_serializer(page[:page_size], many=True).data
        next_page_token = str(offset + page_size) if len(page) > page_size else None

        return Response({"items": items, "nextPageToken": next_page_token})

    def _build_connections_payload(self, decision):
        edges = DecisionEdge.objects.filter(
            Q(from_decision=decision) | Q(to_decision=decision),
            from_decision__project_id=decision.project_id,
            to_decision__project_id=decision.project_id,
        ).select_related("from_decision", "to_decision")
        connected = {}
        edge_list = []
        for edge in edges:
            if edge.from_decision_id == decision.id:
                other = edge.to_decision
            else:
                other = edge.from_decision
            connected[other.id] = {
                "id": other.id,
                "project_seq": other.project_seq,
                "title": other.title,
            }
            edge_list.append(
                {
                    "from_seq": edge.from_decision.project_seq,
                    "to_seq": edge.to_decision.project_seq,
                }
            )
        connected_list = sorted(
            connected.values(), key=lambda item: (item["project_seq"], item["id"])
        )
        return {
            "self": {"id": decision.id, "project_seq": decision.project_seq},
            "connected": connected_list,
            "edges": edge_list,
        }

    def _has_path(self, adjacency, start_id, target_id):
        if start_id == target_id:
            return True
        visited = set()
        stack = [start_id]
        while stack:
            current = stack.pop()
            if current in visited:
                continue
            visited.add(current)
            if current == target_id:
                return True
            for child in adjacency.get(current, set()):
                if child not in visited:
                    stack.append(child)
        return False

    @action(detail=True, methods=['get', 'put'], url_path='connections')
    def connections(self, request, pk=None):
        decision = (
            Decision.objects.filter(pk=pk, is_deleted=False)
            .select_related("project")
            .first()
        )
        if not decision:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if decision.project_id is None:
            return Response(
                {"detail": "Decision must belong to a project."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.method == "GET":
            return Response(self._build_connections_payload(decision))

        serializer = DecisionConnectionsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        requested_seqs = list(serializer.validated_data.get("connectedDecisionSeqs") or [])

        if len(requested_seqs) != len(set(requested_seqs)):
            return Response(
                {"detail": "Duplicate connectedDecisionSeqs are not allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requested_seqs = [seq for seq in requested_seqs if seq != decision.project_seq]

        targets = list(
            Decision.objects.filter(
                project_id=decision.project_id,
                project_seq__in=requested_seqs,
                is_deleted=False,
            )
        )
        if len(targets) != len(requested_seqs):
            return Response(
                {"detail": "One or more connectedDecisionSeqs are invalid for this project."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        desired_pairs = set()
        for target in targets:
            if target.project_seq < decision.project_seq:
                desired_pairs.add((target.id, decision.id))
            else:
                desired_pairs.add((decision.id, target.id))

        existing_edges = list(
            DecisionEdge.objects.filter(
                Q(from_decision=decision) | Q(to_decision=decision),
                from_decision__project_id=decision.project_id,
                to_decision__project_id=decision.project_id,
            )
        )
        existing_pairs = {(edge.from_decision_id, edge.to_decision_id): edge for edge in existing_edges}

        edges_to_delete = [
            edge for pair, edge in existing_pairs.items() if pair not in desired_pairs
        ]
        edges_to_add = [pair for pair in desired_pairs if pair not in existing_pairs]

        base_edges = DecisionEdge.objects.filter(
            from_decision__project_id=decision.project_id,
            to_decision__project_id=decision.project_id,
        )
        if edges_to_delete:
            base_edges = base_edges.exclude(pk__in=[edge.pk for edge in edges_to_delete])

        adjacency = {}
        for edge in base_edges:
            adjacency.setdefault(edge.from_decision_id, set()).add(edge.to_decision_id)

        for from_id, to_id in edges_to_add:
            if self._has_path(adjacency, to_id, from_id):
                return Response(
                    {"detail": "Cycle detected. Connections must remain acyclic."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            adjacency.setdefault(from_id, set()).add(to_id)

        try:
            with transaction.atomic():
                if edges_to_delete:
                    DecisionEdge.objects.filter(pk__in=[edge.pk for edge in edges_to_delete]).delete()
                for from_id, to_id in edges_to_add:
                    DecisionEdge.objects.create(
                        from_decision_id=from_id,
                        to_decision_id=to_id,
                        created_by=request.user,
                    )
        except IntegrityError:
            return Response(
                {"detail": "Duplicate edge detected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(self._build_connections_payload(decision))

    def _ensure_signal_editable(self, decision, request):
        if decision.status != Decision.Status.DRAFT:
            return invalid_state_response(
                current_status=decision.status,
                allowed_statuses=[Decision.Status.DRAFT],
                suggested_action="Signals are read-only after commit.",
            )
        if decision.author_id != request.user.id:
            return Response(
                {"detail": "Only the decision creator can modify signals."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    @action(detail=True, methods=['get', 'post'], url_path='signals')
    def signals(self, request, pk=None):
        decision = self.get_object()
        if request.method == 'GET':
            serializer = SignalResponseSerializer(decision.signals.all(), many=True)
            return Response({"items": serializer.data}, status=status.HTTP_200_OK)

        invalid = self._ensure_signal_editable(decision, request)
        if invalid:
            return invalid

        serializer = SignalCreateUpdateSerializer(
            data=request.data,
            context={"decision": decision, "author": request.user},
        )
        serializer.is_valid(raise_exception=True)
        signal = serializer.save()
        response_serializer = SignalResponseSerializer(signal)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path='signals/(?P<signal_id>[^/.]+)')
    def signal_detail(self, request, pk=None, signal_id=None):
        decision = self.get_object()
        try:
            signal = decision.signals.get(pk=signal_id)
        except Signal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        invalid = self._ensure_signal_editable(decision, request)
        if invalid:
            return invalid

        if request.method == 'DELETE':
            signal.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = SignalCreateUpdateSerializer(
            signal,
            data=request.data,
            partial=True,
            context={"decision": decision, "author": request.user},
        )
        serializer.is_valid(raise_exception=True)
        signal = serializer.save()
        response_serializer = SignalResponseSerializer(signal)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def _record_transition(
        self,
        decision,
        from_status,
        to_status,
        user,
        method,
        note=None,
        metadata=None,
    ):
        decision.state_transitions.create(
            from_status=from_status,
            to_status=to_status,
            triggered_by=user,
            transition_method=method,
            note=note,
            metadata=metadata,
        )

    def _upsert_commit_record(self, decision, user, snapshot):
        defaults = {
            "committed_by": user,
            "validation_snapshot": snapshot,
        }
        committed_at_field = CommitRecord._meta.get_field("committed_at")
        if not committed_at_field.auto_now_add:
            defaults["committed_at"] = timezone.now()

        CommitRecord.objects.update_or_create(
            decision=decision,
            defaults=defaults,
        )

    @action(detail=True, methods=['post'])
    def commit(self, request, pk=None):
        decision = self.get_object()
        if decision.status not in (Decision.Status.PREDRAFT, Decision.Status.DRAFT):
            return invalid_state_response(
                current_status=decision.status,
                allowed_statuses=[Decision.Status.PREDRAFT, Decision.Status.DRAFT],
                suggested_action=(
                    "Update the draft via PATCH /decisions/drafts/{decisionId} before committing."
                ),
            )

        serializer = DecisionCommitActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        metadata = serializer.validated_data.get("metadata") or {}
        snapshot = serializer.validated_data.get("validation_snapshot")
        with transaction.atomic():
            decision = Decision.objects.select_for_update().get(pk=decision.pk)
            try:
                decision.validate_can_commit()
            except ValidationError as exc:
                mapping = {
                    "context_summary": "contextSummary",
                    "options_selected": "selectedOption",
                    "risk_level": "riskLevel",
                    "confidence": "confidenceScore",
                }
                message_dict = getattr(exc, "message_dict", None)
                field_errors = []

                if message_dict:
                    for field, messages in message_dict.items():
                        camel_field = mapping.get(field)
                        if camel_field is None:
                            parts = field.split("_")
                            camel_field = parts[0] + "".join(
                                part.capitalize() for part in parts[1:]
                            )
                        if isinstance(messages, (list, tuple)):
                            for message in messages:
                                field_errors.append(
                                    {"field": camel_field, "message": str(message)}
                                )
                        else:
                            field_errors.append(
                                {"field": camel_field, "message": str(messages)}
                            )
                else:
                    messages = getattr(exc, "messages", None) or [str(exc)]
                    if isinstance(messages, (list, tuple)):
                        for message in messages:
                            field_errors.append(
                                {"field": "commit", "message": str(message)}
                            )
                    else:
                        field_errors.append(
                            {"field": "commit", "message": str(messages)}
                        )

                payload = {
                    "error": {
                        "code": "validation_error",
                        "message": "Decision draft is incomplete and cannot be committed.",
                        "details": {"fieldErrors": field_errors},
                    }
                }
                return Response(payload, status=status.HTTP_400_BAD_REQUEST)
            from_status = decision.status
            decision._compute_requires_approval()
            if decision.requires_approval:
                decision.submit_for_approval(user=request.user)
            else:
                decision.commit(user=request.user)
            decision.save(
                update_fields=[
                    "status",
                    "requires_approval",
                    "committed_at",
                    "committed_by",
                    "updated_at",
                ]
            )
            to_status = decision.status

            if snapshot is None:
                snapshot = decision._build_validation_snapshot()
            metadata["validation_snapshot"] = snapshot
            self._upsert_commit_record(decision, request.user, snapshot)
            self._record_transition(
                decision=decision,
                from_status=from_status,
                to_status=to_status,
                user=request.user,
                method="commit",
                note=serializer.validated_data.get("note"),
                metadata=metadata,
            )
        response_serializer = DecisionCommittedSerializer(
            decision,
            context=self.get_serializer_context(),
        )
        response_payload = {
            "detail": (
                "Decision requires approval"
                if decision.status == Decision.Status.AWAITING_APPROVAL
                else "Decision committed"
            ),
            "status": decision.status,
            "next_action": "APPROVE" if decision.status == Decision.Status.AWAITING_APPROVAL else None,
            "decision": response_serializer.data,
        }
        return Response(response_payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='reviews')
    def reviews(self, request, pk=None):
        decision = self.get_object()
        if request.method == 'POST':
            if decision.status not in (
                Decision.Status.COMMITTED,
                Decision.Status.REVIEWED,
            ):
                return invalid_state_response(
                    current_status=decision.status,
                    allowed_statuses=[Decision.Status.COMMITTED, Decision.Status.REVIEWED],
                    suggested_action=(
                        "Commit the decision before adding reviews."
                    ),
                )
        else:
            if decision.status not in (
                Decision.Status.COMMITTED,
                Decision.Status.REVIEWED,
                Decision.Status.ARCHIVED,
            ):
                return invalid_state_response(
                    current_status=decision.status,
                    allowed_statuses=[
                        Decision.Status.COMMITTED,
                        Decision.Status.REVIEWED,
                        Decision.Status.ARCHIVED,
                    ],
                    suggested_action="Commit the decision to view reviews.",
                )

        if request.method == 'GET':
            reviews = Review.objects.filter(decision=decision).order_by('-reviewed_at')
            serializer = CommittedReviewSerializer(reviews, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        with transaction.atomic():
            decision = Decision.objects.select_for_update().get(pk=decision.pk)
            serializer = CreateReviewSerializer(
                data=request.data,
                context={"decision": decision, "reviewer": request.user},
            )
            serializer.is_valid(raise_exception=True)
            review = serializer.save()
            if decision.status == Decision.Status.COMMITTED:
                from_status = decision.status
                decision.mark_reviewed()
                decision.save(update_fields=["status", "updated_at"])
                self._record_transition(
                    decision=decision,
                    from_status=from_status,
                    to_status=decision.status,
                    user=request.user,
                    method="review",
                )
        decision_serializer = DecisionCommittedSerializer(
            decision,
            context=self.get_serializer_context(),
        )
        response_payload = {
            "detail": "Decision reviewed",
            "status": decision.status,
            "decision": decision_serializer.data,
        }
        return Response(response_payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        decision = self.get_object()
        if decision.status != Decision.Status.AWAITING_APPROVAL:
            return invalid_state_response(
                current_status=decision.status,
                allowed_statuses=[Decision.Status.AWAITING_APPROVAL],
                suggested_action="Commit the decision to request approval.",
            )

        serializer = DecisionApproveActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            decision = Decision.objects.select_for_update().get(pk=decision.pk)
            from_status = decision.status
            decision.approve(user=request.user)
            decision.save(
                update_fields=[
                    "status",
                    "approved_at",
                    "approved_by",
                    "updated_at",
                ]
            )
            to_status = decision.status
            self._record_transition(
                decision=decision,
                from_status=from_status,
                to_status=to_status,
                user=request.user,
                method="approve",
                note=serializer.validated_data.get("note"),
                metadata=serializer.validated_data.get("metadata"),
            )
        response_serializer = DecisionCommittedSerializer(
            decision,
            context=self.get_serializer_context(),
        )
        response_payload = {
            "detail": "Decision approved",
            "status": decision.status,
            "next_action": None,
            "decision": response_serializer.data,
        }
        return Response(response_payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        decision = self.get_object()
        if decision.status not in (Decision.Status.COMMITTED, Decision.Status.REVIEWED):
            return invalid_state_response(
                current_status=decision.status,
                allowed_statuses=[Decision.Status.COMMITTED, Decision.Status.REVIEWED],
                suggested_action="Commit the decision before archiving.",
            )

        serializer = DecisionArchiveActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            decision = Decision.objects.select_for_update().get(pk=decision.pk)
            from_status = decision.status
            decision.archive(user=request.user)
            decision.save(update_fields=["status", "updated_at"])
            to_status = decision.status
            self._record_transition(
                decision=decision,
                from_status=from_status,
                to_status=to_status,
                user=request.user,
                method="archive",
                note=serializer.validated_data.get("note"),
                metadata=serializer.validated_data.get("metadata"),
            )
        response_serializer = DecisionCommittedSerializer(
            decision,
            context=self.get_serializer_context(),
        )
        response_payload = {
            "detail": "Decision archived",
            "status": decision.status,
            "next_action": None,
            "decision": response_serializer.data,
        }
        return Response(response_payload, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        decision = self.get_object()
        if decision.is_deleted:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    
        with transaction.atomic():
        # Delete all CalendarEvents derived from this Decision before soft-deleting
            CalendarEvent.objects.filter(decision=decision).delete()
        
            decision.is_deleted = True
            decision.save(update_fields=["is_deleted", "updated_at"])
    
        return Response(status=status.HTTP_204_NO_CONTENT)
