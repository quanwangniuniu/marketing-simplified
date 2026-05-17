from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from .services import ExperimentService
from .models import Experiment, ExperimentProgressUpdate
from core.models import ProjectMember

User = get_user_model()
from .serializers import ExperimentSerializer, ExperimentProgressUpdateSerializer


# ==================== EXPERIMENT VIEWS ====================

class ExperimentListCreateView(generics.ListCreateAPIView):
    """
    GET /api/experiment/experiments/
    POST /api/experiment/experiments/
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']
    serializer_class = ExperimentSerializer
    
    def get_queryset(self):
        """Return experiments with filtering and project access control"""
        user = self.request.user
        if not user.is_authenticated:
            return Experiment.objects.none()
        
        # User must be active member of the task's project
        accessible_project_ids = ProjectMember.objects.filter(
            user=user,
            is_active=True,
        ).values_list("project_id", flat=True)
        
        queryset = Experiment.objects.select_related("task", "task__project", "created_by").filter(
            task__project_id__in=accessible_project_ids
        )
        
        # Filter experiments by start and end date (now from Task model)
        start_before = self.request.query_params.get('start_before')
        end_after = self.request.query_params.get('end_after')
        created_by = self.request.query_params.get('created_by')
        
        if start_before:
            queryset = queryset.filter(task__start_date__lt=start_before)
        if end_after:
            queryset = queryset.filter(task__due_date__gt=end_after)
        if created_by:
            queryset = queryset.filter(created_by_id=created_by)
        
        return queryset.order_by('-created_at')
    
    def create(self, request, *args, **kwargs):
        """Override create to format validation errors consistently"""
        serializer = self.get_serializer(data=request.data)
        
        if not serializer.is_valid():
            # Format serializer validation errors to match expected format
            errors = {}
            for field, messages in serializer.errors.items():
                # Convert ErrorDetail list to single message string
                if isinstance(messages, list) and len(messages) > 0:
                    errors[field] = str(messages[0])
                else:
                    errors[field] = str(messages)
            
            return Response(
                {'detail': errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            self.perform_create(serializer)
        except DRFValidationError as e:
            # Format DRFValidationError to match expected format
            errors = {}
            if hasattr(e, 'detail'):
                if isinstance(e.detail, dict):
                    for field, messages in e.detail.items():
                        if isinstance(messages, list) and len(messages) > 0:
                            errors[field] = str(messages[0])
                        else:
                            errors[field] = str(messages)
                else:
                    errors = {'non_field_errors': str(e.detail)}
            
            return Response(
                {'detail': errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    def perform_create(self, serializer):
        """Override create to set created_by and validate task"""
        task = serializer.validated_data.get("task")
        if task is None:
            raise DRFValidationError({"task": "Task is required for experiment."})
        
        # Ensure task is of type 'experiment'
        if task.type != "experiment":
            raise DRFValidationError(
                {"task": 'Experiment can only be created for tasks of type "experiment".'}
            )
        
        # Ensure user has access to task's project
        user = self.request.user
        has_membership = ProjectMember.objects.filter(
            user=user,
            project=task.project,
            is_active=True,
        ).exists()
        if not has_membership:
            raise PermissionDenied("You do not have access to this task.")
        
        # Enforce one-to-one relation: prevent duplicate experiment per task
        if hasattr(task, "experiment"):
            raise DRFValidationError(
                {"task": "Experiment already exists for this task."}
            )
        
        experiment = serializer.save(created_by=user)
        # Link the task's GenericFK so task.linked_object is populated in the API
        task.link_to_object(experiment)
        task.save()


class ExperimentRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    """
    GET /api/experiment/experiments/{id}/
    PATCH /api/experiment/experiments/{id}/
    """
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    serializer_class = ExperimentSerializer
    
    def get_queryset(self):
        """Return experiments with project access control"""
        user = self.request.user
        if not user.is_authenticated:
            return Experiment.objects.none()
        
        accessible_project_ids = ProjectMember.objects.filter(
            user=user,
            is_active=True,
        ).values_list("project_id", flat=True)
        
        return Experiment.objects.select_related("task", "task__project", "created_by").filter(
            task__project_id__in=accessible_project_ids
        )
    
    def update(self, request, *args, **kwargs):
        """Override update for partial updates with status transition validation"""
        instance = self.get_object()
        new_status = None
        
        # Check status transition business rules if status is being updated
        if 'status' in request.data:
            new_status = request.data['status']
            current_status = instance.status
            
            is_valid, error_message = ExperimentService.validate_experiment_status_transition(
                current_status, new_status
            )
            
            if not is_valid:
                return Response(
                    {'detail': {'status': error_message}},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Check outcome validation if experiment_outcome is being updated
        if 'experiment_outcome' in request.data:
            outcome = request.data.get('experiment_outcome')
            notes = request.data.get('outcome_notes', instance.outcome_notes)
            
            is_valid, error_message = ExperimentService.validate_experiment_outcome(
                instance, outcome, notes
            )
            
            if not is_valid:
                return Response(
                    {'detail': {'experiment_outcome': error_message}},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        
        if serializer.is_valid():
            # Update experiment with validated data
            updated_experiment = serializer.save()
            
            # Automatically set started_at when status changes to RUNNING (after save)
            if new_status == Experiment.ExperimentStatus.RUNNING:
                if not updated_experiment.started_at:
                    from django.utils import timezone
                    updated_experiment.started_at = timezone.now()
                    updated_experiment.save(update_fields=['started_at'])
            
            return Response(
                ExperimentSerializer(updated_experiment).data,
                status=status.HTTP_200_OK
            )
        
        # Serializer validation errors
        return Response(
            {'detail': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )


# ==================== PROGRESS UPDATE VIEWS ====================

class ExperimentProgressUpdateListCreateView(generics.ListCreateAPIView):
    """
    GET /api/experiment/experiments/{id}/progress-updates/
    POST /api/experiment/experiments/{id}/progress-updates/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ExperimentProgressUpdateSerializer
    
    def get_queryset(self):
        """Return progress updates for the experiment"""
        experiment_id = self.kwargs['id']
        user = self.request.user
        if not user.is_authenticated:
            return ExperimentProgressUpdate.objects.none()
        
        # Verify experiment exists and user has access
        experiment = ExperimentService.check_experiment_exists(experiment_id)
        if experiment is None:
            return ExperimentProgressUpdate.objects.none()
        
        # Check project access
        accessible_project_ids = ProjectMember.objects.filter(
            user=user,
            is_active=True,
        ).values_list("project_id", flat=True)
        
        if experiment.task and experiment.task.project_id not in accessible_project_ids:
            return ExperimentProgressUpdate.objects.none()
        
        queryset = ExperimentProgressUpdate.objects.filter(
            experiment_id=experiment_id
        ).select_related('experiment', 'created_by').order_by('-created_at')
        
        # Filter by date range if needed
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Override create to format validation errors consistently"""
        serializer = self.get_serializer(data=request.data)
        
        if not serializer.is_valid():
            # Format serializer validation errors to match expected format
            errors = {}
            for field, messages in serializer.errors.items():
                # Convert ErrorDetail list to single message string
                if isinstance(messages, list) and len(messages) > 0:
                    errors[field] = str(messages[0])
                else:
                    errors[field] = str(messages)
            
            return Response(
                {'detail': errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            self.perform_create(serializer)
        except DRFValidationError as e:
            # Format DRFValidationError to match expected format
            if hasattr(e, 'detail'):
                if isinstance(e.detail, dict) and 'detail' in e.detail:
                    # If error already has 'detail' key, use it directly
                    return Response(
                        {'detail': e.detail['detail']},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                elif isinstance(e.detail, dict):
                    # Convert dict errors to detail format
                    errors = {}
                    for field, messages in e.detail.items():
                        if isinstance(messages, list) and len(messages) > 0:
                            errors[field] = str(messages[0])
                        else:
                            errors[field] = str(messages)
                    return Response(
                        {'detail': errors},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                else:
                    return Response(
                        {'detail': str(e.detail)},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                return Response(
                    {'detail': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    def perform_create(self, serializer):
        """Override create to set experiment and created_by"""
        experiment_id = self.kwargs['id']
        
        # Verify experiment exists
        experiment = ExperimentService.check_experiment_exists(experiment_id)
        if experiment is None:
            raise DRFValidationError({'detail': 'Experiment not found'})
        
        # Check project access
        user = self.request.user
        if experiment.task:
            has_membership = ProjectMember.objects.filter(
                user=user,
                project=experiment.task.project,
                is_active=True,
            ).exists()
            if not has_membership:
                raise PermissionDenied("You do not have access to this experiment.")
        
        serializer.save(experiment=experiment, created_by=user)

