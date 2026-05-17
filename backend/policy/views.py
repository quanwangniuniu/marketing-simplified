from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.core.exceptions import ValidationError
from django.db.models import Q

from policy.models import (
    PlatformPolicyUpdate, Platform, PolicyChangeType, MitigationStatus,
)
from policy.serializers import PlatformPolicyUpdateSerializer
from core.models import ProjectMember


class PlatformPolicyUpdateViewSet(viewsets.ModelViewSet):
    """ViewSet for PlatformPolicyUpdate model."""
    serializer_class = PlatformPolicyUpdateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return PlatformPolicyUpdate.objects.none()

        queryset = PlatformPolicyUpdate.objects.select_related(
            'task', 'created_by', 'assigned_to', 'reviewed_by',
        )

        # Scope to projects the user can access
        accessible_project_ids = set(
            ProjectMember.objects.filter(
                user=user, is_active=True,
            ).values_list('project_id', flat=True)
        )

        queryset = queryset.filter(
            Q(task__project_id__in=accessible_project_ids)
            | Q(task__isnull=True, created_by=user)
        )

        # --- Query-param filters ---
        platform = self.request.query_params.get('platform')
        if platform:
            queryset = queryset.filter(platform=platform)

        mitigation_status = self.request.query_params.get('mitigation_status')
        if mitigation_status:
            queryset = queryset.filter(mitigation_status=mitigation_status)

        policy_change_type = self.request.query_params.get('policy_change_type')
        if policy_change_type:
            queryset = queryset.filter(policy_change_type=policy_change_type)

        assigned_to_id = self.request.query_params.get('assigned_to_id')
        if assigned_to_id:
            queryset = queryset.filter(assigned_to_id=assigned_to_id)

        task_id = self.request.query_params.get('task_id')
        if task_id:
            queryset = queryset.filter(task_id=task_id)

        return queryset

    def perform_create(self, serializer):
        try:
            policy_update = serializer.save()
            # Link the task's GenericFK so task.linked_object is populated in the API
            task = policy_update.task
            if task:
                task.link_to_object(policy_update)
                task.save()
        except ValidationError as e:
            raise DRFValidationError(
                e.message_dict if hasattr(e, 'message_dict') else {'detail': e.messages}
            )

    def perform_update(self, serializer):
        try:
            serializer.save()
        except ValidationError as e:
            raise DRFValidationError(
                e.message_dict if hasattr(e, 'message_dict') else {'detail': e.messages}
            )

    # --- Custom actions ---

    @action(detail=False, methods=["get"], url_path="choices")
    def choices(self, request):
        return Response({
            "platforms": [
                {"value": "meta", "label": "Meta (Facebook/Instagram)"},
                {"value": "google_ads", "label": "Google Ads"},
                {"value": "tiktok", "label": "TikTok"},
                {"value": "linkedin", "label": "LinkedIn"},
                {"value": "twitter", "label": "Twitter/X"},
                {"value": "snapchat", "label": "Snapchat"},
                {"value": "pinterest", "label": "Pinterest"},
                {"value": "other", "label": "Other"},
            ],
            "policy_change_types": [
                {"value": "targeting_rules", "label": "Targeting Rules"},
                {"value": "content_policy", "label": "Content Policy"},
                {"value": "privacy_policy", "label": "Privacy Policy"},
                {"value": "ad_placement", "label": "Ad Placement"},
                {"value": "budget_policy", "label": "Budget Policy"},
                {"value": "compliance_requirement", "label": "Compliance Requirement"},
                {"value": "data_usage", "label": "Data Usage"},
                {"value": "other", "label": "Other"},
            ],
        })

    @action(detail=True, methods=['post'], url_path='mark-mitigation-completed')
    def mark_mitigation_completed(self, request, pk=None):
        """Set mitigation_status to COMPLETED and record timestamp."""
        instance = self.get_object()

        if instance.mitigation_status in (
            MitigationStatus.COMPLETED,
            MitigationStatus.REVIEWED,
        ):
            return Response(
                {'error': 'Mitigation is already completed or reviewed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            instance.mark_mitigation_completed()
        except ValidationError as e:
            raise DRFValidationError(
                e.message_dict if hasattr(e, 'message_dict') else {'detail': e.messages}
            )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='mark-reviewed')
    def mark_reviewed(self, request, pk=None):
        """Set mitigation_status to REVIEWED after completion."""
        instance = self.get_object()

        if instance.mitigation_status != MitigationStatus.COMPLETED:
            return Response(
                {'error': 'Mitigation must be completed before review.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            instance.mark_reviewed(user=request.user)
        except ValidationError as e:
            raise DRFValidationError(
                e.message_dict if hasattr(e, 'message_dict') else {'detail': e.messages}
            )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_policy_choices(request):
    """Return enum choices for Platform, PolicyChangeType, MitigationStatus."""
    return Response({
        'platforms': [
            {'value': c[0], 'label': c[1]} for c in Platform.choices
        ],
        'policy_change_types': [
            {'value': c[0], 'label': c[1]} for c in PolicyChangeType.choices
        ],
        'mitigation_statuses': [
            {'value': c[0], 'label': c[1]} for c in MitigationStatus.choices
        ],
    })
