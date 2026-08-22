from django.urls import path, include
from rest_framework.routers import DefaultRouter

from core.views import (
    AcceptInvitationView,
    AcceptOrganizationInvitationView,
    ApproveProjectInvitationView,
    CheckProjectMembershipView,
    CreateOrganizationInvitationView,
    CreateOrganizationView,
    JoinOrganizationBySlugView,
    KPISuggestionsView,
    LeaveOrganizationView,
    ListMyProjectInvitationsView,
    ListOrganizationInvitationsView,
    ListPendingInvitationApprovalsView,
    ListProjectAvailableRolesView,
    ListProjectInvitationsView,
    OnboardingStatusView,
    OrganizationDetailView,
    OrganizationMembersView,
    PersonalDataExportDownloadView,
    PersonalDataExportRequestDetailView,
    PersonalDataExportRequestListCreateView,
    ProjectMemberViewSet,
    ProjectOnboardingView,
    ProjectViewSet,
    RejectProjectInvitationView,
    RemoveOrganizationMemberView,
    ResendInvitationView,
    RevokeOrganizationInvitationView,
    SwitchOrganizationView,
    UpdateOrganizationSlugView,
    UserOrganizationsView,
    ValidateOrganizationSlugView,
)
from core.admin_views import AdminOrganizationViewSet
from core.quick_start_views import QuickStartConfirmView, QuickStartPreviewView

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(
    r'projects/(?P<project_id>[^/.]+)/members',
    ProjectMemberViewSet,
    basename='project-member'
)
router.register(r'admin/organizations', AdminOrganizationViewSet, basename='admin-organization')

urlpatterns = [
    path('check-project-membership/', CheckProjectMembershipView.as_view(), name='check-project-membership'),
    path('onboarding-status/', OnboardingStatusView.as_view(), name='onboarding-status'),
    path('projects/onboarding/', ProjectOnboardingView.as_view(), name='project-onboarding'),
    path(
        'projects/quick-start/preview/',
        QuickStartPreviewView.as_view(),
        name='quick-start-preview',
    ),
    path(
        'projects/quick-start/confirm/',
        QuickStartConfirmView.as_view(),
        name='quick-start-confirm',
    ),
    path('kpi-suggestions/', KPISuggestionsView.as_view(), name='kpi-suggestions'),

    # Multi-Organization Management endpoints
    path('organizations/', UserOrganizationsView.as_view(), name='user-organizations'),
    path('organizations/create/', CreateOrganizationView.as_view(), name='create-organization'),
    path('organizations/validate-slug/', ValidateOrganizationSlugView.as_view(), name='validate-organization-slug'),
    path('organizations/join/', JoinOrganizationBySlugView.as_view(), name='join-organization-by-slug'),
    path('organizations/switch/', SwitchOrganizationView.as_view(), name='switch-organization'),
    path('organizations/<str:org_id>/', OrganizationDetailView.as_view(), name='organization-detail'),
    path('organizations/<str:org_id>/members/', OrganizationMembersView.as_view(), name='organization-members'),
    path('organizations/<str:org_id>/members/<int:user_id>/', RemoveOrganizationMemberView.as_view(), name='remove-organization-member'),
    path('organizations/<str:org_id>/leave/', LeaveOrganizationView.as_view(), name='leave-organization'),
    path('organizations/<str:org_id>/slug/', UpdateOrganizationSlugView.as_view(), name='update-organization-slug'),

    # Organization Invitation endpoints
    path('organizations/<str:org_id>/invitations/', CreateOrganizationInvitationView.as_view(), name='create-org-invitation'),
    path('organizations/<str:org_id>/invitations/list/', ListOrganizationInvitationsView.as_view(), name='list-org-invitations'),
    path('organizations/<str:org_id>/invitations/<int:invitation_id>/', RevokeOrganizationInvitationView.as_view(), name='revoke-org-invitation'),
    path('invitations/accept-organization/', AcceptOrganizationInvitationView.as_view(), name='accept-org-invitation'),

    # Project Invitation endpoints
    path('privacy/export-requests/', PersonalDataExportRequestListCreateView.as_view(), name='privacy-export-requests'),
    path('privacy/export-requests/<uuid:export_id>/', PersonalDataExportRequestDetailView.as_view(), name='privacy-export-detail'),
    path('privacy/export-requests/<uuid:export_id>/download/', PersonalDataExportDownloadView.as_view(), name='privacy-export-download'),
    path('invitations/accept/', AcceptInvitationView.as_view(), name='accept-invitation'),
    path('invitations/pending/', ListMyProjectInvitationsView.as_view(), name='list-my-project-invitations'),
    path('invitations/<int:invitation_id>/resend/', ResendInvitationView.as_view(), name='resend-invitation'),
    path('projects/<str:project_id>/invitations/', ListProjectInvitationsView.as_view(), name='list-project-invitations'),
    path('projects/<str:project_id>/invitations/pending-approval/', ListPendingInvitationApprovalsView.as_view(), name='list-pending-invitation-approvals'),
    path('projects/<str:project_id>/invitations/<int:invitation_id>/approve/', ApproveProjectInvitationView.as_view(), name='approve-project-invitation'),
    path('projects/<str:project_id>/invitations/<int:invitation_id>/reject/', RejectProjectInvitationView.as_view(), name='reject-project-invitation'),
    path('projects/<str:project_id>/roles/', ListProjectAvailableRolesView.as_view(), name='list-project-roles'),
    path('', include(router.urls)),
]
