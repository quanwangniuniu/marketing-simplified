import hashlib
from rest_framework import serializers
from django.core.exceptions import ValidationError
from .models import Asset, AssetVersion, AssetComment, ReviewAssignment, AssetStateTransition


class AssetSerializer(serializers.ModelSerializer):
    """Serializer for Asset model"""
    tags = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="List of tags as strings"
    )
    owner = serializers.SerializerMethodField()

    def get_owner(self, obj):
        u = obj.owner
        if not u:
            return None
        return u.get_full_name().strip() or u.username or u.email

    class Meta:
        model = Asset
        fields = [
            'id', 'task', 'owner', 'team', 'status',
            'tags', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner', 'status', 'created_at', 'updated_at']
    

class AssetVersionSerializer(serializers.ModelSerializer):
    """Serializer for AssetVersion model"""
    
    class Meta:
        model = AssetVersion
        fields = [
            'id', 'asset', 'version_number', 'file', 
            'uploaded_by', 'checksum', 'version_status', 'scan_status', 'created_at'
        ]
        read_only_fields = ['id', 'asset', 'version_number', 'uploaded_by', 'created_at', 'checksum', 'version_status', 'scan_status']
    
    def validate(self, attrs):
        # for creation, file is required
        file_obj = attrs.get('file')
        if file_obj is None:
            raise serializers.ValidationError("File is required for asset version creation.")
        
        # Validate the asset can create a new version
        asset = attrs.get('asset')
        if asset:
            try:
                asset.validate_can_create_version()
            except ValidationError as e:
                raise serializers.ValidationError({
                    'asset': f"Unable to create new version: {str(e)}"
                })
        
        return attrs
    
    def create(self, validated_data):
        """Create a new version using the model's create_new_version method"""
        file_obj = validated_data.pop('file', None)
        return AssetVersion().create_new_version(file_obj=file_obj, **validated_data)
    
    def update(self, instance, validated_data):
        """Update version using the model's update_with_file method"""
        file_obj = validated_data.pop('file', None)
        return instance.update_with_file(file_obj, **validated_data)


class AssetCommentSerializer(serializers.ModelSerializer):
    """Serializer for AssetComment model"""
    
    class Meta:
        model = AssetComment
        fields = ['id', 'asset', 'user', 'body', 'created_at']
        read_only_fields = ['id', 'asset', 'user', 'created_at']


class ReviewAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for ReviewAssignment model"""
    
    class Meta:
        model = ReviewAssignment
        fields = [
            'id', 'asset', 'user', 'role', 'assigned_by', 
            'assigned_at', 'valid_until'
        ]
        read_only_fields = ['id', 'asset', 'assigned_by', 'assigned_at']


class AssetReviewSerializer(serializers.Serializer):
    """Serializer for asset review actions"""
    action = serializers.ChoiceField(
        choices=['start_review', 'approve', 'reject', 'acknowledge_rejection', 'archive'],
        help_text="Review action to perform"
    )
    comment = serializers.CharField(required=False, allow_blank=True, help_text="Optional comment")


class BulkReviewItemSerializer(serializers.Serializer):
    """Serializer for individual review items in bulk operations"""
    asset_id = serializers.IntegerField(help_text="ID of the asset to review")
    action = serializers.ChoiceField(
        choices=['approve', 'reject', 'start_review', 'archive'],
        help_text="Review action to perform"
    )

class BulkReviewSerializer(serializers.Serializer):
    """Serializer for bulk review actions"""
    reviews = BulkReviewItemSerializer(many=True, min_length=1) 