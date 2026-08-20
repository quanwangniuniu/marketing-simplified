from django.urls import path
from .views import (
    # original test views
    AssetListView, CampaignEditView,

    # simplified views
    organizations_list, teams_list, roles_list, role_detail, permissions_list,
    role_permissions_list, update_role_permissions, copy_role_permissions,
    user_permissions, check_permission, approver_list, approver_detail, approver_remove,
    module_approver_detail, module_approver_remove, assign_user_role, remove_user_role,
    project_permission_matrix, admin_override_audit_list
)

urlpatterns = [
    # original test endpoints
    path('assets/list/', AssetListView.as_view(), name='asset-list'),
    path('campaigns/<int:pk>/edit/', CampaignEditView.as_view(), name='campaign-edit'),
    
    # core endpoints needed from the frontend
    path('organizations/', organizations_list, name='organizations'),
    path('teams/', teams_list, name='teams'),
    path('permissions/', permissions_list, name='permissions'),
    path('role-permissions/', role_permissions_list, name='role-permissions'),
    path('projects/<int:project_id>/permission-matrix/', project_permission_matrix, name='project-permission-matrix'),
    
    # permissions management endpoints (more specific routes first)
    path('roles/<int:role_id>/permissions/', update_role_permissions, name='update-role-permissions'),
    path('roles/<int:to_role_id>/copy-permissions/', copy_role_permissions, name='copy-role-permissions'),
    
    # role endpoints
    path('roles/', roles_list, name='roles'),
    path('roles/<int:role_id>/', role_detail, name='role-detail'),
    path('users/<int:user_id>/permissions/', user_permissions, name='user-permissions'),
    path('permissions/check/', check_permission, name='permission-check'),
    path('users/<int:user_id>/roles/', assign_user_role, name='assign-user-role'),
    path('users/<int:user_id>/roles/<int:role_id>/', remove_user_role, name='remove-user-role'),

    # Approver related API
    path('approvers/', approver_list, name='approver-list'),
    # path('approvers/<str:permission_id>/', approver_detail, name='approver-detail'),
    # path('approvers/<str:permission_id>/<int:user_id>/', approver_remove, name='approver-remove'),
    path('approvers/<str:module>/', module_approver_detail, name='module-approver-detail'),
    path('approvers/<str:module>/<int:user_id>/', module_approver_remove, name='module-approver-remove'),

    # override audit log
    path('admin-override-audits/', admin_override_audit_list, name='admin-override-audit-list'),
]
