from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from .models import (
    Campaign,
    CampaignComment,
    Template,
    TemplateDefaultContent,
    ensure_shared_default_template,
)
from .serializers import (
    CampaignSerializer,
    TemplateSerializer,
    TemplateCreateUpdateSerializer,
    CampaignCommentSerializer,
)

class EmailDraftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing email drafts (Campaigns).
    Provides CRUD operations for email drafts with template management.
    """
    serializer_class = CampaignSerializer
    lookup_field = 'id'
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter campaigns by the authenticated user"""
        queryset = Campaign.objects.filter(
            user=self.request.user
        ).select_related(
            'settings', 
            'settings__template', 
            'settings__template__default_content'
        ).prefetch_related(
            'recipients',
            'variate_settings',
            'tracking',
            'rss_opts',
            'ab_split_opts',
            'social_card',
            'report_summary',
            'delivery_status',
            'resend_shortcut_eligibility',
            'resend_shortcut_usage'
        )
        campaign_id = self.request.query_params.get('campaign_id')
        if campaign_id:
            queryset = queryset.filter(media_campaign_id=campaign_id)
        return queryset

    def perform_create(self, serializer):
        """Set the user when creating a new campaign"""
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Create a new email draft"""
        try:
            with transaction.atomic():
                serializer = self.get_serializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                self.perform_create(serializer)
                headers = self.get_success_headers(serializer.data)
                return Response(
                    serializer.data, 
                    status=status.HTTP_201_CREATED, 
                    headers=headers
                )
        except Exception as e:
            return Response(
                {'error': f'Failed to create email draft: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    def retrieve(self, request, *args, **kwargs):
        """Get a specific email draft"""
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        except Campaign.DoesNotExist:
            return Response(
                {'error': 'Email draft not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    def update(self, request, *args, **kwargs):
        """Update an email draft"""
        try:
            with transaction.atomic():
                partial = kwargs.pop('partial', False)
                instance = self.get_object()
                serializer = self.get_serializer(instance, data=request.data, partial=partial)
                serializer.is_valid(raise_exception=True)
                self.perform_update(serializer)
                return Response(serializer.data)
        except Exception as e:
            if 'No Campaign matches the given query' in str(e):
                return Response(
                    {'error': 'Email draft not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            return Response(
                {'error': f'Failed to update email draft: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, *args, **kwargs):
        """Delete an email draft"""
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Campaign.DoesNotExist:
            return Response(
                {'error': 'Email draft not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    def list(self, request, *args, **kwargs):
        """List all email drafts for the authenticated user"""
        try:
            queryset = self.filter_queryset(self.get_queryset())
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Failed to list email drafts: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, id=None):
        """List or create comments for a draft."""
        campaign = self.get_object()

        if request.method.lower() == 'get':
            status_filter = request.query_params.get('status')
            comments = campaign.comments.all()
            if status_filter in dict(CampaignComment.Status.choices):
                comments = comments.filter(status=status_filter)
            serializer = CampaignCommentSerializer(comments, many=True)
            return Response(serializer.data)

        serializer = CampaignCommentSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(campaign=campaign, author=request.user)
        return Response(
            CampaignCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED
        )

    @action(
        detail=True,
        methods=['patch'],
        url_path='comments/(?P<comment_id>[^/.]+)'
    )
    def update_comment(self, request, id=None, comment_id=None):
        """Update comment status (resolve or reopen)."""
        campaign = self.get_object()
        try:
            comment = campaign.comments.get(pk=comment_id)
        except CampaignComment.DoesNotExist:
            return Response(
                {'error': 'Comment not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        new_status = request.data.get('status')
        valid_statuses = {choice[0] for choice in CampaignComment.Status.choices}
        if new_status not in valid_statuses:
            return Response(
                {'error': 'Invalid status value'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == CampaignComment.Status.RESOLVED:
            comment.status = CampaignComment.Status.RESOLVED
            comment.resolved_by = request.user
            comment.resolved_at = timezone.now()
        else:
            comment.status = CampaignComment.Status.OPEN
            comment.resolved_by = None
            comment.resolved_at = None
        comment.save()

        return Response(CampaignCommentSerializer(comment).data)

    @action(detail=True, methods=['get'])
    def preview(self, request, id=None):
        """Preview the email draft content"""
        try:
            campaign = self.get_object()
            settings = getattr(campaign, 'settings', None)
            template = getattr(settings, 'template', None)
            default_content = getattr(template, 'default_content', None)

            if not settings:
                return Response(
                    {'error': 'Campaign settings missing.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            data = {
                "subject_line": settings.subject_line,
                "preview_text": settings.preview_text,
                "from_name": settings.from_name,
                "reply_to": settings.reply_to,
                "sections": [],
            }

            if template and default_content and hasattr(default_content, 'sections'):
                if isinstance(default_content.sections, dict):
                    # Handle dict format
                    for key, content in default_content.sections.items():
                        data["sections"].append({
                            "content": content,
                            "type": "text",
                        })
                elif isinstance(default_content.sections, list):
                    # Handle list format
                    for section in default_content.sections:
                        if isinstance(section, dict):
                            data["sections"].append({
                                "content": section.get("content", ""),
                                "type": section.get("type", "text"),
                            })
                        else:
                            data["sections"].append({
                                "content": str(section),
                                "type": "text",
                            })

            return Response(data, status=status.HTTP_200_OK)
        except Campaign.DoesNotExist:
            return Response(
                {'error': 'Email draft not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def templates(self, request):
        """List available templates (deprecated - use TemplateViewSet instead)"""
        try:
            has_templates = Template.objects.filter(
                Q(user=request.user) | Q(user__isnull=True),
                active=True,
            ).exists()
            if not has_templates:
                ensure_shared_default_template()

            templates = Template.objects.filter(active=True).filter(
                Q(user=request.user) | Q(user__isnull=True)
            )
            serializer = TemplateSerializer(templates, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Failed to list templates: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['patch'], url_path='template-content')
    def update_template_content(self, request, id=None):
        """
        Update the template content (sections) for a campaign.
        This only updates the template, not the campaign settings.
        Also updates template name from campaign's subject_line and thumbnail.
        """
        try:
            campaign = self.get_object()
            settings = getattr(campaign, 'settings', None)
            if not settings:
                return Response(
                    {'error': 'Campaign settings not found'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            template = getattr(settings, 'template', None)
            if not template:
                return Response(
                    {'error': 'Template not found for this campaign'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update template content
            template_data = request.data.get('template_data', {})
            if not template_data:
                return Response(
                    {'error': 'template_data is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            with transaction.atomic():
                # Get template info from request data (nested structure)
                template_info = template_data.get('template', {})
                
                # Flatten the nested structure for TemplateCreateUpdateSerializer
                # TemplateCreateUpdateSerializer expects flat structure: { name, thumbnail, default_content: {...} }
                # not nested: { template: { name, thumbnail }, default_content: {...} }
                flattened_data = {}
                
                # Add template fields to flattened structure
                if template_info:
                    flattened_data.update(template_info)
                
                # Always update template name from campaign's subject_line (for save and exit)
                campaign_name = settings.subject_line or settings.title
                if campaign_name:
                    flattened_data['name'] = campaign_name
                
                # Add default_content if present
                if 'default_content' in template_data:
                    flattened_data['default_content'] = template_data['default_content']
                
                # Update template using TemplateCreateUpdateSerializer
                template_serializer = TemplateCreateUpdateSerializer(
                    template,
                    data=flattened_data,
                    partial=True,
                    context={'request': request}
                )
                template_serializer.is_valid(raise_exception=True)
                updated_template = template_serializer.save()
                
                # Return updated template
                read_serializer = TemplateSerializer(updated_template)
                return Response(read_serializer.data)
        except Campaign.DoesNotExist:
            return Response(
                {'error': 'Campaign not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to update template content: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class TemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Templates independently.
    Templates are completely separate from Campaigns.
    """
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        """Filter templates by the authenticated user or shared templates, only active ones"""
        return Template.objects.filter(
            Q(user=self.request.user) | Q(user__isnull=True),
            active=True
        ).select_related('default_content')

    def get_serializer_class(self):
        """Use different serializers for read vs write operations"""
        if self.action in ['create', 'update', 'partial_update']:
            return TemplateCreateUpdateSerializer
        return TemplateSerializer

    def create(self, request, *args, **kwargs):
        """Create a new template"""
        try:
            with transaction.atomic():
                serializer = self.get_serializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                instance = serializer.save()
                # Return with read serializer
                read_serializer = TemplateSerializer(instance)
                headers = self.get_success_headers(read_serializer.data)
                return Response(
                    read_serializer.data,
                    status=status.HTTP_201_CREATED,
                    headers=headers
                )
        except Exception as e:
            return Response(
                {'error': f'Failed to create template: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def update(self, request, *args, **kwargs):
        """Update a template"""
        try:
            with transaction.atomic():
                partial = kwargs.pop('partial', False)
                instance = self.get_object()
                serializer = self.get_serializer(instance, data=request.data, partial=partial)
                serializer.is_valid(raise_exception=True)
                instance = serializer.save()
                # Return with read serializer
                read_serializer = TemplateSerializer(instance)
                return Response(read_serializer.data)
        except Template.DoesNotExist:
            return Response(
                {'error': 'Template not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to update template: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def list(self, request, *args, **kwargs):
        """List all templates for the authenticated user"""
        try:
            # Ensure default template exists
            has_templates = Template.objects.filter(
                Q(user=request.user) | Q(user__isnull=True),
                active=True,
            ).exists()
            if not has_templates:
                ensure_shared_default_template()

            queryset = self.filter_queryset(self.get_queryset())
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Failed to list templates: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
