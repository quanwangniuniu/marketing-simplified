import logging

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Organization, Project, ProjectInvitation, ProjectMember, Role
from core.permissions import (
    CanManageProjectMembers,
    IsProjectMember,
    can_invite_project_members,
    IsProjectOwner,
    can_manage_project_members,
)
from core.serializers import (
    AcceptInvitationSerializer,
    ProjectInvitationSerializer,
    ProjectMemberInviteSerializer,
    ProjectMemberSerializer,
    ProjectOnboardingSerializer,
    ProjectSerializer,
    ProjectSummarySerializer,
)
from decision.models import Decision, DecisionEdge
from decision.serializers import DecisionEdgeSerializer, DecisionGraphNodeSerializer
from core.services.project_initialization import ProjectInitializationService
from core.utils.invitations import accept_invitation, create_project_invitation, send_invitation_email
from core.utils.kpi_suggestions import get_kpi_suggestions
from core.utils.project_calendars import (
    ensure_project_calendar,
    soft_delete_project_calendars,
)

logger = logging.getLogger(__name__)
User = get_user_model()


class CheckProjectMembershipView(APIView):
    """Return project membership metadata for authenticated users."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        memberships = ProjectMember.objects.filter(user=user, is_active=True)
        project_count = memberships.count()
        active_project_id = user.active_project_id if user.active_project else None

        return Response(
            {
                'has_project': project_count > 0,
                'active_project_id': active_project_id,
                'project_count': project_count,
            }
        )


class ProjectOnboardingView(APIView):
    """Handle the multi-step onboarding wizard for creating a project."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ProjectOnboardingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        organization = getattr(user, 'organization', None)
        if not organization:
            organization = self._ensure_organization_for_user(user)
            if not organization:
                return Response(
                    {'error': 'User must belong to an organization to create projects.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        data = serializer.validated_data

        owner = self._resolve_owner(user, data.get('owner_id'))
        if isinstance(owner, Response):
            return owner

        advertising_platforms = data.get('advertising_platforms', [])
        if data.get('advertising_platforms_other') and 'other' not in advertising_platforms:
            advertising_platforms.append('other')

        project = Project.objects.create(
            name=data['name'],
            description=data.get('description'),
            organization=organization,
            owner=owner,
            project_type=data.get('project_type', []),
            work_model=data.get('work_model', []),
            advertising_platforms=advertising_platforms,
            objectives=data.get('objectives', []),
            kpis=data.get('kpis', {}),
            budget_management_type=data.get('budget_management_type'),
            total_monthly_budget=data.get('total_monthly_budget'),
            pacing_enabled=data.get('pacing_enabled', False),
            budget_config=data.get('budget_config', {}),
            primary_audience_type=data.get('primary_audience_type'),
            audience_targeting=data.get('audience_targeting', {}),
        )

        # Ensure creator membership
        ProjectMember.objects.update_or_create(
            user=user,
            project=project,
            defaults={'role': 'owner', 'is_active': True},
        )

        # Ensure owner membership
        ProjectMember.objects.update_or_create(
            user=owner,
            project=project,
            defaults={'role': 'owner', 'is_active': True},
        )

        ensure_project_calendar(project)

        # Set active project
        user.active_project = project
        user.save(update_fields=['active_project'])

        # Invite existing members (basic implementation)
        self._handle_member_invites(project, data.get('invite_members', []))

        # Initialize project services (best-effort)
        try:
            ProjectInitializationService.initialize_project(project)
        except Exception as exc:  # pragma: no cover - safeguard
            logger.warning("Project initialization failed for project %s: %s", project.id, exc)

        project_data = ProjectSerializer(project, context={'request': request}).data
        project_data['is_active'] = True

        return Response(project_data, status=status.HTTP_201_CREATED)

    def _resolve_owner(self, default_owner, owner_id):
        if not owner_id:
            return default_owner
        if owner_id == default_owner.id:
            return default_owner
        try:
            owner = User.objects.get(id=owner_id)
        except User.DoesNotExist:
            return Response({'error': 'Specified owner was not found.'}, status=status.HTTP_400_BAD_REQUEST)
        if owner.organization_id != default_owner.organization_id:
            return Response(
                {'error': 'Owner must belong to the same organization as the creator.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return owner

    def _handle_member_invites(self, project, invite_members):
        if not invite_members:
            return

        for invite in invite_members:
            email = invite.get('email')
            role = invite.get('role', 'member')
            if not email:
                continue

            try:
                invited_user = User.objects.get(email=email)
            except User.DoesNotExist:
                logger.info("Invite skipped for %s (user does not exist yet)", email)
                continue

            ProjectMember.objects.update_or_create(
                user=invited_user,
                project=project,
                defaults={'role': role, 'is_active': True},
            )

    def _ensure_organization_for_user(self, user):
        email = getattr(user, 'email', '') or ''
        domain = email.split('@')[-1].lower() if '@' in email else None
        organization = None

        if domain:
            organization = Organization.objects.filter(email_domain__iexact=domain).first()
            if not organization:
                base_name = domain.split('.')[0].replace('-', ' ').replace('_', ' ').title() or domain
                name = base_name
                suffix = 1
                while Organization.objects.filter(name=name).exists():
                    suffix += 1
                    name = f"{base_name} {suffix}"
                organization = Organization.objects.create(name=name, email_domain=domain)

        if not organization:
            base_name = "Organization"
            name = base_name
            suffix = 1
            while Organization.objects.filter(name=name).exists():
                suffix += 1
                name = f"{base_name} {suffix}"
            organization = Organization.objects.create(name=name)

        user.organization = organization
        user.save(update_fields=['organization'])
        return organization


class KPISuggestionsView(APIView):
    """Return merged KPI suggestions for provided objectives."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        objectives_param = request.query_params.get('objectives', '')
        objectives = [item.strip() for item in objectives_param.split(',') if item.strip()]

        if not objectives:
            return Response(
                {'error': 'objectives query parameter is required (comma-separated list).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        suggestions = get_kpi_suggestions(objectives)

        return Response(
            {
                'objectives': objectives,
                'suggested_kpis': suggestions,
                'count': len(suggestions),
            }
        )


class ProjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Project model with project membership filtering.
    
    Endpoints:
    - GET /api/core/projects/ - List user's projects (with filtering)
    - POST /api/core/projects/ - Create simple project
    - GET /api/core/projects/{id}/ - Get project details
    - PATCH /api/core/projects/{id}/ - Update project
    - POST /api/core/projects/{id}/set-active/ - Set as active project
    """

    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter projects by user's memberships."""
        user = self.request.user

        # Get all projects where user is a member
        project_ids = ProjectMember.objects.filter(
            user=user,
            is_active=True
        ).values_list('project_id', flat=True)

        queryset = Project.objects.filter(id__in=project_ids).select_related('organization', 'owner')

        # Filter by active_only query parameter
        active_only = self.request.query_params.get('active_only', 'false').lower() == 'true'
        if active_only and user.active_project:
            queryset = queryset.filter(id=user.active_project_id)

        return queryset.order_by('-created_at')

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsProjectOwner()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        """Create project and add user as owner."""
        user = self.request.user
        organization = getattr(user, 'organization', None)

        if not organization:
            raise ValidationError({
                'organization': 'User must belong to an organization to create projects'
            })

        project = serializer.save(
            organization=organization,
            owner=user
        )

        # Create project membership
        ProjectMember.objects.create(
            user=user,
            project=project,
            role='owner',
            is_active=True
        )

        # Set as active project if user has no active project
        if not user.active_project:
            user.active_project = project
            user.save(update_fields=['active_project'])

        ensure_project_calendar(project)

        try:
            ProjectInitializationService.ensure_default_ad_channels(project)
        except Exception as exc:  # pragma: no cover - safeguard
            logger.warning(
                "Default ad channels not seeded for project %s: %s", project.id, exc
            )

        return project

    def perform_destroy(self, instance):
        """Delete project and soft-delete related calendars."""
        with transaction.atomic():
            soft_delete_project_calendars(instance)
            instance.delete()

    @action(detail=True, methods=['post'])
    def set_active(self, request, pk=None):
        """Set project as user's active project."""
        project = self.get_object()
        user = request.user

        # Verify user is a member
        membership = ProjectMember.objects.filter(
            user=user,
            project=project,
            is_active=True
        ).first()

        if not membership:
            return Response(
                {'error': 'You are not a member of this project'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Set as active project
        user.active_project = project
        user.save(update_fields=['active_project'])

        serializer = ProjectSummarySerializer(project, context={'request': request})
        return Response({
            'message': 'Active project updated successfully',
            'active_project': serializer.data
        })

    @action(detail=True, methods=['get'], url_path='ad-channels')
    def ad_channels(self, request, pk=None):
        """List advertising channels configured for this project (for budget pool / request forms)."""
        project = self.get_object()
        rows = project.ad_channels.all().order_by('name', 'id')
        return Response([{'id': ch.id, 'name': ch.name} for ch in rows])

    @action(detail=True, methods=['get'], url_path='decisions/graph')
    def decisions_graph(self, request, pk=None):
        """Return decision graph (nodes + edges) for a project."""
        project = self.get_object()
        nodes_qs = Decision.objects.filter(project=project, is_deleted=False).order_by('-updated_at')
        edges_qs = DecisionEdge.objects.filter(
            from_decision__project=project,
            to_decision__project=project,
        )
        nodes = DecisionGraphNodeSerializer(nodes_qs, many=True).data
        edges = DecisionEdgeSerializer(edges_qs, many=True).data
        return Response({"nodes": nodes, "edges": edges})


class ProjectMemberViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing project members.
    Nested under projects.
    
    Endpoints:
    - GET /api/core/projects/{project_id}/members/ - List project members
    - POST /api/core/projects/{project_id}/members/ - Invite user to project
    - PATCH /api/core/projects/{project_id}/members/{id}/ - Update member role
    - DELETE /api/core/projects/{project_id}/members/{id}/ - Remove member
    """

    serializer_class = ProjectMemberSerializer
    permission_classes = [IsAuthenticated]
    owner_transfer_default_role = 'Team Leader'

    def get_queryset(self):
        """Filter members by project."""
        from core.utils.bot_user import AGENT_BOT_EMAIL

        project_id = self.kwargs.get('project_id')
        project = get_object_or_404(Project, id=project_id)

        # Verify user is a member
        if not ProjectMember.objects.filter(
            user=self.request.user,
            project=project,
            is_active=True
        ).exists():
            return ProjectMember.objects.none()

        # Exclude bot users from member list
        # Bot users are system-managed and automatically added to projects,
        # they should not appear in the regular member list UI
        return ProjectMember.objects.filter(
            project=project,
            is_active=True
        ).exclude(
            user__email=AGENT_BOT_EMAIL  # Exclude agent bot user
        ).select_related('user', 'project')

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['update', 'partial_update', 'destroy']:
            # Restrict role changes and removals to privileged roles.
            return [IsAuthenticated(), CanManageProjectMembers()]
        # For list/retrieve/create: object-level management permissions are handled
        # inside the endpoints (create is owner-only).
        return [IsAuthenticated()]

    def _transfer_project_owner(self, instance):
        project = instance.project
        previous_owner = project.owner

        with transaction.atomic():
            if previous_owner and previous_owner.id != instance.user_id:
                previous_owner_membership = ProjectMember.objects.filter(
                    project=project,
                    user=previous_owner,
                    is_active=True,
                ).first()
                if previous_owner_membership and previous_owner_membership.role == 'owner':
                    previous_owner_membership.role = self.owner_transfer_default_role
                    previous_owner_membership.save(update_fields=['role'])

            project.owner = instance.user
            project.save(update_fields=['owner'])

            if instance.role != 'owner':
                instance.role = 'owner'
                instance.save(update_fields=['role'])

            ensure_project_calendar(project)

    def update(self, request, *args, **kwargs):
        partial = kwargs.get('partial', False)
        instance = self.get_object()
        requested_role = request.data.get('role')
        if requested_role == 'owner':
            self._transfer_project_owner(instance)
            instance.refresh_from_db()
            return Response(self.get_serializer(instance).data)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        desired_role = serializer.validated_data.get('role')
        if desired_role == 'owner':
            self._transfer_project_owner(instance)
            instance.refresh_from_db()
            return Response(self.get_serializer(instance).data)

        if (
            desired_role
            and instance.role == 'owner'
            and instance.project.owner_id == instance.user_id
            and desired_role != 'owner'
        ):
            raise ValidationError(
                {'role': 'Transfer project ownership before changing the owner role.'}
            )

        response = super().update(request, *args, **kwargs)
        instance.refresh_from_db()
        return response

    def check_object_permissions(self, request, obj):
        """Override to check project permissions for member objects."""
        # For destroy action, ensure user has a privileged project role.
        if self.action == 'destroy':
            project = obj.project
            if not can_manage_project_members(request.user, project):
                raise PermissionDenied('Only privileged project roles can remove members')
        super().check_object_permissions(request, obj)

    def create(self, request, *args, **kwargs):
        """Invite user to project."""
        project_id = self.kwargs.get('project_id')
        project = get_object_or_404(Project, id=project_id)

        # Invite is owner-only: verify actor is the authoritative project owner
        user = request.user
        if not can_invite_project_members(user, project):
            raise PermissionDenied('Only project owner can invite members')

        # Use ProjectMemberInviteSerializer for validation
        invite_serializer = ProjectMemberInviteSerializer(
            data=request.data,
            context={"request": request},
        )
        invite_serializer.is_valid(raise_exception=True)

        email = invite_serializer.validated_data['email']
        role = invite_serializer.validated_data.get('role', 'member')

        # Check if user exists
        try:
            invited_user = User.objects.get(email=email)
        except User.DoesNotExist:
            invited_user = None

        if invited_user and ProjectMember.objects.filter(
            user=invited_user,
            project=project,
            is_active=True,
        ).exists():
            raise ValidationError({
                'email': 'User is already a member of this project'
            })

        try:
            invitation = create_project_invitation(
                email=email,
                project=project,
                invited_by=user,
                role=role,
                auto_approve=False
            )

            invitation_serializer = ProjectInvitationSerializer(invitation, context={'request': request})
            message = 'Invitation created and pending owner approval.'
            return Response(
                {
                    'message': message,
                    'invitation': invitation_serializer.data,
                    'user_exists': invited_user is not None
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            logger.error(f"Failed to create invitation: {e}", exc_info=True)
            raise ValidationError({
                'email': f'Failed to send invitation: {str(e)}'
            })

    def perform_destroy(self, instance):
        """Remove member from project."""
        # Prevent removing project owner
        if instance.role == 'owner':
            raise ValidationError({
                'error': 'Cannot remove project owner'
            })

        # Deactivate instead of delete
        instance.is_active = False
        instance.save()


class ListProjectAvailableRolesView(APIView):
    """
    Return available project roles for the current organization.

    Used by frontend role dropdowns:
    - Invitation role selection (owner is not included)
    - Member role editing (owner is also excluded; ownership transfer is separate)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id: int):
        project = get_object_or_404(Project, id=project_id)

        # Prevent leaking role definitions to non-members.
        if not ProjectMember.objects.filter(
            user=request.user,
            project=project,
            is_active=True,
        ).exists():
            return Response(
                {'error': 'You do not have access to this project'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Keep role names in sync with frontend `getRoleBadgeClasses()` switch cases.
        # `owner` is excluded from dropdown responses.
        base_roles = {
            "member",
            "viewer",
            "Approver",
            "Reviewer",
            "Super Administrator",
            "Organization Admin",
            "Team Leader",
            "Campaign Manager",
            "Budget Controller",
            "Data Analyst",
            "Senior Media Buyer",
            "Specialist Media Buyer",
            "Junior Media Buyer",
            "Designer",
            "Copywriter",
        }

        user_org = getattr(request.user, "organization", None)
        role_qs = Role.objects.filter(is_deleted=False)
        if user_org:
            role_qs = role_qs.filter(Q(organization=user_org) | Q(organization__isnull=True))
        else:
            role_qs = role_qs.filter(organization__isnull=True)

        role_names = set(role_qs.values_list("name", flat=True))

        allowed_roles = (base_roles | role_names) - {"owner"}

        roles = [
            {"value": role_name, "label": role_name}
            for role_name in sorted(allowed_roles)
        ]
        return Response(
            {
                "roles": roles,
                "default_role": "member",
            },
            status=status.HTTP_200_OK,
        )


class AcceptInvitationView(APIView):
    """
    Accept a project invitation.
    If user doesn't exist, creates a new user account.
    """

    permission_classes = []  # Public endpoint

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data['token']
        password = serializer.validated_data.get('password')
        username = serializer.validated_data.get('username')

        # Check if user is authenticated
        user = request.user if request.user.is_authenticated else None

        # If user is authenticated, verify email matches invitation
        if user:
            try:
                invitation = ProjectInvitation.objects.get(token=token, accepted=False)
                if invitation.email != user.email:
                    return Response(
                        {
                            'error': 'Invitation email does not match your account email',
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except ProjectInvitation.DoesNotExist:
                return Response(
                    {'error': 'Invalid or already accepted invitation token'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            invitation, user, user_created = accept_invitation(
                token=token,
                user=user,
                password=password,
                username=username,
            )

            # Generate tokens for new users
            from rest_framework_simplejwt.tokens import RefreshToken

            refresh = RefreshToken.for_user(user)
            from core.serializers import UserSummarySerializer

            user_data = UserSummarySerializer(user).data

            response_data = {
                'message': 'Invitation accepted successfully',
                'user': user_data,
                'project': ProjectSummarySerializer(invitation.project, context={'request': request}).data,
                'user_created': user_created,
            }

            if user_created:
                response_data['token'] = str(refresh.access_token)
                response_data['refresh'] = str(refresh)

            return Response(response_data, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error accepting invitation: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to accept invitation. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ResendInvitationView(APIView):
    """Resend an invitation email."""

    permission_classes = [IsAuthenticated]

    def post(self, request, invitation_id):
        try:
            invitation = ProjectInvitation.objects.get(id=invitation_id)

            # Verify user has permission (must be project member)
            if not ProjectMember.objects.filter(
                user=request.user,
                project=invitation.project,
                is_active=True,
            ).exists():
                return Response(
                    {'error': 'You do not have permission to resend this invitation'},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Check if already accepted
            if invitation.accepted:
                return Response(
                    {'error': 'Invitation has already been accepted'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not invitation.approved:
                return Response(
                    {'error': 'Invitation is pending owner approval'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Resend email
            send_invitation_email(invitation)

            return Response(
                {
                    'message': 'Invitation email resent successfully',
                    'invitation': ProjectInvitationSerializer(invitation).data,
                },
                status=status.HTTP_200_OK,
            )

        except ProjectInvitation.DoesNotExist:
            return Response(
                {'error': 'Invitation not found'},
                status=status.HTTP_404_NOT_FOUND,
            )


class ListProjectInvitationsView(APIView):
    """List pending invitations for a project."""

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)

        # Verify user is a project member
        if not ProjectMember.objects.filter(
            user=request.user,
            project=project,
            is_active=True,
        ).exists():
            return Response(
                {'error': 'You do not have access to this project'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get pending invitations
        invitations = ProjectInvitation.objects.filter(
            project=project,
            accepted=False,
            approved=True,
        ).select_related('invited_by', 'project').order_by('-created_at')

        serializer = ProjectInvitationSerializer(invitations, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ListMyProjectInvitationsView(APIView):
    """List pending invitations for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        invitations = ProjectInvitation.objects.filter(
            email=request.user.email,
            accepted=False,
            expires_at__gt=timezone.now(),
        ).select_related('invited_by', 'project').order_by('-created_at')

        if project_id:
            invitations = invitations.filter(project_id=project_id)

        serializer = ProjectInvitationSerializer(invitations, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ListPendingInvitationApprovalsView(APIView):
    """List invitations awaiting owner approval."""

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)

        if not can_manage_project_members(request.user, project):
            return Response(
                {'error': 'Only privileged project roles can review invitations'},
                status=status.HTTP_403_FORBIDDEN,
            )

        invitations = ProjectInvitation.objects.filter(
            project=project,
            accepted=False,
            approved=False,
        ).select_related('invited_by', 'project').order_by('-created_at')

        serializer = ProjectInvitationSerializer(invitations, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ApproveProjectInvitationView(APIView):
    """Approve a pending invitation and send the invite email."""

    permission_classes = [IsAuthenticated]

    def post(self, request, project_id, invitation_id):
        project = get_object_or_404(Project, id=project_id)

        if not can_manage_project_members(request.user, project):
            return Response(
                {'error': 'Only privileged project roles can approve invitations'},
                status=status.HTTP_403_FORBIDDEN,
            )

        invitation = get_object_or_404(ProjectInvitation, id=invitation_id, project=project)

        if invitation.accepted:
            return Response(
                {'error': 'Invitation has already been accepted'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not invitation.approved:
            invitation.approved = True
            invitation.approved_by = request.user
            invitation.approved_at = timezone.now()
            invitation.save(update_fields=['approved', 'approved_by', 'approved_at'])
            send_invitation_email(invitation)

        serializer = ProjectInvitationSerializer(invitation, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class RejectProjectInvitationView(APIView):
    """Reject a pending invitation."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, project_id, invitation_id):
        project = get_object_or_404(Project, id=project_id)

        if not can_manage_project_members(request.user, project):
            return Response(
                {'error': 'Only privileged project roles can reject invitations'},
                status=status.HTTP_403_FORBIDDEN,
            )

        invitation = get_object_or_404(ProjectInvitation, id=invitation_id, project=project)

        if invitation.accepted:
            return Response(
                {'error': 'Invitation has already been accepted'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitation.delete()
        return Response({'message': 'Invitation rejected'}, status=status.HTTP_200_OK)
