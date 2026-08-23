"""Root-admin endpoints for Organization management."""

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from access_control.models import UserRole
from audit.utils import record_audit_entry
from core.admin_permissions import IsOrgAdmin
from core.models import Organization, Role

User = get_user_model()


class AdminOrganizationSerializer(serializers.ModelSerializer):
    admin_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'slug', 'email_domain',
            'is_active', 'admin_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'admin_count', 'created_at', 'updated_at']

    def get_admin_count(self, obj):
        return UserRole.objects.filter(
            role__organization=obj,
            role__level=2,
        ).count()


class OrgAdminSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False)
    email = serializers.EmailField(required=False)

    def validate(self, data):
        if not data.get('user_id') and not data.get('email'):
            raise serializers.ValidationError('Provide user_id or email.')
        return data


class AdminOrganizationViewSet(viewsets.ModelViewSet):
    """CRUD for Organizations + assign/remove org admins. Root admin only."""
    queryset = Organization.objects.filter(is_deleted=False).order_by('name')
    serializer_class = AdminOrganizationSerializer
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    @action(detail=True, methods=['get'])
    def admins(self, request, pk=None):
        """List org admins for this organization."""
        org = self.get_object()
        user_roles = UserRole.objects.filter(
            role__organization=org,
            role__level=2,
        ).select_related('user', 'role')
        data = [
            {
                'user_id': ur.user.id,
                'email': ur.user.email,
                'name': ur.user.get_full_name() or ur.user.email,
                'role_name': ur.role.name,
            }
            for ur in user_roles
        ]
        return Response(data)

    @action(detail=True, methods=['post'], url_path='assign-admin')
    def assign_admin(self, request, pk=None):
        """Assign a user as Organization Admin for this org."""
        org = self.get_object()
        ser = OrgAdminSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        user_id = ser.validated_data.get('user_id')
        email = ser.validated_data.get('email')

        if email:
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                return Response(
                    {'detail': f'No user found with email "{email}".'},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {'detail': 'User not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Ensure user belongs to this org
        if user.organization_id != org.id:
            user.organization = org
            user.save(update_fields=['organization'])

        # Get or create the "Organization Admin" role for this org
        role, _ = Role.objects.get_or_create(
            organization=org,
            name='Organization Admin',
            defaults={'level': 2},
        )

        with transaction.atomic():
            user_role, created = UserRole.objects.get_or_create(
                user=user,
                role=role,
                defaults={'team': None},
            )
            if not created:
                return Response(
                    {'detail': 'User is already an admin of this organization.'},
                    status=status.HTTP_200_OK,
                )

            record_audit_entry(
                actor=request.user if request.user.is_authenticated else None,
                action='org.admin_assigned',
                target=user,
                before=None,
                after={'user_id': user.id, 'email': user.email, 'org_id': org.id},
                organization=org,
            )

        return Response(
            {'detail': f'{user.email} is now an admin of {org.name}.'},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='remove-admin')
    def remove_admin(self, request, pk=None):
        """Remove a user's Organization Admin role."""
        org = self.get_object()
        ser = OrgAdminSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        user_id = ser.validated_data.get('user_id')
        email = ser.validated_data.get('email')

        if email:
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                return Response(
                    {'detail': 'User not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {'detail': 'User not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        with transaction.atomic():
            deleted, _ = UserRole.objects.filter(
                user=user,
                role__organization=org,
                role__level=2,
            ).delete()

            if not deleted:
                return Response(
                    {'detail': 'User is not an admin of this organization.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            record_audit_entry(
                actor=request.user if request.user.is_authenticated else None,
                action='org.admin_removed',
                target=user,
                before={'user_id': user.id, 'email': user.email, 'org_id': org.id},
                after=None,
                organization=org,
            )

        return Response(
            {'detail': f'Removed admin role from {user.email}.'},
            status=status.HTTP_200_OK,
        )
