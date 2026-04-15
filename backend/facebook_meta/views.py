from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.exceptions import NotFound,ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from .serializers import AdCreativeDetailSerializer, UpdateAndDeleteAdCreativeSerializer, CreateAdCreativeSerializer, ErrorResponseSerializer, AdCreativePhotoDataSerializer, AdCreativeVideoDataSerializer
from .models import AdCreative, AdCreativePhotoData, AdCreativeVideoData, AdCreativePreview
import time
import random
import os
import hashlib
import secrets
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from .services import (
    validate_numeric_string,
    validate_fields_param,
    validate_thumbnail_dimensions
    )

class AdCreativesView(generics.ListCreateAPIView):
    """
    Get and create ad creatives
    
    GET /facebook_meta/adcreatives
    POST /facebook_meta/adcreatives
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Use different serializers for GET and POST"""
        if self.request.method == 'POST':
            return CreateAdCreativeSerializer
        return AdCreativeDetailSerializer
    
    def get_queryset(self):
        """Return ad creatives owned by the authenticated user"""
        queryset = AdCreative.objects.select_related(
            'actor'
        ).prefetch_related(
            'ad_labels',
            'object_story_spec_link_data',
            'object_story_spec_photo_data',
            'object_story_spec_video_data',
            'object_story_spec_text_data',
            'object_story_spec_template_data'
        ).distinct().order_by('id')
        campaign_id = self.request.query_params.get('campaign_id')
        if campaign_id:
            queryset = queryset.filter(media_campaign_id=campaign_id)
        return queryset
    
    def list(self, request, *args, **kwargs):
        """Override list to apply field filtering"""
        # Validate fields parameter
        fields_param = request.GET.get('fields', '')
        try:
            requested_fields = validate_fields_param(fields_param)
        except ValidationError as e:
            return Response(
                ErrorResponseSerializer(
                    {"error": str(e), "code": "INVALID_FIELDS"}
                ).data ,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the standard paginated response
        response = super().list(request, *args, **kwargs)
        
        # Apply field filtering if requested
        if requested_fields and response.data.get('results'):
            filtered_results = []
            for ad_creative_data in response.data['results']:
                filtered_ad_creative = {}
                for field in requested_fields:
                    if field in ad_creative_data:
                        filtered_ad_creative[field] = ad_creative_data[field]
                filtered_results.append(filtered_ad_creative)
            response.data['results'] = filtered_results
        
        return response
    
    def create(self, request, *args, **kwargs):
        """Override create to match OpenAPI spec response"""
        try:
            # Validate request data
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    ErrorResponseSerializer(
                        {"error": "Invalid data", "code": "INVALID_DATA"}
                    ).data ,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generate unique numeric string ID

            unique_id = str(int(time.time() * 1000000) + random.randint(1000, 9999))
            
            # Create the ad creative with actor_id, and unique ID
            ad_creative = serializer.save(id=unique_id, actor=request.user)
            
            # Return success response according to OpenAPI spec
            return Response(
                {"data": {"id": str(ad_creative.id)}},
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            return Response(
                ErrorResponseSerializer(
                    {"error": "Internal server error", "code": "INTERNAL_ERROR"}
                ).data ,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AdCreativeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Unified view for GET, PATCH, DELETE operations on a single ad creative
    
    GET /facebook_meta/{ad_creative_id} - Get ad creative details
    PATCH /facebook_meta/{ad_creative_id} - Update ad creative
    DELETE /facebook_meta/{ad_creative_id} - Delete ad creative
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AdCreativeDetailSerializer
    lookup_field = 'id'
    
    def get_queryset(self):
        """Return the ad creative"""
        return AdCreative.objects.all()
    
    def get_object(self):
        """Override to handle ad_creative_id parameter and validation"""
        ad_creative_id = self.kwargs['ad_creative_id']
        
        # Validate ad_creative_id format
        if not validate_numeric_string(ad_creative_id):
            raise ValidationError("ad_creative_id must be a numeric string")
        
        try:
            return AdCreative.objects.get(id=ad_creative_id)
        except AdCreative.DoesNotExist:
            raise NotFound("Ad creative not found")
    
    def get_serializer_class(self):
        """Return appropriate serializer based on HTTP method"""
        if self.request.method in ['PATCH', 'PUT']:
            return UpdateAndDeleteAdCreativeSerializer
        return AdCreativeDetailSerializer
    
    def retrieve(self, request, *args, **kwargs):
        """Handle GET request - get ad creative details"""
        # Get and validate query parameters
        fields_param = request.GET.get('fields', '')
        thumbnail_width = request.GET.get('thumbnail_width')
        thumbnail_height = request.GET.get('thumbnail_height')
        
        # Convert thumbnail dimensions to integers if provided
        if thumbnail_width is not None:
            try:
                thumbnail_width = int(thumbnail_width)
            except ValueError:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "thumbnail_width must be an integer", "code": "INVALID_THUMBNAIL_WIDTH"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if thumbnail_height is not None:
            try:
                thumbnail_height = int(thumbnail_height)
            except ValueError:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "thumbnail_height must be an integer", "code": "INVALID_THUMBNAIL_HEIGHT"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate thumbnail dimensions
        try:
            validate_thumbnail_dimensions(thumbnail_width, thumbnail_height)
        except ValidationError as e:
            return Response(
                ErrorResponseSerializer(
                    {"error": str(e), "code": "INVALID_THUMBNAIL_DIMENSIONS"}
                ).data,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate fields parameter
        try:
            requested_fields = validate_fields_param(fields_param)
        except ValidationError as e:
            return Response(
                ErrorResponseSerializer(
                    {"error": str(e), "code": "INVALID_FIELDS"}
                ).data,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the ad creative (get_object handles validation and 404 errors)
        ad_creative = self.get_object()
        
        # Serialize the response
        serializer = self.get_serializer(ad_creative)
        response_data = serializer.data
        
        # Apply field filtering if requested
        if requested_fields:
            filtered_data = {}
            for field in requested_fields:
                if field in response_data:
                    filtered_data[field] = response_data[field]
            response_data = filtered_data
        
        # Apply thumbnail dimensions if provided
        if thumbnail_width or thumbnail_height:
            # Note: In a real implementation, you might want to modify thumbnail URLs
            # to include width/height parameters for dynamic resizing
            if 'thumbnail_url' in response_data and response_data['thumbnail_url']:
                # This is a placeholder - in practice you'd modify the URL or regenerate thumbnails
                pass
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    def update(self, request, *args, **kwargs):
        """Handle PATCH request - update ad creative"""
        # Get the ad creative (get_object handles validation and 404 errors)
        ad_creative = self.get_object()
        
        # Validate request data
        serializer = self.get_serializer(ad_creative, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                ErrorResponseSerializer(
                    {"error": "Invalid data", "code": "INVALID_DATA"}
                ).data,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update the ad creative
        serializer.save()
        
        # Return success response according to OpenAPI spec
        return Response(
            {"success": True},
            status=status.HTTP_200_OK
        )
    
    def destroy(self, request, *args, **kwargs):
        """Handle DELETE request - delete ad creative and related media files"""
        # Get the ad creative (get_object handles validation and 404 errors)
        ad_creative = self.get_object()
        
        # Clear the ManyToMany relationships first to remove junction table records
        ad_creative.object_story_spec_photo_data.clear()
        ad_creative.object_story_spec_video_data.clear()
        
        # Delete the ad creative
        ad_creative.delete()
        
        # Return success response according to OpenAPI spec
        return Response(
            {"success": True},
            status=status.HTTP_200_OK
        )
    
    def handle_exception(self, exc):
        """Custom exception handler to return expected error format"""
        
        if isinstance(exc, NotFound):
            return Response(
                ErrorResponseSerializer(
                    {"error": "AdCreative not found", "code": "NOT_FOUND"}
                ).data,
                status=status.HTTP_404_NOT_FOUND
            )
        elif isinstance(exc, ValidationError):
            return Response(
                ErrorResponseSerializer(
                    {"error": str(exc.detail), "code": "INVALID_ID_FORMAT"}
                ).data,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().handle_exception(exc)


@api_view(['GET'])
@permission_classes([])  # Public endpoint, no authentication required
def get_preview_by_token_public(request, token):
    """
    Get ad creative preview data by token (public endpoint)
    
    GET /facebook_meta/preview/{token}/public
    """
    try:
        # Get preview by token
        preview = AdCreativePreview.objects.filter(token=token).first()
        
        if not preview:
            return Response(
                ErrorResponseSerializer(
                    {"error": "Preview not found", "code": "PREVIEW_NOT_FOUND"}
                ).data,
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if preview has expired
        if preview.expires_at < timezone.now():
            return Response(
                ErrorResponseSerializer(
                    {"error": "Preview has expired", "code": "PREVIEW_EXPIRED"}
                ).data,
                status=status.HTTP_410_GONE
            )
        
        # Check if preview is active
        if preview.status != AdCreativePreview.ACTIVE:
            return Response(
                ErrorResponseSerializer(
                    {"error": "Preview is not active", "code": "PREVIEW_INACTIVE"}
                ).data,
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get the ad creative
        ad_creative = preview.ad_creative
        if not ad_creative:
            return Response(
                ErrorResponseSerializer(
                    {"error": "Ad creative not found", "code": "AD_CREATIVE_NOT_FOUND"}
                ).data,
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Serialize ad creative using the existing serializer
        serializer = AdCreativeDetailSerializer(ad_creative)
        
        # Calculate days left until expiration
        days_left = (preview.expires_at - timezone.now()).days
        
        # Return ad creative data with days_left
        response_data = serializer.data
        response_data['days_left'] = max(0, days_left)  # Ensure non-negative
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            ErrorResponseSerializer(
                {"error": f"Failed to fetch preview: {str(e)}", "code": "PREVIEW_FETCH_FAILED"}
            ).data,
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class PhotoUploadView(APIView):
    """
    Upload photo for ad creative
    
    POST /facebook_meta/photos/upload
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    MAX_FILE_BYTES = 30 * 1024 * 1024  # 30 MB for images
    
    def post(self, request):
        try:
            # Get uploaded file
            uploaded_file = request.FILES.get('file')
            if not uploaded_file:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "Missing file field 'file'.", "code": "MISSING_FILE"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate file size
            if uploaded_file.size > self.MAX_FILE_BYTES:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "File too large. Max 30MB.", "code": "FILE_TOO_LARGE"}
                    ).data,
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
                )
            
            # Validate file type (images only)
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
            if uploaded_file.content_type not in allowed_types:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "Invalid file type. Only images are allowed.", "code": "INVALID_FILE_TYPE"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Storage directory (no date folders)
            storage_dir_path = 'facebook_meta_photos'
            
            # Use original filename with conflict resolution
            original_filename = uploaded_file.name
            base_name, ext = os.path.splitext(original_filename)
            
            # Check for existing files and add (1), (2), etc. if needed
            storage_dir = getattr(settings, 'FILE_STORAGE_DIR', os.path.join(settings.BASE_DIR, 'media'))
            full_storage_path = os.path.join(storage_dir, storage_dir_path)
            os.makedirs(full_storage_path, exist_ok=True)
            
            final_filename = original_filename
            counter = 1
            while os.path.exists(os.path.join(full_storage_path, final_filename)):
                final_filename = f"{base_name}({counter}){ext}"
                counter += 1
            
            storage_key = os.path.join(storage_dir_path, final_filename)
            
            # Compute checksum and save file
            sha256 = hashlib.sha256()
            bytes_written = 0
            
            full_path = os.path.join(full_storage_path, final_filename)
            
            with open(full_path, 'wb') as dest:
                for chunk in uploaded_file.chunks():
                    sha256.update(chunk)
                    dest.write(chunk)
                    bytes_written += len(chunk)
            
            checksum_hex = sha256.hexdigest()
            
            # Generate URL for accessing the file
            file_url = f"/media/{storage_key}"
            
            # Get optional caption from request
            caption = request.data.get('caption', '')
            
            # Create AdCreativePhotoData record
            photo_data = AdCreativePhotoData.objects.create(
                url=file_url,
                caption=caption,
                image_hash=checksum_hex[:32]  # Use first 32 chars of checksum as hash
            )
            
            # Return simple success response
            return Response({"success": True}, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                ErrorResponseSerializer(
                    {"error": f"Internal server error: {str(e)}", "code": "INTERNAL_ERROR"}
                ).data,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PhotoListView(generics.ListAPIView):
    """
    List uploaded photos for ad creative
    
    GET /facebook_meta/photos
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AdCreativePhotoDataSerializer
    
    def get_queryset(self):
        """Return all photos, ordered by most recent first"""
        return AdCreativePhotoData.objects.all().order_by('-id')
    
    def list(self, request, *args, **kwargs):
        """Override list to return custom response format"""
        queryset = self.get_queryset()
        
        # Paginate
        page = self.paginate_queryset(queryset)
        if page is not None:
            photos_data = []
            for photo in page:
                photos_data.append({
                    "id": photo.id,
                    "url": photo.url,
                    "caption": photo.caption,
                    "image_hash": photo.image_hash,
                    "width": 1024,
                    "height": 1024
                })
            return self.get_paginated_response(photos_data)
        
        photos_data = []
        for photo in queryset:
            photos_data.append({
                "id": photo.id,
                "url": photo.url,
                "caption": photo.caption,
                "image_hash": photo.image_hash,
                "width": 1024,
                "height": 1024
            })
        
        return Response({
            "count": len(photos_data),
            "next": None,
            "previous": None,
            "results": photos_data
        }, status=status.HTTP_200_OK)


class VideoUploadView(APIView):
    """
    Upload video for ad creative
    
    POST /facebook_meta/videos/upload
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024  # 4 GB for videos
    
    def post(self, request):
        try:
            # Get uploaded file
            uploaded_file = request.FILES.get('file')
            if not uploaded_file:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "Missing file field 'file'.", "code": "MISSING_FILE"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate file size
            if uploaded_file.size > self.MAX_FILE_BYTES:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "File too large. Max 4GB.", "code": "FILE_TOO_LARGE"}
                    ).data,
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
                )
            
            # Validate file type (videos only)
            allowed_types = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/x-flv', 'video/webm']
            if uploaded_file.content_type not in allowed_types:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "Invalid file type. Only videos are allowed.", "code": "INVALID_FILE_TYPE"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Storage directory (no date folders)
            storage_dir_path = 'facebook_meta_videos'
            
            # Use original filename with conflict resolution
            original_filename = uploaded_file.name
            base_name, ext = os.path.splitext(original_filename)
            
            # Check for existing files and add (1), (2), etc. if needed
            storage_dir = getattr(settings, 'FILE_STORAGE_DIR', os.path.join(settings.BASE_DIR, 'media'))
            full_storage_path = os.path.join(storage_dir, storage_dir_path)
            os.makedirs(full_storage_path, exist_ok=True)
            
            final_filename = original_filename
            counter = 1
            while os.path.exists(os.path.join(full_storage_path, final_filename)):
                final_filename = f"{base_name}({counter}){ext}"
                counter += 1
            
            storage_key = os.path.join(storage_dir_path, final_filename)
            
            # Compute checksum and save file
            sha256 = hashlib.sha256()
            bytes_written = 0
            
            full_path = os.path.join(full_storage_path, final_filename)
            
            with open(full_path, 'wb') as dest:
                for chunk in uploaded_file.chunks():
                    sha256.update(chunk)
                    dest.write(chunk)
                    bytes_written += len(chunk)
            
            checksum_hex = sha256.hexdigest()
            
            # Generate URL for accessing the file
            file_url = f"/media/{storage_key}"
            
            # Get optional title and message from request
            title = request.data.get('title', '')
            message = request.data.get('message', '')
            
            # Create AdCreativeVideoData record
            video_data = AdCreativeVideoData.objects.create(
                image_url=file_url,  # Using image_url to store video file path
                title=title,
                message=message,
                video_id=checksum_hex[:32]  # Use first 32 chars of checksum as video_id
            )
            
            # Return simple success response
            return Response({"success": True}, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                ErrorResponseSerializer(
                    {"error": f"Internal server error: {str(e)}", "code": "INTERNAL_ERROR"}
                ).data,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VideoListView(generics.ListAPIView):
    """
    List uploaded videos for ad creative
    
    GET /facebook_meta/videos
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AdCreativeVideoDataSerializer
    
    def get_queryset(self):
        """Return all videos, ordered by most recent first"""
        return AdCreativeVideoData.objects.all().order_by('-id')
    
    def list(self, request, *args, **kwargs):
        """Override list to return custom response format"""
        queryset = self.get_queryset()
        
        # Paginate
        page = self.paginate_queryset(queryset)
        if page is not None:
            videos_data = []
            for video in page:
                videos_data.append({
                    "id": video.id,
                    "url": video.image_url,  # Using image_url field which stores video file path
                    "title": video.title,
                    "message": video.message,
                    "video_id": video.video_id,
                })
            return self.get_paginated_response(videos_data)
        
        videos_data = []
        for video in queryset:
            videos_data.append({
                "id": video.id,
                "url": video.image_url,  # Using image_url field which stores video file path
                "title": video.title,
                "message": video.message,
                "video_id": video.video_id,
            })
        
        return Response({
            "count": len(videos_data),
            "next": None,
            "previous": None,
            "results": videos_data
        }, status=status.HTTP_200_OK)


class AssociateMediaToAdCreativeView(APIView):
    """
    API endpoint to associate media files with an ad creative
    
    POST /facebook_meta/{ad_creative_id}/associate-media/ - Associate media files with ad creative
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, ad_creative_id):
        """Associate media files with an ad creative"""
        # Validate ad_creative_id format
        if not validate_numeric_string(ad_creative_id):
            return Response(
                ErrorResponseSerializer(
                    {"error": "ad_creative_id must be a numeric string", "code": "INVALID_AD_CREATIVE_ID"}
                ).data,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            ad_creative = AdCreative.objects.get(id=ad_creative_id)
        except AdCreative.DoesNotExist:
            return Response(
                ErrorResponseSerializer(
                    {"error": "Ad creative not found", "code": "AD_CREATIVE_NOT_FOUND"}
                ).data,
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get media file IDs from request
        photo_ids = request.data.get('photo_ids', [])
        video_ids = request.data.get('video_ids', [])
        
        # Initialize empty querysets
        photos = AdCreativePhotoData.objects.none()
        videos = AdCreativeVideoData.objects.none()
        
        # Validate that at least one media type is provided in the request
        # (even if empty arrays are allowed to clear existing relationships)
        if 'photo_ids' not in request.data and 'video_ids' not in request.data:
            return Response(
                ErrorResponseSerializer(
                    {"error": "At least one of photo_ids or video_ids must be provided in request", "code": "NO_MEDIA_PROVIDED"}
                ).data,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate photo IDs and get photo objects
        if photo_ids:
            if not isinstance(photo_ids, list):
                return Response(
                    ErrorResponseSerializer(
                        {"error": "photo_ids must be an array", "code": "INVALID_PHOTO_IDS_FORMAT"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                photos = AdCreativePhotoData.objects.filter(id__in=photo_ids)
                if len(photos) != len(photo_ids):
                    missing_ids = set(photo_ids) - set(photo.id for photo in photos)
                    return Response(
                        ErrorResponseSerializer(
                            {"error": f"Photo(s) not found: {list(missing_ids)}", "code": "PHOTOS_NOT_FOUND"}
                        ).data,
                        status=status.HTTP_404_NOT_FOUND
                    )
            except Exception as e:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "Invalid photo ID format", "code": "INVALID_PHOTO_ID_FORMAT"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate video IDs and get video objects
        if video_ids:
            if not isinstance(video_ids, list):
                return Response(
                    ErrorResponseSerializer(
                        {"error": "video_ids must be an array", "code": "INVALID_VIDEO_IDS_FORMAT"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                videos = AdCreativeVideoData.objects.filter(id__in=video_ids)
                if len(videos) != len(video_ids):
                    missing_ids = set(video_ids) - set(video.id for video in videos)
                    return Response(
                        ErrorResponseSerializer(
                            {"error": f"Video(s) not found: {list(missing_ids)}", "code": "VIDEOS_NOT_FOUND"}
                        ).data,
                        status=status.HTTP_404_NOT_FOUND
                    )
            except Exception as e:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "Invalid video ID format", "code": "INVALID_VIDEO_ID_FORMAT"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Associate media files with ad creative
        try:
            # Always update photo relationships (even if empty array to clear existing)
            if 'photo_ids' in request.data:
                ad_creative.object_story_spec_photo_data.set(photos)
            
            # Always update video relationships (even if empty array to clear existing)
            if 'video_ids' in request.data:
                ad_creative.object_story_spec_video_data.set(videos)
            
            return Response({
                "success": True,
                "message": "Media files associated successfully",
                "ad_creative_id": ad_creative_id,
                "associated_photos": len(photos) if 'photo_ids' in request.data else 0,
                "associated_videos": len(videos) if 'video_ids' in request.data else 0
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            # Log the actual error for debugging
            print(f"Association error: {str(e)}")
            return Response(
                ErrorResponseSerializer(
                    {"error": f"Failed to associate media files: {str(e)}", "code": "ASSOCIATION_FAILED"}
                ).data,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SharePreviewView(APIView):
    """
    Create or retrieve share preview links for ad creatives
    
    POST /facebook_meta/{ad_creative_id}/share-preview/
    GET /facebook_meta/{ad_creative_id}/share-preview/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, ad_creative_id):
        """Create a new share preview link"""
        try:
            # Validate ad_creative_id
            try:
                ad_creative = AdCreative.objects.get(id=ad_creative_id)
            except AdCreative.DoesNotExist:
                return Response(
                    ErrorResponseSerializer(
                        {"error": f"Ad creative with id '{ad_creative_id}' not found", "code": "AD_CREATIVE_NOT_FOUND"}
                    ).data,
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get days from request (required)
            days = request.data.get('days')
            if not days:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "days parameter is required", "code": "MISSING_DAYS"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                days_int = int(days)
                if days_int not in [7, 14, 30]:
                    return Response(
                        ErrorResponseSerializer(
                            {"error": "days must be either 7, 14, or 30", "code": "INVALID_DAYS"}
                        ).data,
                        status=status.HTTP_400_BAD_REQUEST
                    )
                expires_at = timezone.now() + timedelta(days=days_int)
            except (ValueError, TypeError):
                return Response(
                    ErrorResponseSerializer(
                        {"error": "Invalid days value", "code": "INVALID_DAYS"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generate unique token
            token = secrets.token_urlsafe(32)
            
            # Generate preview link
            base_url = request.build_absolute_uri('/')[:-1]  # Remove trailing slash
            link = f"{base_url}/ads/previewer/facebook_meta/{token}/"
            
            # Check if there's an existing preview for this ad creative (regardless of status)
            existing_preview = AdCreativePreview.objects.filter(
                ad_creative=ad_creative
            ).first()
            
            if existing_preview:
                # Preview already exists
                return Response(
                    ErrorResponseSerializer(
                        {"error": "Preview already exists", "code": "PREVIEW_ALREADY_EXISTS"}
                    ).data,
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                # Create new preview
                preview = AdCreativePreview.objects.create(
                    ad_creative=ad_creative,
                    token=token,
                    link=link,
                    expires_at=expires_at,
                    days_active=days_int,
                    status=AdCreativePreview.ACTIVE
                )
            
            # Calculate days left
            days_left = (preview.expires_at - timezone.now()).days
            
            return Response({
                "link": preview.link,
                "days_active": preview.days_active,
                "days_left": max(0, days_left)  # Ensure non-negative
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                ErrorResponseSerializer(
                    {"error": f"Failed to create share preview: {str(e)}", "code": "PREVIEW_CREATION_FAILED"}
                ).data,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get(self, request, ad_creative_id):
        """Get all active share preview links for an ad creative"""
        try:
            # Validate ad_creative_id
            try:
                ad_creative = AdCreative.objects.get(id=ad_creative_id)
            except AdCreative.DoesNotExist:
                return Response(
                    ErrorResponseSerializer(
                        {"error": f"Ad creative with id '{ad_creative_id}' not found", "code": "AD_CREATIVE_NOT_FOUND"}
                    ).data,
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get the preview for this ad creative (should only be one due to unique constraint)
            preview = AdCreativePreview.objects.filter(ad_creative=ad_creative).first()
            
            if preview:
                # Calculate days left
                days_left = (preview.expires_at - timezone.now()).days
                
                return Response({
                    "link": preview.link,
                    "days_active": preview.days_active,
                    "days_left": max(0, days_left)  # Ensure non-negative
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    "link": None,
                    "days_active": None,
                    "days_left": None
                }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                ErrorResponseSerializer(
                    {"error": f"Failed to retrieve share previews: {str(e)}", "code": "PREVIEW_RETRIEVAL_FAILED"}
                ).data,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request, ad_creative_id):
        """Delete the share preview link for an ad creative"""
        try:
            # Validate ad_creative_id
            try:
                ad_creative = AdCreative.objects.get(id=ad_creative_id)
            except AdCreative.DoesNotExist:
                return Response(
                    ErrorResponseSerializer(
                        {"error": f"Ad creative with id '{ad_creative_id}' not found", "code": "AD_CREATIVE_NOT_FOUND"}
                    ).data,
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get the preview for this ad creative
            preview = AdCreativePreview.objects.filter(ad_creative=ad_creative).first()
            
            if preview:
                preview.delete()
                return Response({"message": "Preview deleted successfully"}, status=status.HTTP_200_OK)
            else:
                return Response(
                    ErrorResponseSerializer(
                        {"error": "No preview found to delete", "code": "PREVIEW_NOT_FOUND"}
                    ).data,
                    status=status.HTTP_404_NOT_FOUND
                )
            
        except Exception as e:
            return Response(
                ErrorResponseSerializer(
                    {"error": f"Failed to delete share preview: {str(e)}", "code": "PREVIEW_DELETION_FAILED"}
                ).data,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
