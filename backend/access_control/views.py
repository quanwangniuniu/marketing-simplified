from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, Http404
from django.views import View
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.db import transaction
import json


from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser

from .models import Organization, Role, Permission, UserRole, RolePermission, ModuleApprover, Team
from core.models import OrganizationMembership, Permission as CorePermission
from core.models import Project
from .services import get_project_permission_matrix
from audit.utils import capture_snapshot, record_audit_entry

User = get_user_model()


def _permissions_snapshot(role):
    """
    Return a JSON-safe dict of the active permissions currently assigned to a role.
    Used as before/after payload for role.permissions_updated and role.permissions_copied.
    Format: {"permissions": ["ASSET_VIEW", "CAMPAIGN_EDIT", ...]}
    """
    perms = (
        RolePermission.objects
        .filter(role=role, is_deleted=False)
        .values_list('permission__module', 'permission__action')
    )
    return {'permissions': sorted(f"{m}_{a}" for m, a in perms)}


# original asset view
class AssetListView(View):
    def get(self, request):
        return JsonResponse({'assets': []})


class CampaignEditView(View):
    def put(self, request, pk):
        return JsonResponse({'campaign': pk})


# simplified organization view

@api_view(['GET'])
def organizations_list(request):
    """fetch organization list"""
    orgs = Organization.objects.filter(is_deleted=False)
    data = [{'id': org.id, 'name': org.name} for org in orgs]
    return Response(data)


@api_view(['GET'])
def teams_list(request):
    """fetch team list - using core models """
    from core.models import Team
    
    organization_id = request.query_params.get('organization_id')
    
    # Use core models
    if organization_id:
        teams = Team.objects.filter(
            organization_id=organization_id,
            is_deleted=False
        )
    else:
        teams = Team.objects.filter(is_deleted=False)
    
    data = []
    for team in teams:
        data.append({
            'id': team.id,
            'name': team.name,
            'organizationId': str(team.organization.id),
            'organization_id': team.organization.id
        })
    
    return Response(data)


@api_view(['GET', 'POST'])
def roles_list(request):
    """fetch role lists or create a new role"""
    if request.method == 'GET':
        try:
            organization_id = request.query_params.get('organization_id')

            # fetch roles by organization_id if provided
            if organization_id:
                # validate organization_id is a valid integer
                try:
                    organization_id = int(organization_id)
                    roles = Role.objects.filter(
                        organization_id=organization_id,
                        is_deleted=False
                    ).order_by('level')
                except (ValueError, TypeError):
                    return Response({'error': 'organization_id must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)               
            else:
                roles = Role.objects.filter(is_deleted=False).order_by('level')

            data = []
            for role in roles:
                data.append({
                    'id': role.id,
                    'name': role.name,
                    'description': f'Role: {role.name}',
                    'rank': role.level,
                    'level': role.level,
                    'organization_id': role.organization_id,
                    'isReadOnly': False
                })
            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)    
    
    elif request.method == 'POST':
        """Create a new role"""
        try:
            name = request.data.get('name')
            level = request.data.get('level')
            organization_id = request.data.get('organization_id')
            
            # Validate required fields
            if not name:
                return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            if level is None:
                return Response({'error': 'level is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate level is a positive integer
            try:
                level = int(level)
                if level < 0:
                    return Response({'error': 'level must be a positive integer'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({'error': 'level must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate and get organization if provided
            organization = None
            if organization_id is not None:
                try:
                    organization_id = int(organization_id)
                    try:
                        organization = get_object_or_404(Organization, id=organization_id, is_deleted=False)
                    except Http404:
                        return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)
                except (ValueError, TypeError):
                    return Response({'error': 'organization_id must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check for unique constraint violation (organization, name)
            # Handle None organization (system roles) correctly
            if organization is None:
                existing_role = Role.objects.filter(
                    organization__isnull=True,
                    name=name,
                    is_deleted=False
                ).first()
            else:
                existing_role = Role.objects.filter(
                    organization=organization,
                    name=name,
                    is_deleted=False
                ).first()
            
            if existing_role:
                return Response({
                    'error': f'Role with name "{name}" already exists for this organization'
                }, status=status.HTTP_409_CONFLICT)
            
            # Create the role and write an audit entry in one atomic operation so
            # a failure in either step rolls both back together.
            with transaction.atomic():
                role = Role.objects.create(
                    name=name,
                    level=level,
                    organization=organization
                )
                record_audit_entry(
                    actor=request.user if request.user.is_authenticated else None,
                    action='role.created',
                    target=role,
                    before=None,
                    after=capture_snapshot(role),
                )

            return Response({
                'id': role.id,
                'name': role.name,
                'description': f'Role: {role.name}',
                'rank': role.level,
                'level': role.level,
                'organization_id': role.organization_id,
                'isReadOnly': False
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT', 'DELETE'])
@parser_classes([JSONParser, FormParser, MultiPartParser])
def role_detail(request, role_id):
    """Update or delete a specific role"""
    try:
        role = get_object_or_404(Role, id=role_id, is_deleted=False)
    except Http404:
        return Response({'error': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'PUT':
        """Update an existing role"""
        try:
            # Capture state before any changes so the diff is accurate.
            before = capture_snapshot(role)

            name = request.data.get('name')
            level = request.data.get('level')
            organization_id = request.data.get('organization_id')
            
            # Validate level if provided
            if level is not None:
                try:
                    level = int(level)
                    if level < 0:
                        return Response({'error': 'level must be a positive integer'}, status=status.HTTP_400_BAD_REQUEST)
                except (ValueError, TypeError):
                    return Response({'error': 'level must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate and get organization if provided
            organization = role.organization  # Keep existing organization by default
            should_update_org = False
            
            # Handle organization_id: check if key exists in request data
            # JSON null becomes Python None, so we need to check if the key exists
            if 'organization_id' in request.data:
                should_update_org = True
                if organization_id is None or organization_id == "" or str(organization_id).lower() == "null":
                    # Set to system role (no organization)
                    organization = None
                else:
                    try:
                        organization_id = int(organization_id)
                        try:
                            organization = get_object_or_404(Organization, id=organization_id, is_deleted=False)
                        except Http404:
                            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)
                    except (ValueError, TypeError):
                        return Response({'error': 'organization_id must be a valid integer, empty string, or null'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Update fields if provided
            if name is not None:
                # Check for unique constraint violation if name is being changed
                # Use the target organization (either current or new) for validation
                check_org = organization if should_update_org else role.organization
                if name != role.name or should_update_org:
                    # Handle None organization (system roles) correctly
                    if check_org is None:
                        existing_role = Role.objects.filter(
                            organization__isnull=True,
                            name=name,
                            is_deleted=False
                        ).exclude(id=role_id).first()
                    else:
                        existing_role = Role.objects.filter(
                            organization=check_org,
                            name=name,
                            is_deleted=False
                        ).exclude(id=role_id).first()
                    
                    if existing_role:
                        return Response({
                            'error': f'Role with name "{name}" already exists for this organization'
                        }, status=status.HTTP_409_CONFLICT)
                role.name = name
            
            if level is not None:
                role.level = level
            
            if should_update_org:
                role.organization = organization

            # Save and record audit in one atomic operation.
            with transaction.atomic():
                role.save()
                record_audit_entry(
                    actor=request.user if request.user.is_authenticated else None,
                    action='role.updated',
                    target=role,
                    before=before,
                    after=capture_snapshot(role),
                )

            return Response({
                'id': role.id,
                'name': role.name,
                'description': f'Role: {role.name}',
                'rank': role.level,
                'level': role.level,
                'organization_id': role.organization_id,
                'isReadOnly': False
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    elif request.method == 'DELETE':
        """Permanently delete a role"""
        try:
            # Snapshot before deletion; the object still holds its field values
            # in memory after .delete() so it can still be passed as target.
            before = capture_snapshot(role)

            with transaction.atomic():
                role.delete()
                record_audit_entry(
                    actor=request.user if request.user.is_authenticated else None,
                    action='role.deleted',
                    target=role,
                    before=before,
                    after=None,
                )

            return Response({
                'message': f'Role "{before["name"]}" has been deleted successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def permissions_list(request):
    """fetch permission list"""
    permissions = Permission.objects.filter(is_deleted=False)
    data = []
    for perm in permissions:
        # transfer modules' name to the format expected by frontend
        module_map = {
            'ASSET': 'Asset Management',
            'CAMPAIGN': 'Campaign Execution',
            'BUDGET_REQUEST': 'Budget Request',
            'BUDGET_POOL': 'Budget Pool',
            'BUDGET_ESCALATION': 'Budget Escalation',
            'REPORT': 'Report',
        }
        
        data.append({
            'id': f"{perm.module.lower()}_{perm.action.lower()}",
            'name': f'{perm.action} {perm.module}',
            'description': f'{perm.action} access for {perm.module} module',
            'module': module_map.get(perm.module, perm.module),
            'action': perm.action.capitalize()
        })
    
    return Response(data)


@api_view(['GET'])
def role_permissions_list(request):
    """Fetch rolepermission"""
    role_id = request.query_params.get('role_id')
    
    if role_id:
        role_perms = RolePermission.objects.filter(
            role_id=role_id,
            is_deleted=False
        )
    else:
        role_perms = RolePermission.objects.filter(is_deleted=False)
    
    data = []
    for rp in role_perms:
        data.append({
            'roleId': str(rp.role_id),
            'permissionId': f"{rp.permission.module.lower()}_{rp.permission.action.lower()}",
            'granted': True,
            'role_id': rp.role_id,
            'permission_id': rp.permission_id
        })
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def project_permission_matrix(request, project_id):
    """Return the effective role x permission matrix for a project."""
    try:
        project = Project.objects.select_related("organization").get(id=project_id, is_deleted=False)
        can_view = request.user.is_superuser or (
            project.organization_id
            and OrganizationMembership.objects.filter(
                user=request.user,
                organization_id=project.organization_id,
                is_active=True,
                role="admin",
            ).exists()
        )
        if not can_view:
            return Response({'error': 'Permission matrix access requires organization admin rights.'}, status=status.HTTP_403_FORBIDDEN)
        data = get_project_permission_matrix(project_id)
        return Response(data, status=status.HTTP_200_OK)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
def update_role_permissions(request, role_id):
    """Updated permission of a specific role"""
    try:
        # check if the role exist or not
        role = get_object_or_404(Role, id=role_id, is_deleted=False)

        # fetch request data
        permissions_data = request.data.get('permissions', [])

        if not permissions_data:
            return Response({'error': 'No permissions data provided'}, status=400)

        # Capture the permission set before any changes for the audit diff.
        before = _permissions_snapshot(role)

        # start to updating permissions
        success_count = 0
        error_count = 0
        
        for perm_data in permissions_data:
            permission_id = perm_data.get('permission_id') or perm_data.get('permissionId')
            granted = perm_data.get('granted', True)
            
            if not permission_id:
                error_count += 1
                continue
            
            # decode permission_id (format: "asset_view" or "budget_request_view" -> module=ASSET/BUDGET_REQUEST, action=VIEW)
            # Note: Action is always a single word (VIEW, EDIT, APPROVE, DELETE, EXPORT)
            # Module can contain underscores (BUDGET_REQUEST, BUDGET_POOL, etc.)
            # So we split from the right to get the last part as action
            try:
                if isinstance(permission_id, str) and '_' in permission_id:
                    # Split from the right: "budget_request_view" -> ["budget_request", "view"]
                    # This handles modules with underscores like "BUDGET_REQUEST"
                    parts = permission_id.rsplit('_', 1)
                    if len(parts) == 2:
                        module_part = parts[0]  # "budget_request"
                        action_part = parts[1]  # "view"
                        module = module_part.upper()  # "BUDGET_REQUEST"
                        action = action_part.upper()  # "VIEW"
                    else:
                        # Fallback: try to find by matching known actions from Permission model
                        # Get all valid actions from Permission.ACTION_CHOICES dynamically
                        # This ensures we stay in sync with model changes
                        known_actions = [choice[0] for choice in CorePermission.ACTION_CHOICES]
                        for known_action in known_actions:
                            if permission_id.lower().endswith('_' + known_action.lower()):
                                action = known_action
                                module = permission_id[:-len('_' + known_action.lower())].upper()
                                break
                        else:
                            # If no known action found, try old method as fallback
                            module_part, action_part = permission_id.split('_', 1)
                            module = module_part.upper()
                            action = action_part.upper()
                else:
                    # if the ID is integer format，search by id
                    permission = Permission.objects.get(id=permission_id, is_deleted=False)
                    module = permission.module
                    action = permission.action
            except (ValueError, Permission.DoesNotExist) as e:
                error_count += 1
                print(f"Error parsing permission_id '{permission_id}': {e}")
                continue
            
            try:
                # Search by permission
                permission = Permission.objects.get(
                    module=module, 
                    action=action, 
                    is_deleted=False
                )
                
                if granted:
                    # Add permission（if not exist）
                    role_perm, created = RolePermission.objects.get_or_create(
                        role=role,
                        permission=permission,
                        defaults={'created_at': timezone.now()}
                    )
                    if created or role_perm.is_deleted:
                        role_perm.is_deleted = False
                        role_perm.updated_at = timezone.now()
                        role_perm.save()
                        success_count += 1
                        print(f"✅ Permission granted: role={role_id}, permission={permission_id} (module={module}, action={action})")
                    else:
                        # Already exists and not deleted
                        success_count += 1
                else:
                    # remove permission
                    try:
                        role_perm = RolePermission.objects.get(
                            role=role,
                            permission=permission
                        )
                        role_perm.is_deleted = True
                        role_perm.updated_at = timezone.now()
                        role_perm.save()
                        success_count += 1
                        print(f"✅ Permission removed: role={role_id}, permission={permission_id} (module={module}, action={action})")
                    except RolePermission.DoesNotExist:
                        # permission does not exist, already in desired state
                        success_count += 1
                        print(f"✅ Permission already removed: role={role_id}, permission={permission_id}")
                        
            except Permission.DoesNotExist:
                error_count += 1
                print(f"❌ Permission not found: permission_id={permission_id}, parsed as module={module}, action={action}")
                continue
        # Record which permissions were added/removed.
        record_audit_entry(
            actor=request.user if request.user.is_authenticated else None,
            action='role.permissions_updated',
            target=role,
            before=before,
            after=_permissions_snapshot(role),
        )

        return Response({
            'message': f'Permissions updated successfully. {success_count} updated, {error_count} errors.',
            'success_count': success_count,
            'error_count': error_count
        })

    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['POST'])
def copy_role_permissions(request, to_role_id):
    """copy role permissions"""
    try:
        from_role_id = request.data.get('from_role_id')
        
        if not from_role_id:
            return Response({'error': 'from_role_id is required'}, status=400)
        
        # check if the two roles both exist
        from_role = get_object_or_404(Role, id=from_role_id, is_deleted=False)
        to_role = get_object_or_404(Role, id=to_role_id, is_deleted=False)

        # Capture the destination role's permissions before the copy.
        before = _permissions_snapshot(to_role)

        # fetch all permissions of the roles
        source_permissions = RolePermission.objects.filter(
            role=from_role,
            is_deleted=False
        )
        
        # Temporarily delete the permissions of the role
        existing_permissions = RolePermission.objects.filter(
            role=to_role,
            is_deleted=False
        )
        existing_permissions.update(is_deleted=True, updated_at=timezone.now())
        
        # copy permissions
        copied_count = 0
        for source_perm in source_permissions:
            role_perm, created = RolePermission.objects.get_or_create(
                role=to_role,
                permission=source_perm.permission,
                defaults={'created_at': timezone.now()}
            )
            
            if created or role_perm.is_deleted:
                role_perm.is_deleted = False
                role_perm.updated_at = timezone.now()
                role_perm.save()
                copied_count += 1
        # Record what the destination role's permissions looked like before and after.
        record_audit_entry(
            actor=request.user if request.user.is_authenticated else None,
            action='role.permissions_copied',
            target=to_role,
            before=before,
            after=_permissions_snapshot(to_role),
        )

        return Response({
            'message': f'Successfully copied {copied_count} permissions from {from_role.name} to {to_role.name}',
            'copied_count': copied_count
        })

    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['GET'])
def user_permissions(request, user_id):
    """Fetch user permissions"""
    try:
        user = User.objects.get(id=user_id, is_active=True)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    
    # fetch existed userrole
    now = timezone.now()
    active_roles = UserRole.objects.filter(
        user=user,
        valid_from__lte=now,
        is_deleted=False
    ).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=now)
    ).values_list('role_id', flat=True)
    
    if not active_roles:
        return Response([])
    
    # fetch permissions of these roles
    permissions = Permission.objects.filter(
        permission_roles__role_id__in=active_roles,
        permission_roles__is_deleted=False,
        is_deleted=False
    ).distinct()
    
    data = []
    for perm in permissions:
        data.append({
            'id': perm.id,
            'module': perm.module,
            'action': perm.action
        })
    
    return Response(data)


@api_view(['POST']) 
def check_permission(request):
    """Check users' permissions"""
    user_id = request.data.get('user_id') or request.data.get('userId')
    module = request.data.get('module')
    action = request.data.get('action')
    
    if not all([user_id, module, action]):
        return Response({'error': 'Missing required fields'}, status=400)
    
    try:
        user = User.objects.get(id=user_id, is_active=True)
    except User.DoesNotExist:
        return Response({'allowed': False, 'reason': 'User not found'})
    
    # updated later
    return Response({'allowed': True})


@api_view(['GET'])
def approver_list(request):
    """fetch all users that can be configured as approvers"""
    try:
        users = User.objects.all().values('id', 'username', 'email')
        return Response(list(users))
    except Exception as e:
        print(f"[approver_list] Exception: {e}")
        import traceback; traceback.print_exc()
        return Response({'error': str(e)}, status=500)

@api_view(['GET', 'POST'])
def approver_detail(request, permission_id):
    try:
        permission = get_object_or_404(Permission, id=permission_id)
        User = get_user_model()
        if request.method == 'GET':
            approvers = PermissionApprover.objects.filter(permission=permission)
            users = User.objects.filter(id__in=approvers.values_list('user_id', flat=True)).values('id', 'username', 'email')
            return Response(list(users))
        elif request.method == 'POST':
            user_ids = request.data.get('user_ids', [])
            # delete approver not in user_id
            PermissionApprover.objects.filter(permission=permission).exclude(user_id__in=user_ids).delete()
            # add new approvers
            for user_id in user_ids:
                PermissionApprover.objects.get_or_create(permission=permission, user_id=user_id)
            return Response({'status': 'success'})
    except Exception as e:
        print(f"[approver_detail] Exception: {e}")
        import traceback; traceback.print_exc()
        return Response({'error': str(e)}, status=500)

@api_view(['DELETE'])
def approver_remove(request, permission_id, user_id):
    try:
        permission = get_object_or_404(Permission, id=permission_id)
        PermissionApprover.objects.filter(permission=permission, user_id=user_id).delete()
        return Response({'status': 'deleted'})
    except Exception as e:
        print(f"[approver_remove] Exception: {e}")
        import traceback; traceback.print_exc()
        return Response({'error': str(e)}, status=500)

@api_view(['GET', 'POST'])
def module_approver_detail(request, module):
    module = module.upper()
    User = get_user_model()
    if request.method == 'GET':
        approvers = ModuleApprover.objects.filter(module=module)

        # if no approvers, return empty list
        if not approvers.exists():
            return Response([])

        users = User.objects.filter(id__in=approvers.values_list('user_id', flat=True)).values('id', 'username', 'email')
        return Response(list(users))
    elif request.method == 'POST':
        user_ids = request.data.get('user_ids', [])
        ModuleApprover.objects.filter(module=module).exclude(user_id__in=user_ids).delete()
        for user_id in user_ids:
            ModuleApprover.objects.get_or_create(module=module, user_id=user_id)
        return Response({'status': 'success'})

@api_view(['DELETE'])
def module_approver_remove(request, module, user_id):
    module = module.upper()
    ModuleApprover.objects.filter(module=module, user_id=user_id).delete()
    return Response({'status': 'deleted'})

@api_view(['POST'])
def assign_user_role(request, user_id: int):
    """
    Assign an existing role to a user (optional binding team)
    Body: { "role_id": int, "team_id": int|null, "valid_from": isoString?, "valid_to": isoString? }
    Rules:
      - If the same (user, role, team) exists and is soft deleted, it will be restored (is_deleted=False), and the validity period will be updated
      - If a non-deleted record exists, return 409 conflict (to avoid duplicate assignment)
    """
    try:
        role_id = request.data.get('role_id')
        team_id = request.data.get('team_id', None)
        valid_from = request.data.get('valid_from', None)
        valid_to = request.data.get('valid_to', None)

        if not role_id:
            return Response({"error": "role_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Basic entity validation
        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found or inactive"}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            role = Role.objects.get(id=role_id, is_deleted=False)
        except Role.DoesNotExist:
            return Response({"error": "Role not found or deleted"}, status=status.HTTP_404_NOT_FOUND)
        
        team = None
        if team_id is not None:
            try:
                team = Team.objects.get(id=team_id, is_deleted=False)
            except Team.DoesNotExist:
                return Response({"error": "Team not found or deleted"}, status=status.HTTP_404_NOT_FOUND)

        # Handle validity period
        now = timezone.now()
        try:
            parsed_from = timezone.datetime.fromisoformat(valid_from) if valid_from else now
            if parsed_from.tzinfo is None:
                parsed_from = parsed_from.replace(tzinfo=timezone.get_current_timezone())
        except (ValueError, TypeError) as e:
            parsed_from = now

        parsed_to = None
        if valid_to:
            try:
                parsed_to = timezone.datetime.fromisoformat(valid_to)
                if parsed_to.tzinfo is None:
                    parsed_to = parsed_to.replace(tzinfo=timezone.get_current_timezone())
            except (ValueError, TypeError):
                return Response({"error": "valid_to must be a valid ISO datetime string"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate date range
        if parsed_to and parsed_from and parsed_to < parsed_from:
            return Response({"error": "valid_to must be after valid_from"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # Check if there is a UserRole with the same (user, role, team)
                existing = UserRole.objects.filter(user=user, role=role, team=team).first()

                if existing:
                    if existing.is_deleted:
                        # Restore the UserRole
                        existing.is_deleted = False
                        existing.valid_from = parsed_from
                        existing.valid_to = parsed_to
                        existing.save(update_fields=['is_deleted', 'valid_from', 'valid_to', 'updated_at'])
                        status_code = status.HTTP_200_OK
                        created = False
                    else:
                        # A valid mapping already exists
                        return Response({
                            "error": "UserRole already exists",
                            "detail": {"user_id": user.id, "role_id": role.id, "team_id": team.id if team else None}
                        }, status=status.HTTP_409_CONFLICT)
                else:
                    # Create a new UserRole
                    ur = UserRole.objects.create(
                        user=user,
                        role=role,
                        team=team,
                        valid_from=parsed_from,
                        valid_to=parsed_to
                    )
                    existing = ur
                    status_code = status.HTTP_201_CREATED
                    created = True

                # Audit the assignment inside the same transaction so it rolls
                # back together if anything above fails.
                record_audit_entry(
                    actor=request.user if request.user.is_authenticated else None,
                    action='user_role.assigned',
                    target=user,
                    before=None,
                    after={
                        'role_id': role.id,
                        'role_name': role.name,
                        'team_id': team.id if team else None,
                        'valid_from': str(parsed_from),
                        'valid_to': str(parsed_to) if parsed_to else None,
                    },
                )

            return Response({
                "message": "user role assigned" if created else "user role restored",
                "user_role": {
                    "user_id": existing.user_id,
                    "role_id": existing.role_id,
                    "team_id": existing.team_id,
                    "valid_from": existing.valid_from,
                    "valid_to": existing.valid_to
                }
            }, status=status_code)
            
        except Exception as e:
            return Response({
                "error": "Failed to assign user role",
                "detail": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        return Response({
            "error": "An unexpected error occurred",
            "detail": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
def remove_user_role(request, user_id: int, role_id: int):
    """
    Remove a user role permanently
    Query conditions:
      - Must pass team_id, or explicitly specify no team (team_id is empty string "")
    """
    try:
        team_id = request.query_params.get('team_id', None)
        
        # Validate user
        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found or inactive"}, status=status.HTTP_404_NOT_FOUND)
        
        # Validate role
        try:
            role = Role.objects.get(id=role_id, is_deleted=False)
        except Role.DoesNotExist:
            return Response({"error": "Role not found or deleted"}, status=status.HTTP_404_NOT_FOUND)
        
        # Validate team parameter
        if team_id == "":
            # Explicitly delete the UserRole record with team=None
            team = None
        elif team_id is None:
            # Ambiguous request - it is required to provide a team_id or an empty string to target team=None
            return Response({"error": "team_id is required (use empty string to target team=None)"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                team = Team.objects.get(id=team_id, is_deleted=False)
            except Team.DoesNotExist:
                return Response({"error": "Team not found or deleted"}, status=status.HTTP_404_NOT_FOUND)

        # Find the UserRole
        try:
            ur = UserRole.objects.get(user=user, role=role, team=team, is_deleted=False)
        except UserRole.DoesNotExist:
            return Response({"error": "UserRole not found"}, status=status.HTTP_404_NOT_FOUND)
        except UserRole.MultipleObjectsReturned:
            # This shouldn't happen due to unique_together, but handle it just in case
            return Response({"error": "Multiple UserRole records found"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Capture before deletion; the object still holds its data in memory after .delete().
        before = {
            'role_id': role.id,
            'role_name': role.name,
            'team_id': team.id if team else None,
            'valid_from': str(ur.valid_from),
            'valid_to': str(ur.valid_to) if ur.valid_to else None,
        }

        # Delete and audit in one atomic operation.
        try:
            with transaction.atomic():
                ur.delete()
                record_audit_entry(
                    actor=request.user if request.user.is_authenticated else None,
                    action='user_role.removed',
                    target=user,
                    before=before,
                    after=None,
                )
        except Exception as e:
            return Response({
                "error": "Failed to remove user role",
                "detail": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'message': f'User role "{role.name}" has been removed successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            "error": "An unexpected error occurred",
            "detail": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
