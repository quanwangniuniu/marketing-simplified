from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from core.models import Project
from meetings.knowledge_links import serialize_origin_meeting
from meetings.services import validate_meeting_for_origin_link

from .models import CommitRecord, Decision, DecisionEdge, DecisionStateTransition, Option, Review, Signal
from .services import generate_signal_text


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = "__all__"


class SignalResponseSerializer(serializers.ModelSerializer):
    decisionId = serializers.IntegerField(source="decision_id", read_only=True)
    createdBy = serializers.IntegerField(source="author_id", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    scopeType = serializers.CharField(source="scope_type", allow_null=True)
    scopeValue = serializers.CharField(source="scope_value", allow_null=True)
    deltaValue = serializers.DecimalField(
        source="delta_value", max_digits=12, decimal_places=2, allow_null=True
    )
    deltaUnit = serializers.CharField(source="delta_unit", allow_null=True)
    displayText = serializers.CharField(source="display_text", read_only=True)
    displayTextOverride = serializers.CharField(
        source="display_text_override", allow_null=True, required=False
    )

    class Meta:
        model = Signal
        fields = [
            "id",
            "decisionId",
            "createdBy",
            "createdAt",
            "updatedAt",
            "metric",
            "movement",
            "period",
            "comparison",
            "scopeType",
            "scopeValue",
            "deltaValue",
            "deltaUnit",
            "displayText",
            "displayTextOverride",
        ]


class SignalCreateUpdateSerializer(serializers.ModelSerializer):
    metric = serializers.ChoiceField(choices=Signal.Metric.choices, required=True)
    movement = serializers.ChoiceField(choices=Signal.Movement.choices, required=True)
    period = serializers.ChoiceField(choices=Signal.Period.choices, required=True)
    scopeType = serializers.CharField(
        source="scope_type", allow_null=True, required=False
    )
    scopeValue = serializers.CharField(
        source="scope_value", allow_null=True, required=False, allow_blank=True
    )
    deltaValue = serializers.DecimalField(
        source="delta_value", max_digits=12, decimal_places=2, allow_null=True, required=False
    )
    deltaUnit = serializers.CharField(
        source="delta_unit", allow_null=True, required=False
    )
    displayTextOverride = serializers.CharField(
        source="display_text_override", allow_null=True, required=False, allow_blank=True
    )

    class Meta:
        model = Signal
        fields = [
            "metric",
            "movement",
            "period",
            "comparison",
            "scopeType",
            "scopeValue",
            "deltaValue",
            "deltaUnit",
            "displayTextOverride",
        ]

    def validate(self, attrs):
        scope_type = attrs.get("scope_type")
        scope_value = attrs.get("scope_value")
        delta_value = attrs.get("delta_value")
        delta_unit = attrs.get("delta_unit")

        if scope_type == Signal.ScopeType.CHANNEL and not scope_value:
            raise serializers.ValidationError(
                {"scopeValue": "scopeValue is required when scopeType is CHANNEL."}
            )
        if (delta_value is None) ^ (delta_unit is None):
            raise serializers.ValidationError(
                {"deltaValue": "deltaValue and deltaUnit must be provided together."}
            )
        return attrs

    def _apply_display_text(self, instance, validated_data):
        if "display_text_override" in validated_data:
            override = validated_data.get("display_text_override")
            if override:
                instance.display_text_override = override
                instance.display_text = override
                return
            instance.display_text_override = None

        if instance.display_text_override:
            instance.display_text = instance.display_text_override
            return

        generated = generate_signal_text(
            metric=validated_data.get("metric") or instance.metric,
            movement=validated_data.get("movement") or instance.movement,
            period=validated_data.get("period") or instance.period,
            comparison=validated_data.get("comparison") or instance.comparison,
            scope_type=validated_data.get("scope_type") or instance.scope_type,
            scope_value=validated_data.get("scope_value") or instance.scope_value,
            delta_value=validated_data.get("delta_value") or instance.delta_value,
            delta_unit=validated_data.get("delta_unit") or instance.delta_unit,
        )
        instance.display_text = generated

    def create(self, validated_data):
        decision = self.context["decision"]
        if decision.signals.count() >= 15:
            raise serializers.ValidationError(
                {"signals": "A decision can have at most 15 signals."}
            )
        signal = Signal(
            decision=decision,
            author=self.context.get("author"),
            **validated_data,
        )
        self._apply_display_text(signal, validated_data)
        signal.save()
        return signal

    def update(self, instance, validated_data):
        for key, value in validated_data.items():
            setattr(instance, key, value)
        self._apply_display_text(instance, validated_data)
        instance.save()
        return instance


class DraftSignalSerializer(SignalResponseSerializer):
    isDeleted = serializers.BooleanField(source="is_deleted", read_only=True)

    class Meta(SignalResponseSerializer.Meta):
        fields = SignalResponseSerializer.Meta.fields + ["isDeleted"]


class DraftOptionSerializer(serializers.ModelSerializer):
    text = serializers.CharField(allow_blank=True)
    decisionId = serializers.IntegerField(source="decision_id", read_only=True)
    isSelected = serializers.BooleanField(source="is_selected")
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    isDeleted = serializers.BooleanField(source="is_deleted", read_only=True)

    class Meta:
        model = Option
        fields = [
            "id",
            "decisionId",
            "text",
            "isSelected",
            "order",
            "createdAt",
            "updatedAt",
            "isDeleted",
        ]


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = "__all__"


class CreateReviewSerializer(serializers.Serializer):
    outcomeText = serializers.CharField()
    reflectionText = serializers.CharField()
    decisionQuality = serializers.ChoiceField(choices=Review.DecisionQuality.choices)
    tags = serializers.ListField(child=serializers.CharField(), required=False)

    def create(self, validated_data):
        return Review.objects.create(
            decision=self.context["decision"],
            reviewer=self.context.get("reviewer"),
            outcome_text=validated_data["outcomeText"],
            reflection_text=validated_data["reflectionText"],
            quality=validated_data["decisionQuality"],
        )


class CommitRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommitRecord
        fields = "__all__"


class DecisionStateTransitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DecisionStateTransition
        fields = "__all__"


class DecisionListSerializer(serializers.ModelSerializer):
    contextSummary = serializers.CharField(source="context_summary", allow_null=True)
    riskLevel = serializers.CharField(source="risk_level", allow_null=True)
    confidenceScore = serializers.IntegerField(source="confidence", allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at")
    createdBy = serializers.IntegerField(source="author_id", allow_null=True)
    committedAt = serializers.DateTimeField(source="committed_at", allow_null=True)
    projectId = serializers.IntegerField(source="project_id", allow_null=True)
    projectName = serializers.CharField(source="project.name", allow_null=True)
    projectSeq = serializers.IntegerField(source="project_seq")
    selectedOptionText = serializers.SerializerMethodField()
    hasReviews = serializers.SerializerMethodField()
    createdByAgent = serializers.BooleanField(source="created_by_agent", read_only=True)
    agentSessionId = serializers.UUIDField(source="agent_session_id", read_only=True, allow_null=True)

    class Meta:
        model = Decision
        fields = [
            "id",
            "projectSeq",
            "status",
            "title",
            "contextSummary",
            "selectedOptionText",
            "riskLevel",
            "confidenceScore",
            "createdAt",
            "createdBy",
            "committedAt",
            "projectId",
            "projectName",
            "hasReviews",
            "createdByAgent",
            "agentSessionId",
        ]

    def get_selectedOptionText(self, obj):
        selected_option = obj.options.filter(is_selected=True).first()
        return selected_option.text if selected_option else None

    def get_hasReviews(self, obj):
        return obj.reviews.exists()


class DecisionGraphNodeSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    projectId = serializers.IntegerField(source="project_id", read_only=True)
    projectSeq = serializers.IntegerField(source="project_seq", read_only=True)
    riskLevel = serializers.CharField(source="risk_level", read_only=True, allow_null=True)

    class Meta:
        model = Decision
        fields = [
            "id",
            "title",
            "status",
            "riskLevel",
            "createdAt",
            "updatedAt",
            "projectId",
            "projectSeq",
        ]


class DecisionEdgeSerializer(serializers.ModelSerializer):
    from_ = serializers.IntegerField(source="from_decision_id", read_only=True)
    to = serializers.IntegerField(source="to_decision_id", read_only=True)

    class Meta:
        model = DecisionEdge
        fields = [
            "from_",
            "to",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "from": data.get("from_"),
            "to": data.get("to"),
        }


class DecisionDraftSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    parentDecisionIds = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
    )
    title = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    contextSummary = serializers.CharField(
        source="context_summary", required=False, allow_null=True, allow_blank=True
    )
    riskLevel = serializers.CharField(source="risk_level", required=False, allow_null=True)
    confidenceScore = serializers.IntegerField(
        source="confidence", required=False, allow_null=True
    )
    reasoning = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    signals = DraftSignalSerializer(many=True, required=False)
    options = DraftOptionSerializer(many=True, required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    createdBy = serializers.IntegerField(source="author_id", read_only=True)
    lastEditedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    lastEditedBy = serializers.IntegerField(source="last_edited_by_id", read_only=True)
    isReferenceCase = serializers.BooleanField(
        source="is_reference_case", required=False
    )
    projectSeq = serializers.IntegerField(source="project_seq", read_only=True)
    createdByAgent = serializers.BooleanField(
        source="created_by_agent", required=False, default=False
    )
    agentSessionId = serializers.UUIDField(
        source="agent_session_id", required=False, allow_null=True
    )
    plannedDecisionDate = serializers.DateTimeField(
        source="planned_decision_date", required=False, allow_null=True
    )
    origin_meeting = serializers.SerializerMethodField()
    origin_meeting_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
    )

    def get_origin_meeting(self, obj):
        try:
            origin = obj.meeting_origin
        except ObjectDoesNotExist:
            return None
        meeting = origin.meeting
        if meeting is None:
            return None
        return serialize_origin_meeting(meeting)

    def validate(self, attrs):
        origin_mid = attrs.get("origin_meeting_id")
        if origin_mid is not None and self.instance is not None:
            try:
                self.instance.meeting_origin
            except ObjectDoesNotExist:
                raise serializers.ValidationError(
                    {
                        "origin_meeting_id": "Meeting origin can only be set when creating a decision.",
                    },
                )
            raise serializers.ValidationError(
                {
                    "origin_meeting_id": "Decision already has a meeting origin.",
                },
            )
        if origin_mid is None:
            return attrs
        request = self.context.get("request")
        if request is None:
            return attrs
        raw_project = request.headers.get("x-project-id") or request.query_params.get(
            "project_id"
        )
        if raw_project is None:
            raise serializers.ValidationError(
                {"origin_meeting_id": "Project context is required."},
            )
        try:
            project_id = int(raw_project)
        except (TypeError, ValueError):
            raise serializers.ValidationError(
                {"origin_meeting_id": "Invalid project context."},
            )
        project = Project.objects.filter(pk=project_id).first()
        if not project:
            raise serializers.ValidationError({"origin_meeting_id": "Invalid project."})
        validate_meeting_for_origin_link(
            meeting_id=origin_mid,
            project=project,
            user=request.user,
        )
        return attrs

    def to_internal_value(self, data):
        if self.instance is not None:
            data = data.copy()
            signals = data.get("signals")
            if isinstance(signals, list):
                pass
            options = data.get("options")
            if isinstance(options, list):
                for item in options:
                    if not isinstance(item, dict):
                        continue
                    if "is_selected" in item and "isSelected" not in item:
                        item["isSelected"] = item.pop("is_selected")
        return super().to_internal_value(data)

    def update(self, instance, validated_data):
        signals_data = validated_data.pop("signals", None)
        options_data = validated_data.pop("options", None)
        instance = super().update(instance, validated_data)

        if signals_data is not None:
            instance.signals.all().delete()
            for signal_data in signals_data:
                signal_data.pop("decision", None)
                serializer = SignalCreateUpdateSerializer(
                    data=signal_data,
                    context={"decision": instance, "author": self.context.get("request").user},
                )
                serializer.is_valid(raise_exception=True)
                serializer.save()

        if options_data is not None:
            instance.options.all().delete()
            for option_data in options_data:
                if "isSelected" in option_data and "is_selected" not in option_data:
                    option_data["is_selected"] = option_data.pop("isSelected")
                option_data.pop("decision", None)
                Option.objects.create(decision=instance, **option_data)

        return instance

    class Meta:
        model = Decision
        fields = [
            "id",
            "title",
            "contextSummary",
            "riskLevel",
            "confidenceScore",
            "reasoning",
            "signals",
            "options",
            "createdAt",
            "createdBy",
            "lastEditedAt",
            "lastEditedBy",
            "isReferenceCase",
            "projectSeq",
            "parentDecisionIds",
            "createdByAgent",
            "agentSessionId",
            "plannedDecisionDate",
            "origin_meeting",
            "origin_meeting_id",
        ]


class DecisionDetailSerializer(serializers.ModelSerializer):
    signals = SignalResponseSerializer(many=True, read_only=True)
    options = OptionSerializer(many=True, read_only=True)
    reviews = ReviewSerializer(many=True, read_only=True)
    commit_record = CommitRecordSerializer(read_only=True)
    state_transitions = DecisionStateTransitionSerializer(many=True, read_only=True)

    def get_field_names(self, declared_fields, info):
        fields = list(super().get_field_names(declared_fields, info))
        extra = list(getattr(self.Meta, "extra_fields", []))
        for field in extra:
            if field not in fields:
                fields.append(field)
        return fields

    class Meta:
        model = Decision
        fields = "__all__"
        extra_fields = [
            "signals",
            "options",
            "reviews",
            "commit_record",
            "state_transitions",
        ]


class CommittedSignalSerializer(SignalResponseSerializer):
    pass


class CommittedOptionSerializer(serializers.ModelSerializer):
    isSelected = serializers.BooleanField(source="is_selected", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Option
        fields = [
            "id",
            "text",
            "isSelected",
            "createdAt",
        ]


class CommittedReviewSerializer(serializers.ModelSerializer):
    outcomeText = serializers.CharField(source="outcome_text", read_only=True)
    reflectionText = serializers.CharField(source="reflection_text", read_only=True)
    decisionQuality = serializers.CharField(source="quality", read_only=True)
    reviewedAt = serializers.DateTimeField(source="reviewed_at", read_only=True)
    reviewerId = serializers.IntegerField(source="reviewer_id", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "outcomeText",
            "reflectionText",
            "decisionQuality",
            "reviewedAt",
            "reviewerId",
        ]


class CommittedCommitRecordSerializer(serializers.ModelSerializer):
    committedAt = serializers.DateTimeField(source="committed_at", read_only=True)
    committedBy = serializers.IntegerField(source="committed_by_id", read_only=True)

    class Meta:
        model = CommitRecord
        fields = [
            "id",
            "committedAt",
            "committedBy",
        ]


class CommittedStateTransitionSerializer(serializers.ModelSerializer):
    fromStatus = serializers.CharField(source="from_status", read_only=True)
    toStatus = serializers.CharField(source="to_status", read_only=True)
    changedAt = serializers.DateTimeField(source="timestamp", read_only=True)
    changedBy = serializers.IntegerField(source="triggered_by_id", read_only=True)

    class Meta:
        model = DecisionStateTransition
        fields = [
            "id",
            "fromStatus",
            "toStatus",
            "changedAt",
            "changedBy",
        ]


class DecisionCommittedSerializer(serializers.ModelSerializer):
    contextSummary = serializers.CharField(source="context_summary", read_only=True)
    riskLevel = serializers.CharField(source="risk_level", read_only=True)
    confidenceScore = serializers.IntegerField(source="confidence", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    createdBy = serializers.IntegerField(source="author_id", read_only=True)
    committedAt = serializers.DateTimeField(source="committed_at", read_only=True)
    approvedAt = serializers.DateTimeField(source="approved_at", read_only=True)
    approvedBy = serializers.IntegerField(source="approved_by_id", read_only=True)
    isReferenceCase = serializers.BooleanField(source="is_reference_case", read_only=True)
    projectSeq = serializers.IntegerField(source="project_seq", read_only=True)
    createdByAgent = serializers.BooleanField(source="created_by_agent", read_only=True)
    agentSessionId = serializers.UUIDField(source="agent_session_id", read_only=True, allow_null=True)
    signals = CommittedSignalSerializer(many=True, read_only=True)
    options = CommittedOptionSerializer(many=True, read_only=True)
    reviews = CommittedReviewSerializer(many=True, read_only=True)
    commitRecord = CommittedCommitRecordSerializer(read_only=True)
    stateTransitions = CommittedStateTransitionSerializer(many=True, read_only=True)
    origin_meeting = serializers.SerializerMethodField()

    class Meta:
        model = Decision
        fields = [
            "id",
            "projectSeq",
            "status",
            "title",
            "contextSummary",
            "riskLevel",
            "confidenceScore",
            "reasoning",
            "createdAt",
            "createdBy",
            "committedAt",
            "approvedAt",
            "approvedBy",
            "isReferenceCase",
            "createdByAgent",
            "agentSessionId",
            "signals",
            "options",
            "reviews",
            "commitRecord",
            "stateTransitions",
            "origin_meeting",
        ]

    def get_origin_meeting(self, obj):
        try:
            origin = obj.meeting_origin
        except ObjectDoesNotExist:
            return None
        meeting = origin.meeting
        if meeting is None:
            return None
        return serialize_origin_meeting(meeting)


class DecisionCommitActionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    validation_snapshot = serializers.JSONField(required=False, allow_null=True)
    metadata = serializers.JSONField(required=False, allow_null=True)


class DecisionConnectionsUpdateSerializer(serializers.Serializer):
    connectedDecisionSeqs = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
    )


class DecisionApproveActionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    metadata = serializers.JSONField(required=False, allow_null=True)


class DecisionArchiveActionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    metadata = serializers.JSONField(required=False, allow_null=True)
