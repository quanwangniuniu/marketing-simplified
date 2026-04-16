from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    AdLabel, AdCreative, AdCreativePhotoData,
    AdCreativeTextData, AdCreativeVideoData, AdCreativeLinkData
)
import re

User = get_user_model()


class AdLabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdLabel
        fields = ['id', 'created_time', 'updated_time', 'name']


class AdCreativePhotoDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdCreativePhotoData
        fields = [
            'id',
            'branded_content_shared_to_sponsor_status',
            'branded_content_sponsor_page_id',
            'branded_content_sponser_relationship',
            'caption',
            'image_hash',
            'page_welcome_message',
            'url'
        ]


class AdCreativeTextDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdCreativeTextData
        fields = ['message']


class AdCreativeVideoDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdCreativeVideoData
        fields = [
            'id',
            'additional_image_index',
            'branded_content_shared_to_sponsor_status',
            'branded_content_sponsor_page_id',
            'branded_content_sponser_relationship',
            'call_to_action',
            'caption_ids',
            'collection_thumbnails',
            'customization_rules_spec',
            'image_hash',
            'image_url',
            'link_description',
            'message',
            'offer_id',
            'page_welcome_message',
            'post_click_configuration',
            'retailer_item_ids',
            'targeting',
            'title',
            'video_id'
        ]


class AdCreativeLinkDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdCreativeLinkData
        fields = [
            'ad_context',
            'additional_image_index',
            'app_link_spec',
            'attachment_style',
            'boosted_product_set_id',
            'branded_content_shared_to_sponsor_status',
            'branded_content_sponsor_page_id',
            'branded_content_sponsor_relationship',
            'call_to_action',
            'caption',
            'child_attachments',
            'collection_thumbnails',
            'customization_rules_spec',
            'description',
            'event_id',
            'force_single_link',
            'format_option',
            'image_crops',
            'image_hash',
            'image_layer_specs',
            'image_overlay_spec',
            'link',
            'message',
            'multi_share_end_card',
            'multi_share_optimized',
            'name',
            'offer_id',
            'page_welcome_message',
            'picture',
            'post_click_configuration',
            'preferred_image_tags',
            'preferred_video_tags',
            'retailer_item_ids',
            'show_multiple_images',
            'sponsorship_info',
            'use_flexible_image_aspect_ratio'
        ]


class AdCreativeObjectStorySpecSerializer(serializers.Serializer):
    instagram_user_id = serializers.CharField(required=False, allow_blank=True)
    page_id = serializers.CharField(required=False, allow_blank=True)
    link_data = AdCreativeLinkDataSerializer(required=False)
    photo_data = AdCreativePhotoDataSerializer(many=True, required=False)
    video_data = AdCreativeVideoDataSerializer(many=True, required=False)
    text_data = AdCreativeTextDataSerializer(required=False)
    template_data = AdCreativeLinkDataSerializer(required=False)
    product_data = serializers.ListField(child=serializers.JSONField(), required=False)

    def to_representation(self, instance):
        """Custom representation to match OpenAPI spec structure"""
        data = {}
        
        # Add instagram_user_id and page_id from AdCreative
        if hasattr(instance, 'object_story_spec_instagram_user_id'):
            if instance.object_story_spec_instagram_user_id:
                data['instagram_user_id'] = instance.object_story_spec_instagram_user_id
        
        if hasattr(instance, 'object_story_spec_page_id'):
            if instance.object_story_spec_page_id:
                data['page_id'] = instance.object_story_spec_page_id
        
        # Add link_data if exists
        if hasattr(instance, 'object_story_spec_link_data') and instance.object_story_spec_link_data:
            data['link_data'] = AdCreativeLinkDataSerializer(instance.object_story_spec_link_data).data
        
        # Add photo_data if exists (now ManyToMany)
        if hasattr(instance, 'object_story_spec_photo_data') and instance.object_story_spec_photo_data.exists():
            data['photo_data'] = AdCreativePhotoDataSerializer(instance.object_story_spec_photo_data.all(), many=True).data
        
        # Add video_data if exists (now ManyToMany)
        if hasattr(instance, 'object_story_spec_video_data') and instance.object_story_spec_video_data.exists():
            data['video_data'] = AdCreativeVideoDataSerializer(instance.object_story_spec_video_data.all(), many=True).data
        
        # Add text_data if exists
        if hasattr(instance, 'object_story_spec_text_data') and instance.object_story_spec_text_data:
            data['text_data'] = AdCreativeTextDataSerializer(instance.object_story_spec_text_data).data
        
        # Add template_data if exists
        if hasattr(instance, 'object_story_spec_template_data') and instance.object_story_spec_template_data:
            data['template_data'] = AdCreativeLinkDataSerializer(instance.object_story_spec_template_data).data
        
        # Add product_data if exists
        if hasattr(instance, 'object_story_spec_product_data') and instance.object_story_spec_product_data:
            data['product_data'] = instance.object_story_spec_product_data
        
        return data


class AdCreativeDetailSerializer(serializers.ModelSerializer):
    """Main serializer for AdCreative that matches the OpenAPI spec exactly"""
    
    # Nested serializers for complex objects
    adlabels = AdLabelSerializer(source='ad_labels', many=True, read_only=True)
    object_story_spec = AdCreativeObjectStorySpecSerializer(source='*', read_only=True)
    
    # Actor information
    actor_id = serializers.CharField(source='actor.id', read_only=True)
    
    class Meta:
        model = AdCreative
        fields = [
            # Core fields
            'id', 'actor_id', 'name', 'status',
            
            # Content fields
            'body', 'title', 'image_hash', 'image_url', 'video_id', 'thumbnail_id', 'thumbnail_url',
            
            # Call to action
            'call_to_action_type', 'call_to_action',
            
            # Authorization and categorization
            'authorization_category', 'effective_authorization_category', 'categorization_criteria', 'category_media_source',
            
            # Object information
            'object_type', 'object_id', 'object_url', 'object_store_url', 'object_story_id',
            
            # Instagram and social
            'instagram_user_id', 'instagram_permalink_url', 'effective_instagram_media_id', 'effective_object_story_id',
            'source_facebook_post_id', 'source_instagram_media_id', 'threads_user_id',
            
            # Links and URLs
            'link_destination_display_url', 'link_og_id', 'link_url', 'template_url', 'url_tags',
            
            # Dynamic ads
            'product_set_id', 'bundle_folder_id', 'destination_set_id', 'place_page_set_id',
            'dynamic_ad_voice', 'applink_treatment',
            
            # Branded content
            'branded_content_sponsor_page_id', 'collaborative_ads_lsb_image_bank_id',
            
            # Features and settings
            'enable_direct_install', 'enable_launch_instant_app', 'user_page_actor_override',
            
            # Messages and welcome
            'page_welcome_message', 'messenger_sponsored_message',
            
            # Media and assets
            'photo_album_source_object_story_id', 'playable_asset_id', 'referral_id',
            
            # JSON fields
            'contextual_multi_ads', 'media_sourcing_spec', 'facebook_branded_content',
            'portrait_customizations', 'product_data', 'recommender_settings',
            'image_crops', 'ad_disclaimer_spec', 'asset_feed_spec', 'branded_content',
            'creative_sourcing_spec', 'degrees_of_freedom_spec', 'template_url_spec',
            'platform_customizations', 'interactive_components_spec',
            
            # Nested objects
            'adlabels', 'object_story_spec'
        ]

    def to_representation(self, instance):
        """Custom representation to ensure all fields match OpenAPI spec"""
        data = super().to_representation(instance)
        
        # Remove None values to match OpenAPI spec behavior
        cleaned_data = {}
        for key, value in data.items():
            if value is not None and value != '':
                cleaned_data[key] = value
        
        return cleaned_data
        

class ErrorResponseSerializer(serializers.Serializer):
    error = serializers.CharField()
    code = serializers.CharField()


class UpdateAndDeleteAdCreativeSerializer(serializers.ModelSerializer):
    """
    Serializer for UpdateAndDeleteAdCreative schema
    """
    ad_labels = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True
    )
    
    class Meta:
        model = AdCreative
        fields = ['ad_labels', 'name', 'status']
        extra_kwargs = {
            'name': {'required': False},
            'status': {'required': False}
        }
    
    def to_internal_value(self, data):
        """Transform incoming 'adlabels' to 'ad_labels'"""
        if 'adlabels' in data:
            data = data.copy()  # Don't modify the original data
            data['ad_labels'] = data.pop('adlabels')
        return super().to_internal_value(data)
    
    def validate_ad_labels(self, value):
        """Validate ad_labels is an array of strings"""
        if value is not None:
            if not isinstance(value, list):
                raise serializers.ValidationError("ad_labels must be an array")
            
            for label in value:
                if not isinstance(label, str):
                    raise serializers.ValidationError("All ad_labels must be strings")
                
                if not label.strip():
                    raise serializers.ValidationError("Ad_labels cannot be empty strings")
        
        return value
    
    def update(self, instance, validated_data):
        """Override update to handle adlabels properly"""
        
        # Handle adlabels separately
        adlabels_data = validated_data.pop('ad_labels', None)
        
        # Update other fields first
        instance = super().update(instance, validated_data)
        
        # Handle adlabels if provided
        if adlabels_data is not None:
            # Get or create AdLabel objects for each label in the input
            ad_labels = []
            for label_name in adlabels_data:
                label, created = AdLabel.objects.get_or_create(
                    name=label_name,
                    defaults={'name': label_name}
                )
                ad_labels.append(label)
            
            # Replace all existing labels with the new ones
            instance.ad_labels.set(ad_labels)
        
        return instance
    
    def validate_status(self, value):
        """Validate status enum values"""
        if value is not None:
            valid_statuses = ['ACTIVE', 'IN_PROCESS', 'WITH_ISSUES', 'DELETED']
            if value not in valid_statuses:
                raise serializers.ValidationError(f"Status must be one of: {valid_statuses}")
        return value
    
    def validate_name(self, value):
        """Validate name field"""
        if value is not None:
            if not isinstance(value, str):
                raise serializers.ValidationError("Name must be a string")
            
            if not value.strip():
                raise serializers.ValidationError("Name cannot be empty")
            
            if len(value) > 100:
                raise serializers.ValidationError("Name cannot exceed 100 characters")
        
        return value


class CreateAdCreativeSerializer(serializers.ModelSerializer):
    """
    Serializer for CreateAdCreative schema
    """
    object_story_spec = serializers.JSONField(required=False, allow_null=True)
    
    class Meta:
        model = AdCreative
        fields = ['name', 'object_story_spec', 'object_story_id', 'authorization_category', 'media_campaign']
        extra_kwargs = {
            'name': {'required': True},
            'object_story_spec': {'required': False},
            'object_story_id': {'required': False},
            'authorization_category': {'required': False},
            'media_campaign': {'required': False},
        }
    
    def validate_name(self, value):
        """Validate name field"""
        if not isinstance(value, str):
            raise serializers.ValidationError("Name must be a string")
        
        if not value.strip():
            raise serializers.ValidationError("Name cannot be empty")
        
        if len(value) > 100:
            raise serializers.ValidationError("Name cannot exceed 100 characters")
        
        return value
    
    def validate_object_story_id(self, value):
        """Validate object_story_id format"""
        if value is not None:
            if not isinstance(value, str):
                raise serializers.ValidationError("object_story_id must be a string")
            
            if not re.match(r'^\d+_\d+$', value):
                raise serializers.ValidationError("object_story_id must match pattern: <Page_id>_<Post_id>")
        
        return value
    
    def validate_authorization_category(self, value):
        """Validate authorization_category enum values"""
        if value is not None:
            valid_categories = ['NONE', 'POLITICAL', 'POLITICAL_WITH_DIGITALLY_CREATED_MEDIA']
            if value not in valid_categories:
                raise serializers.ValidationError(f"authorization_category must be one of: {valid_categories}")
        
        return value
    
    def create(self, validated_data):
        """Override create to handle object_story_spec separately"""
        object_story_spec = validated_data.pop('object_story_spec', None)
        
        # Set default status to ACTIVE if not provided
        if 'status' not in validated_data:
            validated_data['status'] = AdCreative.STATUS_ACTIVE
        
        # Create the main AdCreative instance
        ad_creative = AdCreative.objects.create(**validated_data)
        
        # Handle object_story_spec if provided
        if object_story_spec:
            self._handle_object_story_spec(ad_creative, object_story_spec)
        
        return ad_creative
    
    def _handle_object_story_spec(self, ad_creative, object_story_spec):
        """Handle object_story_spec data and create related objects"""
        # Update basic fields
        if 'instagram_user_id' in object_story_spec:
            ad_creative.object_story_spec_instagram_user_id = object_story_spec['instagram_user_id']
        
        if 'page_id' in object_story_spec:
            ad_creative.object_story_spec_page_id = object_story_spec['page_id']
        
        if 'product_data' in object_story_spec:
            ad_creative.object_story_spec_product_data = object_story_spec['product_data']
        
        # Handle link_data
        if 'link_data' in object_story_spec:
            link_data = object_story_spec['link_data']
            link_data_obj = AdCreativeLinkData.objects.create(**link_data)
            ad_creative.object_story_spec_link_data = link_data_obj
        
        # Handle photo_data (now supports array for ManyToMany)
        if 'photo_data' in object_story_spec:
            photo_data = object_story_spec['photo_data']
            # Handle both single object (dict) and array
            if isinstance(photo_data, list):
                photo_objs = [AdCreativePhotoData.objects.create(**pd) for pd in photo_data]
                ad_creative.object_story_spec_photo_data.set(photo_objs)
            else:
                photo_data_obj = AdCreativePhotoData.objects.create(**photo_data)
                ad_creative.object_story_spec_photo_data.set([photo_data_obj])
        
        # Handle text_data
        if 'text_data' in object_story_spec:
            text_data = object_story_spec['text_data']
            text_data_obj = AdCreativeTextData.objects.create(**text_data)
            ad_creative.object_story_spec_text_data = text_data_obj
        
        # Handle video_data
        if 'video_data' in object_story_spec:
            video_data = object_story_spec['video_data']
            video_data_obj = AdCreativeVideoData.objects.create(**video_data)
            ad_creative.object_story_spec_video_data = video_data_obj
        
        # Handle template_data (uses AdCreativeLinkData)
        if 'template_data' in object_story_spec:
            template_data = object_story_spec['template_data']
            template_data_obj = AdCreativeLinkData.objects.create(**template_data)
            ad_creative.object_story_spec_template_data = template_data_obj
        
        # Save the updated ad_creative
        ad_creative.save()