from rest_framework import serializers
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)
from .models import (
    Ad, CustomerAccount, FinalAppUrl, CustomParameter, UrlCollection,
    AdImageAsset, AdTextAsset, AdVideoAsset,
    ImageAdInfo, VideoAdInfo,
    VideoResponsiveAdInfo, ResponsiveSearchAdInfo, ResponsiveDisplayAdInfo,
    VideoTrueViewInStreamAdInfo, VideoBumperInStreamAdInfo, VideoOutstreamAdInfo,
    VideoNonSkippableInStreamAdInfo, InFeedVideoAdInfo,
    GoogleAdsPhotoData, GoogleAdsVideoData
)

User = get_user_model()


# ========== Account Serializers (nested in Ad) ==========
    
class CustomerAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAccount
        fields = ['id', 'customer_id', 'descriptive_name', 'status']
        read_only_fields = ['id']


# ========== Asset Serializers ==========

class AdImageAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdImageAsset
        fields = ['id', 'asset', 'pixel_width', 'pixel_height', 'file_size_bytes']


class GoogleAdsPhotoDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoogleAdsPhotoData
        fields = ['id', 'caption', 'image_hash', 'url']


class GoogleAdsVideoDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoogleAdsVideoData
        fields = ['id', 'title', 'video_id', 'image_url', 'message']


class AdTextAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdTextAsset
        fields = ['id', 'text']


class AdVideoAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdVideoAsset
        fields = ['id', 'asset']


class FinalAppUrlSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinalAppUrl
        fields = ['id', 'os_type', 'url']


class CustomParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomParameter
        fields = ['id', 'key', 'value']


class UrlCollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UrlCollection
        fields = ['id', 'url_collection_id', 'final_urls', 'final_mobile_urls', 'tracking_url_template']




class ImageAdInfoSerializer(serializers.ModelSerializer):
    image_asset = AdImageAssetSerializer(read_only=True)
    image_asset_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = ImageAdInfo
        fields = [
            'id', 'mime_type', 'pixel_width', 'pixel_height', 'image_url',
            'preview_pixel_width', 'preview_pixel_height', 'preview_image_url',
            'name', 'image_asset', 'image_asset_id', 'data', 'ad_id_to_copy_image_from'
        ]


class VideoTrueViewInStreamAdInfoSerializer(serializers.ModelSerializer):
    companion_banner = AdImageAssetSerializer(read_only=True)
    companion_banner_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = VideoTrueViewInStreamAdInfo
        fields = ['id', 'action_button_label', 'action_headline', 'companion_banner', 'companion_banner_id']


class VideoBumperInStreamAdInfoSerializer(serializers.ModelSerializer):
    companion_banner = AdImageAssetSerializer(read_only=True)
    companion_banner_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = VideoBumperInStreamAdInfo
        fields = ['id', 'action_button_label', 'action_headline', 'companion_banner', 'companion_banner_id']


class VideoOutstreamAdInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoOutstreamAdInfo
        fields = ['id', 'headline', 'description']


class VideoNonSkippableInStreamAdInfoSerializer(serializers.ModelSerializer):
    companion_banner = AdImageAssetSerializer(read_only=True)
    companion_banner_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = VideoNonSkippableInStreamAdInfo
        fields = ['id', 'action_button_label', 'action_headline', 'companion_banner', 'companion_banner_id']


class InFeedVideoAdInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = InFeedVideoAdInfo
        fields = ['id', 'headline', 'description1', 'description2', 'thumbnail']


class VideoAdInfoSerializer(serializers.ModelSerializer):
    video_asset = AdVideoAssetSerializer(read_only=True)
    video_asset_id = serializers.IntegerField(write_only=True, required=False)
    
    format_in_stream = VideoTrueViewInStreamAdInfoSerializer(read_only=True)
    format_bumper = VideoBumperInStreamAdInfoSerializer(read_only=True)
    format_out_stream = VideoOutstreamAdInfoSerializer(read_only=True)
    format_non_skippable = VideoNonSkippableInStreamAdInfoSerializer(read_only=True)
    format_in_feed = InFeedVideoAdInfoSerializer(read_only=True)
    
    class Meta:
        model = VideoAdInfo
        fields = [
            'id', 'video_asset', 'video_asset_id', 'video_asset_info',
            'format_in_stream', 'format_bumper', 'format_out_stream',
            'format_non_skippable', 'format_in_feed'
        ]


class VideoResponsiveAdInfoSerializer(serializers.ModelSerializer):
    headlines = AdTextAssetSerializer(many=True, read_only=True)
    long_headlines = AdTextAssetSerializer(many=True, read_only=True)
    descriptions = AdTextAssetSerializer(many=True, read_only=True)
    call_to_actions = AdTextAssetSerializer(many=True, read_only=True)
    videos = GoogleAdsVideoDataSerializer(many=True, read_only=True)
    companion_banners = GoogleAdsPhotoDataSerializer(many=True, read_only=True)
    
    headline_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    long_headline_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    description_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    call_to_action_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    video_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    companion_banner_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    
    # New fields for direct text updates
    headline_texts = serializers.ListField(child=serializers.CharField(allow_blank=True), write_only=True, required=False)
    long_headline_texts = serializers.ListField(child=serializers.CharField(allow_blank=True), write_only=True, required=False)
    description_texts = serializers.ListField(child=serializers.CharField(allow_blank=True), write_only=True, required=False)
    call_to_action_texts = serializers.ListField(child=serializers.CharField(allow_blank=True), write_only=True, required=False)
    
    class Meta:
        model = VideoResponsiveAdInfo
        fields = [
            'id', 'breadcrumb1', 'breadcrumb2',
            'headlines', 'long_headlines', 'descriptions', 'call_to_actions', 'call_to_actions_enabled',
            'videos', 'companion_banners',
            'headline_ids', 'long_headline_ids', 'description_ids',
            'call_to_action_ids', 'video_ids', 'companion_banner_ids',
            'headline_texts', 'long_headline_texts', 'description_texts', 'call_to_action_texts'
        ]
    
    def update(self, instance, validated_data):
        """Update VideoResponsiveAdInfo with proper handling of text and video fields"""
        print(f"DEBUG: ===== VideoResponsiveAdInfoSerializer.update START =====")
        
        # Extract text fields
        headline_texts = validated_data.pop('headline_texts', None)
        long_headline_texts = validated_data.pop('long_headline_texts', None)
        description_texts = validated_data.pop('description_texts', None)
        call_to_action_texts = validated_data.pop('call_to_action_texts', None)
        
        # Extract ID fields
        video_ids = validated_data.pop('video_ids', None)
        companion_banner_ids = validated_data.pop('companion_banner_ids', None)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Handle headlines
        if headline_texts is not None:
            # Clear existing headlines
            instance.headlines.clear()
            # Create new headlines
            for text in headline_texts:
                if text.strip():
                    headline = AdTextAsset.objects.create(text=text.strip())
                    instance.headlines.add(headline)
            # If no headlines provided or all empty, create one empty headline
            if not headline_texts or not any(text.strip() for text in headline_texts):
                empty_headline = AdTextAsset.objects.create(text='')
                instance.headlines.add(empty_headline)
        
        # Handle long headlines
        if long_headline_texts is not None:
            # Clear existing long headlines
            instance.long_headlines.clear()
            # Create new long headlines
            for text in long_headline_texts:
                if text.strip():
                    long_headline = AdTextAsset.objects.create(text=text.strip())
                    instance.long_headlines.add(long_headline)
            # If no long headlines provided or all empty, create one empty long headline
            if not long_headline_texts or not any(text.strip() for text in long_headline_texts):
                empty_long_headline = AdTextAsset.objects.create(text='')
                instance.long_headlines.add(empty_long_headline)
        
        # Handle descriptions
        if description_texts is not None:
            # Clear existing descriptions
            instance.descriptions.clear()
            # Create new descriptions
            for text in description_texts:
                if text.strip():
                    description = AdTextAsset.objects.create(text=text.strip())
                    instance.descriptions.add(description)
            # If no descriptions provided or all empty, create one empty description
            if not description_texts or not any(text.strip() for text in description_texts):
                empty_description = AdTextAsset.objects.create(text='')
                instance.descriptions.add(empty_description)
        
        # Handle call to actions
        if call_to_action_texts is not None:
            # Clear existing call to actions
            instance.call_to_actions.clear()
            # Create new call to actions
            for text in call_to_action_texts:
                if text.strip():
                    call_to_action = AdTextAsset.objects.create(text=text.strip())
                    instance.call_to_actions.add(call_to_action)
            # If no call to actions provided or all empty, create one empty call to action
            if not call_to_action_texts or not any(text.strip() for text in call_to_action_texts):
                empty_call_to_action = AdTextAsset.objects.create(text='')
                instance.call_to_actions.add(empty_call_to_action)
        
        # Handle video IDs
        if video_ids is not None:
            print(f"DEBUG: Setting videos with IDs: {video_ids}")
            # Filter out non-existent IDs - use GoogleAdsVideoData instead of AdVideoAsset
            valid_video_ids = GoogleAdsVideoData.objects.filter(id__in=video_ids).values_list('id', flat=True)
            print(f"DEBUG: Valid video IDs found: {list(valid_video_ids)}")
            instance.videos.set(valid_video_ids)
            print(f"DEBUG: Successfully set videos")
        
        # Handle companion banner IDs
        if companion_banner_ids is not None:
            print(f"DEBUG: Setting companion banners with IDs: {companion_banner_ids}")
            # Filter out non-existent IDs - use GoogleAdsPhotoData
            valid_companion_banner_ids = GoogleAdsPhotoData.objects.filter(id__in=companion_banner_ids).values_list('id', flat=True)
            print(f"DEBUG: Valid companion banner IDs found: {list(valid_companion_banner_ids)}")
            instance.companion_banners.set(valid_companion_banner_ids)
            print(f"DEBUG: Successfully set companion banners")
        
        instance.save()
        return instance


class ResponsiveSearchAdInfoSerializer(serializers.ModelSerializer):
    headlines = AdTextAssetSerializer(many=True, read_only=True)
    descriptions = AdTextAssetSerializer(many=True, read_only=True)
    
    headline_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    description_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    
    # New fields for direct text updates
    headline_texts = serializers.ListField(child=serializers.CharField(allow_blank=True), write_only=True, required=False)
    description_texts = serializers.ListField(child=serializers.CharField(allow_blank=True), write_only=True, required=False)
    
    class Meta:
        model = ResponsiveSearchAdInfo
        fields = ['id', 'path1', 'path2', 'headlines', 'descriptions', 'headline_ids', 'description_ids', 'headline_texts', 'description_texts']
    
    def update(self, instance, validated_data):
        # Handle headline_texts
        headline_texts = validated_data.pop('headline_texts', None)
        if headline_texts is not None:
            # Clear existing headlines
            instance.headlines.clear()
            # Create new headlines
            for text in headline_texts:
                if text.strip():  # Only create non-empty headlines
                    headline = AdTextAsset.objects.create(text=text)
                    instance.headlines.add(headline)
            # Ensure at least one empty headline if no text provided
            if not headline_texts or all(not text.strip() for text in headline_texts):
                headline = AdTextAsset.objects.create(text='')
                instance.headlines.add(headline)
        
        # Handle description_texts
        description_texts = validated_data.pop('description_texts', None)
        if description_texts is not None:
            # Clear existing descriptions
            instance.descriptions.clear()
            # Create new descriptions
            for text in description_texts:
                if text.strip():  # Only create non-empty descriptions
                    description = AdTextAsset.objects.create(text=text)
                    instance.descriptions.add(description)
            # Ensure at least one empty description if no text provided
            if not description_texts or all(not text.strip() for text in description_texts):
                description = AdTextAsset.objects.create(text='')
                instance.descriptions.add(description)
        
        # Handle headline_ids and description_ids (legacy support)
        headline_ids = validated_data.pop('headline_ids', None)
        if headline_ids is not None:
            valid_headline_ids = AdTextAsset.objects.filter(id__in=headline_ids).values_list('id', flat=True)
            instance.headlines.set(valid_headline_ids)
        
        description_ids = validated_data.pop('description_ids', None)
        if description_ids is not None:
            valid_description_ids = AdTextAsset.objects.filter(id__in=description_ids).values_list('id', flat=True)
            instance.descriptions.set(valid_description_ids)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


class ResponsiveDisplayAdInfoSerializer(serializers.ModelSerializer):
    marketing_images = GoogleAdsPhotoDataSerializer(many=True, read_only=True)
    square_marketing_images = GoogleAdsPhotoDataSerializer(many=True, read_only=True)
    logo_images = GoogleAdsPhotoDataSerializer(many=True, read_only=True)
    square_logo_images = GoogleAdsPhotoDataSerializer(many=True, read_only=True)
    headlines = AdTextAssetSerializer(many=True, read_only=True)
    long_headline = AdTextAssetSerializer(read_only=True)
    descriptions = AdTextAssetSerializer(many=True, read_only=True)
    youtube_videos = GoogleAdsVideoDataSerializer(many=True, read_only=True)
    
    marketing_image_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    square_marketing_image_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    logo_image_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    square_logo_image_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    headline_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    long_headline_id = serializers.IntegerField(write_only=True, required=False)
    description_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    youtube_video_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    
    # New fields for direct text updates
    long_headline_text = serializers.CharField(write_only=True, required=False, allow_blank=True)
    headline_texts = serializers.ListField(child=serializers.CharField(allow_blank=True), write_only=True, required=False)
    description_texts = serializers.ListField(child=serializers.CharField(allow_blank=True), write_only=True, required=False)
    
    class Meta:
        model = ResponsiveDisplayAdInfo
        fields = [
            'id', 'business_name', 'main_color', 'accent_color', 'allow_flexible_color',
            'call_to_action_text', 'price_prefix', 'promo_text', 'format_setting',
            'enable_asset_enhancements', 'enable_autogen_video', 'control_spec',
            'marketing_images', 'square_marketing_images', 'logo_images', 'square_logo_images',
            'headlines', 'long_headline', 'descriptions', 'youtube_videos',
            'marketing_image_ids', 'square_marketing_image_ids', 'logo_image_ids',
            'square_logo_image_ids', 'headline_ids', 'long_headline_id',
            'description_ids', 'youtube_video_ids',
            'long_headline_text', 'headline_texts', 'description_texts'
        ]
    
    def update(self, instance, validated_data):
        """Update ResponsiveDisplayAdInfo with proper handling of text fields"""
        print(f"DEBUG: ===== ResponsiveDisplayAdInfoSerializer.update START =====")
        logger.info(f"ResponsiveDisplayAdInfoSerializer.update called with data: {validated_data}")
        
        # Extract text field data
        long_headline_text = validated_data.pop('long_headline_text', None)
        headline_texts = validated_data.pop('headline_texts', None)
        description_texts = validated_data.pop('description_texts', None)
        
        logger.info(f"Extracted text data - long_headline_text: {long_headline_text}, headline_texts: {headline_texts}, description_texts: {description_texts}")
        
        # Extract ID fields
        marketing_image_ids = validated_data.pop('marketing_image_ids', None)
        square_marketing_image_ids = validated_data.pop('square_marketing_image_ids', None)
        logo_image_ids = validated_data.pop('logo_image_ids', None)
        square_logo_image_ids = validated_data.pop('square_logo_image_ids', None)
        headline_ids = validated_data.pop('headline_ids', None)
        long_headline_id = validated_data.pop('long_headline_id', None)
        description_ids = validated_data.pop('description_ids', None)
        youtube_video_ids = validated_data.pop('youtube_video_ids', None)
        
        # Update basic fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Handle long headline
        if long_headline_text is not None:
            if long_headline_text.strip():
                # Create or update long headline
                if instance.long_headline:
                    instance.long_headline.text = long_headline_text.strip()
                    instance.long_headline.save()
                else:
                    instance.long_headline = AdTextAsset.objects.create(text=long_headline_text.strip())
            else:
                # Create empty long headline if none exists
                if not instance.long_headline:
                    instance.long_headline = AdTextAsset.objects.create(text='')
                else:
                    instance.long_headline.text = ''
                    instance.long_headline.save()
        
        # Handle headlines
        if headline_texts is not None:
            # Clear existing headlines
            instance.headlines.clear()
            # Create new headlines
            for text in headline_texts:
                if text.strip():
                    headline = AdTextAsset.objects.create(text=text.strip())
                    instance.headlines.add(headline)
            # If no headlines provided or all empty, create one empty headline
            if not headline_texts or not any(text.strip() for text in headline_texts):
                empty_headline = AdTextAsset.objects.create(text='')
                instance.headlines.add(empty_headline)
        
        # Handle descriptions
        if description_texts is not None:
            # Clear existing descriptions
            instance.descriptions.clear()
            # Create new descriptions
            for text in description_texts:
                if text.strip():
                    description = AdTextAsset.objects.create(text=text.strip())
                    instance.descriptions.add(description)
            # If no descriptions provided or all empty, create one empty description
            if not description_texts or not any(text.strip() for text in description_texts):
                empty_description = AdTextAsset.objects.create(text='')
                instance.descriptions.add(empty_description)
        
        print(f"DEBUG: Finished processing text data, about to process media IDs...")
        try:
            # Handle image and video IDs with validation
            print(f"DEBUG: Processing media IDs - marketing_image_ids: {marketing_image_ids}, square_marketing_image_ids: {square_marketing_image_ids}")
            print(f"DEBUG: About to process media IDs...")
            if marketing_image_ids is not None:
                print(f"DEBUG: Setting marketing_images with IDs: {marketing_image_ids}")
                # Filter out non-existent IDs - use GoogleAdsPhotoData instead of AdImageAsset
                valid_marketing_ids = GoogleAdsPhotoData.objects.filter(id__in=marketing_image_ids).values_list('id', flat=True)
                print(f"DEBUG: Valid marketing IDs found: {list(valid_marketing_ids)}")
                instance.marketing_images.set(valid_marketing_ids)
                print(f"DEBUG: Successfully set marketing_images")
            if square_marketing_image_ids is not None:
                print(f"DEBUG: Setting square_marketing_images with IDs: {square_marketing_image_ids}")
                # Filter out non-existent IDs - use GoogleAdsPhotoData instead of AdImageAsset
                valid_square_marketing_ids = GoogleAdsPhotoData.objects.filter(id__in=square_marketing_image_ids).values_list('id', flat=True)
                print(f"DEBUG: Valid square marketing IDs found: {list(valid_square_marketing_ids)}")
                instance.square_marketing_images.set(valid_square_marketing_ids)
                print(f"DEBUG: Successfully set square_marketing_images")
            if logo_image_ids is not None:
                # Filter out non-existent IDs - use GoogleAdsPhotoData instead of AdImageAsset
                valid_logo_ids = GoogleAdsPhotoData.objects.filter(id__in=logo_image_ids).values_list('id', flat=True)
                instance.logo_images.set(valid_logo_ids)
            if square_logo_image_ids is not None:
                # Filter out non-existent IDs - use GoogleAdsPhotoData instead of AdImageAsset
                valid_square_logo_ids = GoogleAdsPhotoData.objects.filter(id__in=square_logo_image_ids).values_list('id', flat=True)
                instance.square_logo_images.set(valid_square_logo_ids)
            if youtube_video_ids is not None:
                # Filter out non-existent IDs - use GoogleAdsVideoData instead of AdVideoAsset
                valid_video_ids = GoogleAdsVideoData.objects.filter(id__in=youtube_video_ids).values_list('id', flat=True)
                instance.youtube_videos.set(valid_video_ids)
            print(f"DEBUG: Finished processing media IDs")
        except Exception as e:
            print(f"DEBUG: Error processing media IDs: {e}")
            import traceback
            traceback.print_exc()
        
        instance.save()
        return instance


class AdSerializer(serializers.ModelSerializer):
    # Related ad type information
    image_ad = ImageAdInfoSerializer(read_only=True)
    video_ad = VideoAdInfoSerializer(read_only=True)
    video_responsive_ad = VideoResponsiveAdInfoSerializer(read_only=True)
    responsive_search_ad = ResponsiveSearchAdInfoSerializer(read_only=True)
    responsive_display_ad = ResponsiveDisplayAdInfoSerializer(read_only=True)
    
    # Write-only fields for updates
    responsive_display_ad_data = ResponsiveDisplayAdInfoSerializer(write_only=True, required=False)
    responsive_search_ad_data = ResponsiveSearchAdInfoSerializer(write_only=True, required=False)
    video_responsive_ad_data = VideoResponsiveAdInfoSerializer(write_only=True, required=False)
    
    # URL related information
    final_app_urls = FinalAppUrlSerializer(many=True, read_only=True)
    url_custom_parameters = CustomParameterSerializer(many=True, read_only=True)
    url_collections = UrlCollectionSerializer(many=True, read_only=True)
    
    # Media assets
    media_assets = serializers.StringRelatedField(many=True, read_only=True)
    media_asset_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    
    # User and account information
    created_by = serializers.StringRelatedField(read_only=True)
    customer_account = CustomerAccountSerializer(read_only=True)
    
    # ID fields for write operations
    customer_account_id = serializers.IntegerField(write_only=True, required=False)
    created_by_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = Ad
        fields = [
            'id', 'google_ads_id', 'name', 'display_url',
            'added_by_google_ads', 'type', 'device_preference', 'system_managed_resource_source',
            'final_urls', 'final_mobile_urls', 'tracking_url_template', 'final_url_suffix',
            'status', 'created_at', 'updated_at',
            
            # Ad type information (read-only)
            'image_ad', 'video_ad', 'video_responsive_ad', 
            'responsive_search_ad', 'responsive_display_ad',
            
            # Ad type data (write-only)
            'responsive_display_ad_data', 'responsive_search_ad_data', 'video_responsive_ad_data',
            
            # URL related information
            'final_app_urls', 'url_custom_parameters', 'url_collections',
            
            # Related information
            'customer_account', 'created_by', 'media_assets',
            'customer_account_id', 'created_by_id', 'media_asset_ids',

            # Campaign association
            'media_campaign',
        ]
        read_only_fields = ['id', 'google_ads_id', 'added_by_google_ads', 'system_managed_resource_source', 'created_at', 'updated_at']
    
    def validate(self, data):
        """Validate Union Field constraints"""
        # Skip validation during creation - we'll handle it in create() method
        # This validation is mainly for updates where ad type fields might be directly set
        return data

    def create(self, validated_data):
        """Create ad instance"""
        # Extract related IDs
        customer_account_id = validated_data.pop('customer_account_id', None)
        created_by_id = validated_data.pop('created_by_id', None)
        media_asset_ids = validated_data.pop('media_asset_ids', [])
        
        # Create corresponding ad type object based on type field
        ad_type = validated_data.get('type')
        ad_type_obj = None
        
        if ad_type == 'RESPONSIVE_SEARCH_AD':
            # Create basic ResponsiveSearchAdInfo
            ad_type_obj = ResponsiveSearchAdInfo.objects.create()
            # Add empty headlines and descriptions
            for i in range(1, 4):
                headline = AdTextAsset.objects.create(text='')
                ad_type_obj.headlines.add(headline)
            for i in range(1, 3):
                description = AdTextAsset.objects.create(text='')
                ad_type_obj.descriptions.add(description)
            validated_data['responsive_search_ad'] = ad_type_obj
            
        elif ad_type == 'RESPONSIVE_DISPLAY_AD':
            # Create basic ResponsiveDisplayAdInfo with empty text fields
            long_headline = AdTextAsset.objects.create(text='')
            headline = AdTextAsset.objects.create(text='')
            description = AdTextAsset.objects.create(text='')
            
            ad_type_obj = ResponsiveDisplayAdInfo.objects.create(
                business_name='',
                long_headline=long_headline,
                main_color='#000000',
                accent_color='#000000',
                allow_flexible_color=False
            )
            ad_type_obj.headlines.add(headline)
            ad_type_obj.descriptions.add(description)
            validated_data['responsive_display_ad'] = ad_type_obj
            
        elif ad_type == 'VIDEO_RESPONSIVE_AD':
            # Create basic VideoResponsiveAdInfo without placeholder video
            long_headline = AdTextAsset.objects.create(text='')
            description = AdTextAsset.objects.create(text='')
            
            ad_type_obj = VideoResponsiveAdInfo.objects.create(
                call_to_actions_enabled=False,
                companion_banner_enabled=False
            )
            # Don't add placeholder video - user will select their own
            ad_type_obj.long_headlines.add(long_headline)
            ad_type_obj.descriptions.add(description)
            validated_data['video_responsive_ad'] = ad_type_obj
        
        # Create ad instance
        ad_data = {
            'created_by_id': created_by_id,
            **validated_data
        }
        
        # Only set customer_account_id if it's provided
        if customer_account_id is not None:
            ad_data['customer_account_id'] = customer_account_id
        
        # Create ad instance without resource_name first
        ad = Ad.objects.create(**ad_data)
        
        # Update with proper resource_name after creation
        customer_id = customer_account_id if customer_account_id else 123  # Default customer ID
        ad.resource_name = f"customers/{customer_id}/ads/{ad.id}"
        ad.save()
        
        # Set media assets
        if media_asset_ids:
            ad.media_assets.set(media_asset_ids)
        
        return ad

    def update(self, instance, validated_data):
        """Update ad instance"""
        logger.info(f"AdSerializer.update called with data: {validated_data}")
        
        # Extract related IDs
        customer_account_id = validated_data.pop('customer_account_id', None)
        created_by_id = validated_data.pop('created_by_id', None)
        media_asset_ids = validated_data.pop('media_asset_ids', None)

        # Extract nested serializer data
        responsive_display_ad_data = validated_data.pop('responsive_display_ad_data', None)
        responsive_search_ad_data = validated_data.pop('responsive_search_ad_data', None)
        video_responsive_ad_data = validated_data.pop('video_responsive_ad_data', None)
        
        logger.info(f"Extracted responsive_display_ad_data: {responsive_display_ad_data}")

        # Update basic fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if customer_account_id:
            instance.customer_account_id = customer_account_id
        if created_by_id:
            instance.created_by_id = created_by_id
        
        instance.save()

        # Handle nested serializer updates
        if responsive_display_ad_data and instance.responsive_display_ad:
            logger.info(f"Updating responsive_display_ad with data: {responsive_display_ad_data}")
            display_ad_serializer = ResponsiveDisplayAdInfoSerializer(
                instance.responsive_display_ad, 
                data=responsive_display_ad_data, 
                partial=True
            )
            if display_ad_serializer.is_valid():
                logger.info("ResponsiveDisplayAdInfoSerializer is valid, saving...")
                display_ad_serializer.save()
            else:
                logger.error(f"ResponsiveDisplayAdInfoSerializer validation errors: {display_ad_serializer.errors}")
        
        if responsive_search_ad_data and instance.responsive_search_ad:
            search_ad_serializer = ResponsiveSearchAdInfoSerializer(
                instance.responsive_search_ad, 
                data=responsive_search_ad_data, 
                partial=True
            )
            if search_ad_serializer.is_valid():
                search_ad_serializer.save()
        
        if video_responsive_ad_data and instance.video_responsive_ad:
            video_ad_serializer = VideoResponsiveAdInfoSerializer(
                instance.video_responsive_ad, 
                data=video_responsive_ad_data, 
                partial=True
            )
            if video_ad_serializer.is_valid():
                video_ad_serializer.save()

        if media_asset_ids is not None:
            instance.media_assets.set(media_asset_ids)
        
        return instance


class AdListSerializer(serializers.ModelSerializer):
    """Ad list serializer"""
    customer_account = CustomerAccountSerializer(read_only=True)
    created_by = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = Ad
        fields = [
            'id', 'name', 'type', 'status', 'customer_account',
            'created_by', 'created_at', 'updated_at'
        ]

