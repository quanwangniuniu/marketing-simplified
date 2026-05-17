from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import Organization
from access_control.models import UserRole
from core.models import Role
from stripe_meta.models import Subscription


User = get_user_model()

class OrganizationSerializer(serializers.ModelSerializer):
    plan_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Organization
        fields = ['id', 'name', 'plan_id']
    
    def get_plan_id(self, obj):
        """Get the plan_id from the active subscription"""
        try:
            subscription = Subscription.objects.filter(
                organization=obj,
                is_active=True
            ).first()
            return subscription.plan.id if subscription else None
        except Exception:
            return None

class UserProfileSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    roles = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'is_verified', 'is_staff', 'organization', 'roles', 'first_name', 'last_name', 'avatar', 'job', 'department', 'location']

    def get_roles(self, obj):
        """
        Get user roles with improved logic for users without organization
        """
        # Strategy 1: If user has an organization, get roles for that organization
        try:
            if obj.organization:
                user_roles = UserRole.objects.filter(
                    user=obj, 
                    role__organization=obj.organization
                ).select_related('role')
                print(f"Found {user_roles.count()} roles for user {obj.email}")

            else:
            # Strategy 2: If user has no organization, try multiple approaches
            
                # First, try to get roles with organization_id = NULL (global roles)
                user_roles = UserRole.objects.filter(
                    user=obj, 
                    role__organization=None
                ).select_related('role')
            
                # If no global roles found, try to get any roles assigned to this user
                # regardless of organization (fallback for existing data)
                if not user_roles.exists():
                    user_roles = UserRole.objects.filter(user=obj).select_related('role')
                
                    # Log this situation for debugging
                    if user_roles.exists():
                        print(f"Warning: User {obj.email} has no organization but has roles from other organizations")
        
            return [ur.role.name for ur in user_roles]    
        except Exception as e:
            print(f"Error in get_roles: {e}")
            return [] 

    def get_avatar(self, obj):
        """Return avatar URL if avatar exists"""
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
        return None


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile (excludes email)"""
    
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'avatar', 'job', 'department', 'location']
    
    def validate_username(self, value):
        """Ensure username is unique across users"""
        user = self.context['request'].user
        if User.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value
    
    def validate_avatar(self, value):
        """Validate avatar file type and size"""
        if value:
            # Check file size (5MB limit)
            max_size = 5 * 1024 * 1024  # 5MB in bytes
            if value.size > max_size:
                raise serializers.ValidationError("Avatar file size must not exceed 5MB.")
            
            # Check file type
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
            if value.content_type not in allowed_types:
                raise serializers.ValidationError(
                    "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
                )
        
        return value
    
    def update(self, instance, validated_data):
        """Update user profile and clean up old avatar if new one is uploaded"""
        # If a new avatar is being uploaded and user has an old avatar, delete it
        if 'avatar' in validated_data and validated_data['avatar']:
            old_avatar = instance.avatar
            if old_avatar:
                # Delete old avatar file from storage
                try:
                    import os
                    if os.path.isfile(old_avatar.path):
                        os.remove(old_avatar.path)
                except Exception as e:
                    # Log the error but don't fail the update
                    print(f"Error deleting old avatar: {e}")
        
        return super().update(instance, validated_data)


class OrganizationTokenRefreshSerializer(serializers.Serializer):
    organization_access_token = serializers.CharField()
        