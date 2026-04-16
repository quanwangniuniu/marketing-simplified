import os
import hashlib
import io
import requests
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from PIL import Image, UnidentifiedImageError

from .models import EmailDraft, Workflow, WorkflowExecutionLog, KlaviyoImage
from .serializers import (
    EmailDraftSerializer,
    EmailDraftCreateSerializer,
    EmailDraftUpdateSerializer,
    WorkflowSerializer,
    WorkflowCreateSerializer,
    KlaviyoImageSerializer,
)

# Constants
ALLOWED_IMAGE_MIME_TYPES = {
    'image/jpeg', 'image/png', 'image/webp', 'image/gif'
}
IMAGE_MAX_BYTES = 10 * 1024 * 1024  # 10MB limit for images
MIN_DIMENSION = 1


class EmailDraftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for EmailDraft CRUD.

    Supports:
    - GET    /api/klaviyo/klaviyo-drafts/        (list)
    - POST   /api/klaviyo/klaviyo-drafts/        (create)
    - GET    /api/klaviyo/klaviyo-drafts/{id}/   (retrieve)
    - PUT    /api/klaviyo/klaviyo-drafts/{id}/   (update)
    - PATCH  /api/klaviyo/klaviyo-drafts/{id}/   (partial_update)
    - DELETE /api/klaviyo/klaviyo-drafts/{id}/   (destroy)
    """
    permission_classes = [IsAuthenticated] 

    def get_queryset(self):
        """
        Optionally scope drafts to the authenticated user and exclude soft-deleted ones.
        """
        qs = EmailDraft.objects.filter(is_deleted=False).prefetch_related('blocks')

        user = getattr(self.request, "user", None)
        if user and user.is_authenticated:
            qs = qs.filter(user=user)

        campaign_id = self.request.query_params.get('campaign_id')
        if campaign_id:
            qs = qs.filter(media_campaign_id=campaign_id)

        return qs

    def get_serializer_class(self):
        """
        Use different serializers for read vs write operations.
        """
        if self.action == "create":
            return EmailDraftCreateSerializer
        if self.action in ("update", "partial_update"):
            return EmailDraftUpdateSerializer
        return EmailDraftSerializer

    def perform_create(self, serializer):
        """
        Default the user to request.user if not explicitly provided.
        """
        user = getattr(self.request, "user", None)

        if "user" not in serializer.validated_data and user and user.is_authenticated:
            serializer.save(user=user)
        else:
            serializer.save()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    def perform_update(self, serializer):
        """
        When the draft status changes, log an execution event
        into active workflows (simple trigger example).
        """
        instance_before = self.get_object()
        old_status = instance_before.status

        instance = serializer.save()

        if old_status != instance.status:
            self._log_status_change(instance, old_status)

    def perform_destroy(self, instance):
        """
        Soft-delete the draft by marking is_deleted=True.
        """
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])

    def _log_status_change(self, draft: EmailDraft, old_status: str) -> None:
        """
        Simple trigger: whenever a draft's status changes,
        create a WorkflowExecutionLog entry for all active workflows.

        This satisfies:
        - "Trigger logic works for draft status changes"
        - "Workflows store execution logs"
        """
        active_workflows = Workflow.objects.filter(is_active=True, is_deleted=False)

        for workflow in active_workflows:
            WorkflowExecutionLog.objects.create(
                workflow=workflow,
                event=f"Draft {draft.id} status changed from {old_status} to {draft.status}",
            )

class WorkflowViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Workflow CRUD.

    Supports:
    - GET    /api/klaviyo/klaviyo-workflows/        (list)
    - POST   /api/klaviyo/klaviyo-workflows/        (create)
    - GET    /api/klaviyo/klaviyo-workflows/{id}/   (retrieve)
    - PUT    /api/klaviyo/klaviyo-workflows/{id}/   (update)
    - PATCH  /api/klaviyo/klaviyo-workflows/{id}/   (partial_update)
    - DELETE /api/klaviyo/klaviyo-workflows/{id}/   (destroy)
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Return non-deleted workflows only.
        """
        return Workflow.objects.filter(is_deleted=False)

    def get_serializer_class(self):
        """
        Use write-optimised serializer for create/update, and
        read serializer for list/retrieve.
        """
        if self.action in ("create", "update", "partial_update"):
            return WorkflowCreateSerializer
        return WorkflowSerializer

    def perform_destroy(self, instance):
        """
        Soft-delete workflow by marking is_deleted=True.
        """
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])


# Image upload and management views
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_image(request):
    """Upload image for Klaviyo email builder."""
    try:
        # Validate required fields
        if 'file' not in request.FILES:
            return Response({
                'error': 'file is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        name = request.data.get('name', file.name)
        original_filename = request.data.get('original_filename', file.name)
        
        # Validate file type
        mime_type = file.content_type or ''
        if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
            return Response({
                'error': f'Only {", ".join(sorted(ALLOWED_IMAGE_MIME_TYPES))} files are supported'
            }, status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
        
        # Validate file size
        if file.size > IMAGE_MAX_BYTES:
            return Response({
                'error': 'File exceeds max size: 10MB'
            }, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        
        # Generate MD5 hash
        file_content = file.read()
        file.seek(0)
        md5_hash = hashlib.md5(file_content).hexdigest()
        
        # Check for duplicate files
        existing_image = KlaviyoImage.objects.filter(md5=md5_hash).first()
        if existing_image:
            serializer = KlaviyoImageSerializer(existing_image)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        # Read image dimensions using Pillow
        try:
            with Image.open(io.BytesIO(file_content)) as img:
                width, height = img.size
        except UnidentifiedImageError:
            return Response({
                'error': 'Invalid image file'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Reject zero or invalid dimensions
        if (width or 0) < MIN_DIMENSION or (height or 0) < MIN_DIMENSION or width == 0 or height == 0:
            return Response({
                'error': 'Image dimensions must be greater than 0'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate storage path and save file
        file_extension = os.path.splitext(file.name)[1]
        storage_filename = f"klaviyo/images/{md5_hash}{file_extension}"
        storage_path = default_storage.save(storage_filename, ContentFile(file_content))
        
        # Generate preview URL
        preview_url = f"{settings.MEDIA_URL}{storage_path}"
        
        # Create KlaviyoImage record
        klaviyo_image = KlaviyoImage.objects.create(
            name=name,
            storage_path=storage_path,
            original_filename=original_filename,
            mime_type=mime_type,
            size_bytes=file.size,
            width=width,
            height=height,
            md5=md5_hash,
            preview_url=preview_url,
            scan_status=KlaviyoImage.INCOMING,
            uploaded_by=request.user
        )
        
        # Virus scanning will be triggered automatically by signal (if configured)
        
        serializer = KlaviyoImageSerializer(klaviyo_image)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': f'Upload failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_images(request):
    """Get list of uploaded images with pagination, search, and sorting."""
    try:
        # Get query parameters
        search = request.query_params.get('search', '').strip()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        sort_order = request.query_params.get('sort', 'desc')  # desc or asc
        
        # Validate parameters
        if page < 1:
            return Response({
                'error': 'page must be >= 1'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if page_size < 1 or page_size > 100:
            return Response({
                'error': 'page_size must be between 1 and 100'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Build queryset
        queryset = KlaviyoImage.objects.filter(uploaded_by=request.user)
        
        # Apply search filter
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(original_filename__icontains=search) |
                Q(id__icontains=search)
            )
        
        # Order by creation date
        if sort_order == 'asc':
            queryset = queryset.order_by('created_at')
        else:
            queryset = queryset.order_by('-created_at')
        
        # Calculate pagination
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        
        # Get items for current page
        items_queryset = queryset[start:end]
        
        # Serialize items
        serializer = KlaviyoImageSerializer(items_queryset, many=True)
        
        # Build response
        response_data = {
            'results': serializer.data,
            'count': total,
            'page': page,
            'page_size': page_size
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response({
            'error': f'Invalid parameter: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'error': f'Failed to retrieve images: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_image_from_url(request):
    """Import image from URL for Klaviyo email builder."""
    try:
        # Validate required fields
        url = request.data.get('url')
        if not url:
            return Response({
                'error': 'url is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        name = request.data.get('name', 'Imported image')
        
        # Download image from URL
        try:
            response = requests.get(url, timeout=30, stream=True)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '').split(';')[0].strip()
            if content_type not in ALLOWED_IMAGE_MIME_TYPES:
                return Response({
                    'error': f'URL does not point to a supported image type. Got: {content_type}'
                }, status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
            
            # Read content
            file_content = response.content
            
            # Validate file size
            if len(file_content) > IMAGE_MAX_BYTES:
                return Response({
                    'error': 'File exceeds max size: 10MB'
                }, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
            
        except requests.exceptions.RequestException as e:
            return Response({
                'error': f'Failed to download image from URL: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate MD5 hash
        md5_hash = hashlib.md5(file_content).hexdigest()
        
        # Check for duplicate files
        existing_image = KlaviyoImage.objects.filter(md5=md5_hash).first()
        if existing_image:
            serializer = KlaviyoImageSerializer(existing_image)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        # Read image dimensions
        try:
            with Image.open(io.BytesIO(file_content)) as img:
                width, height = img.size
        except UnidentifiedImageError:
            return Response({
                'error': 'Invalid image file'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Reject zero or invalid dimensions
        if (width or 0) < MIN_DIMENSION or (height or 0) < MIN_DIMENSION or width == 0 or height == 0:
            return Response({
                'error': 'Image dimensions must be greater than 0'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Determine file extension from content type or URL
        from urllib.parse import urlparse
        parsed_url = urlparse(url)
        
        file_extension = '.jpg'
        if 'png' in content_type:
            file_extension = '.png'
        elif 'webp' in content_type:
            file_extension = '.webp'
        elif 'gif' in content_type:
            file_extension = '.gif'
        else:
            # Try to get extension from URL
            path_ext = os.path.splitext(parsed_url.path)[1]
            if path_ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
                file_extension = path_ext
        
        original_filename = os.path.basename(parsed_url.path) or f'imported_image{file_extension}'
        
        # Generate storage path and save file
        storage_filename = f"klaviyo/images/{md5_hash}{file_extension}"
        storage_path = default_storage.save(storage_filename, ContentFile(file_content))
        
        # Generate preview URL
        preview_url = f"{settings.MEDIA_URL}{storage_path}"
        
        # Create KlaviyoImage record
        klaviyo_image = KlaviyoImage.objects.create(
            name=name,
            storage_path=storage_path,
            original_filename=original_filename,
            mime_type=content_type,
            size_bytes=len(file_content),
            width=width,
            height=height,
            md5=md5_hash,
            preview_url=preview_url,
            scan_status=KlaviyoImage.INCOMING,
            uploaded_by=request.user
        )
        
        serializer = KlaviyoImageSerializer(klaviyo_image)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': f'Import failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)