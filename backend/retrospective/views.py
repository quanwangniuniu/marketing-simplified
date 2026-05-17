"""
API views for retrospective engine
Handles CRUD operations and business logic endpoints
"""
from typing import Dict, List, Any
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.contrib.auth import get_user_model

from .models import RetrospectiveTask, Insight, RetrospectiveStatus, CampaignMetric
from .serializers import (
    RetrospectiveTaskListSerializer, RetrospectiveTaskDetailSerializer, RetrospectiveTaskCreateSerializer,
    InsightListSerializer, InsightDetailSerializer, InsightCreateSerializer,
    RetrospectiveSummarySerializer, KPIUploadSerializer, InsightGenerationSerializer,
    ReportGenerationSerializer, ReportApprovalSerializer, RuleDefinitionSerializer,
    KPIComparisonSerializer, CampaignMetricSerializer
)
from .services import RetrospectiveService
from .rules import InsightRules
from .tasks import generate_retrospective, generate_insights_for_retrospective, generate_report_for_retrospective

User = get_user_model()


class RetrospectiveTaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet for RetrospectiveTask CRUD operations
    """
    permission_classes = [IsAuthenticated]
    queryset = RetrospectiveTask.objects.all()
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return RetrospectiveTaskCreateSerializer
        elif self.action in ['retrieve', 'update', 'partial_update']:
            return RetrospectiveTaskDetailSerializer
        return RetrospectiveTaskListSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions"""
        user = self.request.user
        
        # Superusers can see all retrospectives
        if user.is_superuser:
            return RetrospectiveTask.objects.all()
        
        # Build Q objects for filtering
        from django.db.models import Q
        
        # Base filter: user's own retrospectives
        filters = Q(created_by=user)
        
        # Users with approve_report permission can also see completed and reported retrospectives
        if user.has_perm('retrospective.approve_report'):
            approval_filter = Q(status__in=[RetrospectiveStatus.COMPLETED, RetrospectiveStatus.REPORTED])
            filters = filters | approval_filter
        
        return RetrospectiveTask.objects.filter(filters).distinct()
    
    def perform_create(self, serializer):
        """Create retrospective with proper user assignment"""
        retro = serializer.save(created_by=self.request.user)
        task = getattr(retro, 'task', None)
        if task:
            task.link_to_object(retro)
            task.save()
    
    @action(detail=True, methods=['post'])
    def start_analysis(self, request, pk=None):
        """Start retrospective analysis"""
        retrospective = self.get_object()
        
        if retrospective.status != RetrospectiveStatus.SCHEDULED:
            return Response(
                {'error': 'Can only start analysis for scheduled retrospectives'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Start Celery task for analysis
        task = generate_retrospective.delay(
            campaign_id=str(retrospective.campaign.id),
            created_by_id=str(request.user.id)
        )
        
        return Response({
            'message': 'Retrospective analysis started',
            'task_id': task.id,
            'retrospective_id': str(retrospective.id)
        })
    
    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get comprehensive summary of retrospective"""
        retrospective = self.get_object()
        
        try:
            summary_data = RetrospectiveService.get_retrospective_summary(str(retrospective.id))
            serializer = RetrospectiveSummarySerializer(summary_data)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def generate_report(self, request, pk=None):
        """Generate report for retrospective"""
        retrospective = self.get_object()
        
        serializer = ReportGenerationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Start Celery task for report generation
        task = generate_report_for_retrospective.delay(str(retrospective.id))
        
        return Response({
            'message': 'Report generation started',
            'task_id': task.id,
            'retrospective_id': str(retrospective.id)
        })
    
    @action(detail=True, methods=['post'])
    def approve_report(self, request, pk=None):
        """Approve retrospective report"""
        # Check permissions first
        if not request.user.has_perm('retrospective.approve_report'):
            return Response(
                {'error': 'Insufficient permissions to approve reports'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        retrospective = self.get_object()
        
        serializer = ReportApprovalSerializer(data=request.data)
        if not serializer.is_valid():
            # Extract error message from serializer errors for consistent format
            if 'retrospective_id' in serializer.errors:
                error_msg = str(serializer.errors['retrospective_id'][0])
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            approved_retrospective = RetrospectiveService.approve_report(
                retrospective_id=str(retrospective.id),
                approved_by=request.user
            )
            
            return Response({
                'message': 'Report approved successfully',
                'retrospective_id': str(approved_retrospective.id),
                'reviewed_by': approved_retrospective.reviewed_by.username,
                'reviewed_at': approved_retrospective.reviewed_at.isoformat()
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def my_retrospectives(self, request):
        """Get retrospectives created by current user"""
        retrospectives = RetrospectiveTask.objects.filter(created_by=request.user)
        serializer = RetrospectiveTaskListSerializer(retrospectives, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get retrospectives pending approval (for TL/Org Admin)"""
        if not request.user.has_perm('retrospective.approve_report'):
            return Response(
                {'error': 'Insufficient permissions'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        retrospectives = RetrospectiveTask.objects.filter(
            status=RetrospectiveStatus.COMPLETED,
            report_url__isnull=False,
            reviewed_by__isnull=True
        )
        serializer = RetrospectiveTaskListSerializer(retrospectives, many=True)
        return Response(serializer.data)


# CampaignMetric ViewSet for load testing and KPI queries
class CampaignMetricViewSet(viewsets.ModelViewSet):
    """ViewSet for CampaignMetric - used for KPI queries and load testing"""
    serializer_class = CampaignMetricSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['campaign', 'date']
    ordering_fields = ['date', 'roi', 'ctr', 'conversion_rate']
    ordering = ['-date']
    
    def get_queryset(self):
        """Filter campaign metrics by user's organization"""
        user = self.request.user
        return CampaignMetric.objects.filter(
            campaign__organization=user.profile.organization
        )


class InsightViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Insight CRUD operations
    """
    permission_classes = [IsAuthenticated]
    queryset = Insight.objects.all()
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action in ['retrieve', 'update', 'partial_update']:
            return InsightDetailSerializer
        elif self.action == 'create':
            return InsightCreateSerializer
        return InsightListSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions"""
        user = self.request.user
        
        # Superusers can see all insights
        if user.is_superuser:
            return Insight.objects.all()
        
        # Regular users can see insights for retrospectives they have access to
        return Insight.objects.filter(
            retrospective__created_by=user
        )
    
    def perform_create(self, serializer):
        """Create insight with proper user assignment"""
        retrospective_id = self.request.data.get('retrospective_id')
        if not retrospective_id:
            raise ValueError("retrospective_id is required")
        
        retrospective = get_object_or_404(RetrospectiveTask, id=retrospective_id)
        serializer.save(
            retrospective=retrospective,
            created_by=self.request.user,
            generated_by='manual'
        )
    
    @action(detail=False, methods=['post'])
    def generate_insights(self, request):
        """Generate insights using rule engine"""
        serializer = InsightGenerationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        retrospective_id = serializer.validated_data['retrospective_id']
        regenerate = serializer.validated_data['regenerate']
        
        try:
            retrospective = RetrospectiveTask.objects.get(id=retrospective_id)
            
            # Check permissions
            if not request.user.is_superuser and retrospective.created_by != request.user:
                return Response(
                    {'error': 'Insufficient permissions'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Delete existing insights if regenerating
            if regenerate:
                Insight.objects.filter(retrospective=retrospective).delete()
            
            # Start Celery task for insight generation
            task = generate_insights_for_retrospective.delay(
                retrospective_id=retrospective_id,
                user_id=str(request.user.id)
            )
            
            return Response({
                'message': 'Insight generation started',
                'task_id': task.id,
                'retrospective_id': retrospective_id
            })
            
        except RetrospectiveTask.DoesNotExist:
            return Response(
                {'error': 'Retrospective not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'])
    def by_retrospective(self, request):
        """Get insights for a specific retrospective"""
        retrospective_id = request.query_params.get('retrospective_id')
        if not retrospective_id:
            return Response(
                {'error': 'retrospective_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            retrospective = RetrospectiveTask.objects.get(id=retrospective_id)
            
            # Check permissions
            if not request.user.is_superuser and retrospective.created_by != request.user:
                return Response(
                    {'error': 'Insufficient permissions'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            insights = Insight.objects.filter(
                retrospective=retrospective,
                is_active=True
            )
            serializer = InsightListSerializer(insights, many=True)
            return Response(serializer.data)
            
        except RetrospectiveTask.DoesNotExist:
            return Response(
                {'error': 'Retrospective not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'])
    def by_severity(self, request):
        """Get insights grouped by severity"""
        retrospective_id = request.query_params.get('retrospective_id')
        if not retrospective_id:
            return Response(
                {'error': 'retrospective_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            retrospective = RetrospectiveTask.objects.get(id=retrospective_id)
            
            # Check permissions
            if not request.user.is_superuser and retrospective.created_by != request.user:
                return Response(
                    {'error': 'Insufficient permissions'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            insights = Insight.objects.filter(
                retrospective=retrospective,
                is_active=True
            )
            
            # Group by severity
            severity_groups = {}
            for insight in insights:
                severity = insight.severity
                if severity not in severity_groups:
                    severity_groups[severity] = []
                severity_groups[severity].append(InsightListSerializer(insight).data)
            
            return Response(severity_groups)
            
        except RetrospectiveTask.DoesNotExist:
            return Response(
                {'error': 'Retrospective not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class RuleEngineViewSet(viewsets.ViewSet):
    """
    ViewSet for rule engine operations
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def rules(self, request):
        """Get all available rules"""
        rules = InsightRules.get_all_rules()
        return Response(rules)
    
    @action(detail=False, methods=['get'])
    def rule_definition(self, request):
        """Get specific rule definition"""
        rule_id = request.query_params.get('rule_id')
        if not rule_id:
            return Response(
                {'error': 'rule_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        rule_definition = InsightRules.get_rule_definition(rule_id)
        if not rule_definition:
            return Response(
                {'error': 'Rule not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response(rule_definition)
    
    @action(detail=False, methods=['post'])
    def test_rule(self, request):
        """Test a rule with specific KPI values"""
        rule_id = request.data.get('rule_id')
        kpi_value = request.data.get('kpi_value')
        
        if not rule_id or kpi_value is None:
            return Response(
                {'error': 'rule_id and kpi_value are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            kpi_value = float(kpi_value)
        except (ValueError, TypeError):
            return Response(
                {'error': 'kpi_value must be a number'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Test the rule based on rule_id
        rule_def = InsightRules.get_rule_definition(rule_id)
        if not rule_def:
            return Response(
                {'error': 'Rule not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Apply the appropriate rule function
        rule_functions = {
            'roi_poor': InsightRules.check_roi_threshold,
            'roi_critical': InsightRules.check_roi_threshold,
            'ctr_low': InsightRules.check_ctr_threshold,
            'cpc_high': InsightRules.check_cpc_threshold,
            'budget_overspend': InsightRules.check_budget_utilization,
            'conversion_rate_low': InsightRules.check_conversion_rate_threshold,
            'impression_share_low': InsightRules.check_impression_share_threshold
        }
        
        rule_function = rule_functions.get(rule_id)
        if not rule_function:
            return Response(
                {'error': 'Rule function not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        result = rule_function(kpi_value)
        return Response(result) 