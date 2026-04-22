'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import React, { useState, useEffect, useMemo } from 'react';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { usePermissionData } from '@/hooks/usePermissionData';
import { Role, SelectOption } from '@/types/permission';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PermissionAPI } from '@/lib/api/permissionApi';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePermissionEditControl } from '@/hooks/usePermissionEditControl';
import { useOrganizationFilter } from '@/hooks/useOrganizationFilter';
import Modal from '@/components/ui/Modal';
import NewRoleForm from '@/components/admin/NewRoleForm';
import { AlertCircle, RefreshCw } from 'lucide-react';

// Component for editing a single role
interface EditRoleFormItemProps {
  role: Role;
  organizationId?: string;
  name: string;
  level: number | '';
  onNameChange: (name: string) => void;
  onLevelChange: (level: number | '') => void;
  error?: string | null;
  isSaving?: boolean;
}

const EditRoleFormItem: React.FC<EditRoleFormItemProps> = ({ 
  role, 
  organizationId,
  name,
  level,
  onNameChange,
  onLevelChange,
  error,
  isSaving = false
}) => {
  const { getCurrentUserHighestRole } = usePermissionEditControl();

  // Get current user's highest permission role
  const currentUserHighestRole = getCurrentUserHighestRole();

  // Check if this role is the current user's highest permission role
  const isUserHighestRole = currentUserHighestRole?.id === role.id;

  return (
    <div className={`p-4 border rounded-lg ${isUserHighestRole ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">Role ID: {role.id}</h4>
            {isUserHighestRole && (
              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-200 text-yellow-800 rounded">
                Your Highest Permission Role
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {name.trim() !== role.name || level !== role.rank ? 'Modified' : 'No changes'}
          </div>
        </div>

        {isUserHighestRole && (
          <div className="p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
            ⚠️ This is your highest permission role. You cannot edit or delete it as it would affect your access to manage roles.
          </div>
        )}

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-700">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                onNameChange(e.target.value);
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isSaving || isUserHighestRole}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-700">
              Level <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={level}
              onChange={(e) => {
                const value = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                onLevelChange(value);
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isSaving || isUserHighestRole}
            />
          </div>
        </div>
      </div>
    </div>
  );
};


const RolesPage: React.FC = () => {
  const [organizationRoles, setOrganizationRoles] = useState<Role[]>([]);
  const [loadingOrgRoles, setLoadingOrgRoles] = useState(false);
  const [errorOrgRoles, setErrorOrgRoles] = useState<string | null>(null);
  const [isSystemRoleModalOpen, setIsSystemRoleModalOpen] = useState(false);
  const [isOrgRoleModalOpen, setIsOrgRoleModalOpen] = useState(false);
  const [isEditRolesModalOpen, setIsEditRolesModalOpen] = useState(false);
  const [selectedSystemRoles, setSelectedSystemRoles] = useState<Set<string>>(new Set());
  const [selectedOrgRoles, setSelectedOrgRoles] = useState<Set<string>>(new Set());
  const [editingSystemRoles, setEditingSystemRoles] = useState(false);
  const [editingOrgRoles, setEditingOrgRoles] = useState(false);
  const [currentEditMode, setCurrentEditMode] = useState<'system' | 'organization' | null>(null);
  // State for managing role edits
  const [roleEdits, setRoleEdits] = useState<Map<string, { name: string; level: number | '' }>>(new Map());
  const [saveErrors, setSaveErrors] = useState<Map<string, string>>(new Map());
  const [isSavingAll, setIsSavingAll] = useState(false);
  const { organizations, roles, filters, setFilters, loading, error, refreshData } = usePermissionData();
  const { 
    getUserPermissionLevel, 
    userRoles,
    getCurrentUserHighestRole,
    hasSystemAccess,
    loading: userLoading,
    error: userError,
    refresh: refreshUserRoles
  } = usePermissionEditControl();

  // Get current user's highest permission role
  const currentUserHighestRole = getCurrentUserHighestRole();

  // Use organization filter hook
  const { currentUserOrganization, organizationOptions } = useOrganizationFilter(
    organizations,
    hasSystemAccess()
  );

  // Validate and reset organization filter if user doesn't have access
  useEffect(() => {
    const systemAccess = hasSystemAccess();
    if (!systemAccess && currentUserOrganization && filters.organizationId) {
      // If user doesn't have system access and has selected an organization
      // that is not their own, reset to their organization
      if (filters.organizationId !== currentUserOrganization) {
        console.log('⚠️ User selected organization they don\'t have access to, resetting to their organization');
        setFilters({ 
          ...filters,
          organizationId: currentUserOrganization
        });
      }
    } else if (!systemAccess && currentUserOrganization && !filters.organizationId) {
      // If user doesn't have system access and no organization is selected,
      // auto-select their organization
      setFilters({ 
        ...filters,
        organizationId: currentUserOrganization
      });
    }
  }, [hasSystemAccess, currentUserOrganization, filters.organizationId, setFilters]);

  // Get global roles
  const globalRoles = useMemo(
    () => (roles || []).filter((r: any) => {
      const orgId = r.organizationId ?? r.organization_id;
      return orgId == null || orgId === '' || orgId === 'null';
    }),
    [roles]
  );

  const handleRoleCreated = async () => {
    // Refresh roles data
    // Note: usePermissionData hook should automatically refresh, but we can trigger a manual refresh if needed
    setIsSystemRoleModalOpen(false);
    setIsOrgRoleModalOpen(false);
    // Optionally refresh the page or reload data here
    window.location.reload(); // Simple solution, or you can add a refresh method to usePermissionData
  };

  // Fetch roles by organization_id
  useEffect(() => {
    const fetchOrganizationRoles = async () => {
      try {
        setLoadingOrgRoles(true);
        setErrorOrgRoles(null);
        const roles = await PermissionAPI.getRolesByOrganization(filters.organizationId);
        setOrganizationRoles(roles);
      } catch (error) {
        console.error('Failed to fetch organization roles:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load organization roles';
        setErrorOrgRoles(errorMessage);
        setOrganizationRoles([]);
      } finally {
        setLoadingOrgRoles(false);
      }
    };
    if (filters.organizationId) {
      fetchOrganizationRoles();
    } else {
      // Clear organization roles when no organization is selected
      setOrganizationRoles([]);
      setErrorOrgRoles(null);
    }
  }, [filters.organizationId]);

  // Handle refresh
  const handleRefresh = async () => {
    try {
      await Promise.all([
        refreshData(),
        refreshUserRoles(true)
      ]);
      // Also refresh organization roles if an organization is selected
      if (filters.organizationId) {
        try {
          setLoadingOrgRoles(true);
          setErrorOrgRoles(null);
          const roles = await PermissionAPI.getRolesByOrganization(filters.organizationId);
          setOrganizationRoles(roles);
        } catch (error) {
          console.error('Failed to refresh organization roles:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to refresh organization roles';
          setErrorOrgRoles(errorMessage);
        } finally {
          setLoadingOrgRoles(false);
        }
      }
    } catch (error) {
      console.error('❌ Refresh failed:', error);
    }
  };


  const handleSystemRoleSelection = (roleId: string) => {
    const newSelected = new Set(selectedSystemRoles);
    if (newSelected.has(roleId)) {
      newSelected.delete(roleId);
    } else {
      newSelected.add(roleId);
    }
    setSelectedSystemRoles(newSelected);
    setEditingSystemRoles(newSelected.size > 0);
  };

  const handleOrgRoleSelection = (roleId: string) => {
    const newSelected = new Set(selectedOrgRoles);
    if (newSelected.has(roleId)) {
      newSelected.delete(roleId);
    } else {
      newSelected.add(roleId);
    }
    setSelectedOrgRoles(newSelected);
    setEditingOrgRoles(newSelected.size > 0);
  };

  // Check if any of the selected roles is the current user's highest permission role
  const containsUserHighestRole = (roleIds: string[]): boolean => {
    if (!currentUserHighestRole) return false;
    return roleIds.includes(currentUserHighestRole.id);
  };

  // Delete roles API call for both system and organization roles
  const deleteRoles = async (roleIds: string[], organizationId?: string) => {
    try {
      // Check if trying to delete current user's highest permission role
      if (containsUserHighestRole(roleIds)) {
        const errorMsg = `Cannot delete your highest permission role "${currentUserHighestRole?.name}". This would remove your access to manage roles.`;
        alert(errorMsg);
        throw new Error(errorMsg);
      }

      // Delete roles one by one
      const deletePromises = roleIds.map(roleId => PermissionAPI.deleteRole(roleId));
      await Promise.all(deletePromises);
      
      // Refresh the page to update the role lists
      window.location.reload();
    } catch (error) {
      console.error('❌ Failed to delete roles:', error);
      throw error;
    }
  };

  // Handle delete operation for both system and organization roles
  const deleteRolesWithConfirmation = (roleIds: string[], organizationId?: string) => {
    const roleCount = roleIds.length;
    const roleText = roleCount === 1 ? 'role' : 'roles';

    const confirmed = window.confirm(
      `Are you sure you want to delete ${roleCount} ${roleText} from ${organizationId ? 'organization ID:' + organizationId : 'your system'}?`
    );

    if (confirmed) {
      if (organizationId) {
        deleteRoles(roleIds, organizationId);
      } else {
        deleteRoles(roleIds);
      }
    }
  };

  
  // Handle edit operation for both system and organization roles
  const handleEditRoles = (mode: 'system' | 'organization') => {
    // Determine which roles are being edited based on the mode
    const rolesToEdit = mode === 'system'
      ? globalRoles.filter(role => selectedSystemRoles.has(role.id))
      : organizationRoles.filter(role => selectedOrgRoles.has(role.id));
    
    if (rolesToEdit.length === 0) {
      console.warn(`⚠️ No ${mode} roles selected for editing`);
      return;
    }

    // Check if trying to edit current user's highest permission role
    const roleIds = rolesToEdit.map(role => role.id);
    if (containsUserHighestRole(roleIds)) {
      const errorMsg = `Cannot edit your highest permission role "${currentUserHighestRole?.name}". This would affect your access to manage roles.`;
      alert(errorMsg);
      return;
    }
    
    // Set the current edit mode based on which button was clicked
    setCurrentEditMode(mode);
    setIsEditRolesModalOpen(true);
  }

  // Handle cancel role changes
  const handleCancelRoleChanges = () => {
    setIsEditRolesModalOpen(false);
    setCurrentEditMode(null);
  };

  // Get roles being edited based on current edit mode
  const rolesBeingEdited = useMemo(() => {
    if (currentEditMode === 'system') {
      return globalRoles.filter(role => selectedSystemRoles.has(role.id));
    } else if (currentEditMode === 'organization') {
      return organizationRoles.filter(role => selectedOrgRoles.has(role.id));
    }
    return [];
  }, [currentEditMode, selectedSystemRoles, selectedOrgRoles, globalRoles, organizationRoles]);

  // Initialize role edits when modal opens
  useEffect(() => {
    if (isEditRolesModalOpen && rolesBeingEdited.length > 0) {
      const initialEdits = new Map<string, { name: string; level: number | '' }>();
      rolesBeingEdited.forEach(role => {
        initialEdits.set(role.id, {
          name: role.name,
          level: role.rank
        });
      });
      setRoleEdits(initialEdits);
      setSaveErrors(new Map());
    }
  }, [isEditRolesModalOpen, rolesBeingEdited]);

  // Handle save role changes - batch save all edited roles
  const handleSaveRoleChanges = async () => {
    if (rolesBeingEdited.length === 0) {
      setIsEditRolesModalOpen(false);
      setCurrentEditMode(null);
      return;
    }

    // Validate all edits before saving
    const errors = new Map<string, string>();
    const updates: Array<{ roleId: string; data: any }> = [];

    rolesBeingEdited.forEach(role => {
      const edit = roleEdits.get(role.id);
      if (!edit) return;

      const { name, level } = edit;
      
      // Check if this role is the current user's highest permission role
      if (currentUserHighestRole?.id === role.id) {
        errors.set(role.id, `Cannot edit your highest permission role "${currentUserHighestRole?.name}". This would affect your access to manage roles.`);
        return;
      }

      // Validate name
      if (!name.trim()) {
        errors.set(role.id, 'Role name is required');
        return;
      }

      // Validate level
      if (level === '' || level === null || level === undefined) {
        errors.set(role.id, 'Level is required');
        return;
      }
      if (typeof level === 'number' && level < 0) {
        errors.set(role.id, 'Level must be a positive integer');
        return;
      }

      // Check if there are actual changes
      if (name.trim() === role.name && level === role.rank) {
        // No changes, skip this role
        return;
      }

      // Prepare update data
      const updateData: any = {
        name: name.trim(),
        level: Number(level),
      };

      // Only include organization_id if it's an organization role
      if (currentEditMode === 'organization' && filters.organizationId) {
        updateData.organization_id = parseInt(filters.organizationId, 10);
      } else if (currentEditMode === 'system') {
        // For system roles, explicitly set organization_id to null
        updateData.organization_id = null;
      }

      updates.push({ roleId: role.id, data: updateData });
    });

    // If there are validation errors, show them and don't save
    if (errors.size > 0) {
      setSaveErrors(errors);
      return;
    }

    // If no updates to make, just close the modal
    if (updates.length === 0) {
      setIsEditRolesModalOpen(false);
      setCurrentEditMode(null);
      return;
    }

    // Save all updates
    setIsSavingAll(true);
    setSaveErrors(new Map());

    try {
      // Save all roles in parallel
      const savePromises = updates.map(({ roleId, data }) =>
        PermissionAPI.updateRole(roleId, data).catch(err => {
          // Return error for this specific role
          return { roleId, error: err };
        })
      );

      const results = await Promise.all(savePromises);
      
      // Check for errors
      const saveErrorsMap = new Map<string, string>();
      results.forEach((result, index) => {
        if (result && 'error' in result) {
          const { roleId, error } = result as { roleId: string; error: any };
          const errorMessage = error?.response?.data?.error || error?.message || 'Failed to update role';
          saveErrorsMap.set(roleId, errorMessage);
        }
      });

      if (saveErrorsMap.size > 0) {
        // Some saves failed, show errors
        setSaveErrors(saveErrorsMap);
        setIsSavingAll(false);
      } else {
        // All saves succeeded, refresh and close modal
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to save role changes:', error);
      setSaveErrors(new Map([['general', 'Failed to save role changes. Please try again.']]));
      setIsSavingAll(false);
    }
  };

  // Handle role field changes
  const handleRoleNameChange = (roleId: string, name: string) => {
    const currentEdit = roleEdits.get(roleId);
    if (currentEdit) {
      setRoleEdits(new Map(roleEdits.set(roleId, { ...currentEdit, name })));
      // Clear error for this role when user starts typing
      if (saveErrors.has(roleId)) {
        const newErrors = new Map(saveErrors);
        newErrors.delete(roleId);
        setSaveErrors(newErrors);
      }
    }
  };

  const handleRoleLevelChange = (roleId: string, level: number | '') => {
    const currentEdit = roleEdits.get(roleId);
    if (currentEdit) {
      setRoleEdits(new Map(roleEdits.set(roleId, { ...currentEdit, level })));
      // Clear error for this role when user starts typing
      if (saveErrors.has(roleId)) {
        const newErrors = new Map(saveErrors);
        newErrors.delete(roleId);
        setSaveErrors(newErrors);
      }
    }
  };

  // Show error state if initial data loading failed
  if (error) {
    return (
      <ProtectedRoute
        requiredAuth={true}
        fallback="/unauthorized"
      >
        <Layout showPermissionRole={true}>
          <div className="p-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900">Error Loading Data</h3>
                  <p className="text-red-700 mt-1">{error}</p>
                  <p className="text-sm text-red-600 mt-2">
                    This might be normal if the backend server is not running. 
                    The app will fall back to mock data for demonstration.
                  </p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  // Show loading state for initial data
  if (loading || userLoading) {
    return (
      <ProtectedRoute
        requiredAuth={true}
        fallback="/unauthorized"
      >
        <Layout showPermissionRole={true}>
          <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading roles data...</p>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return(
    <ProtectedRoute
      requiredAuth={true}
      fallback="/unauthorized"
    >
      <Layout showPermissionRole={true}>
        <div className="p-8 flex flex-col gap-8">

          {/* Title of page */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Roles</h1>
                <p className="mt-2 text-gray-600">
                  Manage roles for your system and organizations.
                </p>
              </div>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                title="Refresh data"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* User roles loading error */}
          {userError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-900">Warning: User Roles</h3>
                  <p className="text-sm text-yellow-700 mt-1">{userError}</p>
                </div>
              </div>
            </div>
          )}
          

          {/* System roles management - only visible to super admin (level 1)*/}
          {hasSystemAccess() && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-row gap-10 items-center">
                <h2 className="text-xl font-bold text-gray-900">System Roles</h2>
                <button
                  onClick={() => setIsSystemRoleModalOpen(true)}
                  className="bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-400 transition-colors">
                  New System Role
                </button>
              </div>
              
              <div className="rounded-lg bg-white border border-gray-200">
                <Table className="p-6 overflow-hidden">
                  <TableHeader>
                      <TableRow>
                        <TableHead>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Exclude user's highest role from selection
                                const selectableRoleIds = globalRoles
                                  .filter(role => currentUserHighestRole?.id !== role.id)
                                  .map(role => role.id);
                                setSelectedSystemRoles(new Set(selectableRoleIds));
                                setEditingSystemRoles(selectableRoleIds.length > 0);
                              } else {
                                setSelectedSystemRoles(new Set());
                                setEditingSystemRoles(false);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Role ID</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Level</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalRoles.length === 0 ? (
                        <TableRow>
                          <TableCell 
                            colSpan={4}
                            className="text-center">
                              No system roles found
                          </TableCell>
                        </TableRow>
                      ) : (
                        globalRoles.map(role => {
                          const isUserHighestRole = currentUserHighestRole?.id === role.id;
                          return (
                            <TableRow key={role.id} className={isUserHighestRole ? 'bg-yellow-50' : ''}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={selectedSystemRoles.has(role.id)}
                                  onChange={() => handleSystemRoleSelection(role.id)}
                                  disabled={isUserHighestRole}
                                  title={isUserHighestRole ? 'Cannot select your highest permission role' : ''}
                                />
                              </TableCell>
                              <TableCell>
                                {role.id}
                                {isUserHighestRole && (
                                  <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-yellow-200 text-yellow-800 rounded">
                                    Your Role
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>{role.name}</TableCell>
                              <TableCell>{role.rank}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                </Table>
              </div>

              {/* Operations */}
              {editingSystemRoles && (
                <div className="py-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Selected System Roles ({selectedSystemRoles.size})</h3>
                  <div className="flex flex-row justify-center gap-4">
                    <button 
                      className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-yellow-600 text-white hover:bg-yellow-700"
                      onClick={() => handleEditRoles('system')}
                    >
                      Edit
                  </button>
                  <button 
                    className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-red-600 text-white hover:bg-red-700"
                    onClick={() => {
                      if (selectedSystemRoles.size > 0) {
                        const roleIds = Array.from(selectedSystemRoles);
                        deleteRolesWithConfirmation(roleIds);
                      }
                    }}
                  >
                    Remove ({selectedSystemRoles.size})
                  </button>
                </div>
              </div>
              )}

            </div>
          )}
          
          {/* Organization roles management */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-10 items-center">
              <h2 className="text-xl font-bold text-gray-900">Organization Roles</h2>
              <button
                onClick={() => setIsOrgRoleModalOpen(true)}
                className="bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-400 transition-colors">
                New Organization Role
              </button>
            </div>
            {/* Organization filter */}
            <div className="flex flex-row gap-4">
              <FilterDropdown
                label="Organization"
                options={organizationOptions}
                value={filters.organizationId}
                onChange={(value) => setFilters({ ...filters, organizationId: value })}
                placeholder="Select organization"
              />
            </div>
            {/* Organization roles */}
            <div className="rounded-lg bg-white border border-gray-200">
              {errorOrgRoles ? (
                <div className="p-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-red-900">Error Loading Organization Roles</h3>
                        <p className="text-sm text-red-700 mt-1">{errorOrgRoles}</p>
                      </div>
                      <button
                        onClick={handleRefresh}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <Table className="p-6 overflow-hidden">
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Exclude user's highest role from selection
                              const selectableRoleIds = organizationRoles
                                .filter(role => currentUserHighestRole?.id !== role.id)
                                .map(role => role.id);
                              setSelectedOrgRoles(new Set(selectableRoleIds));
                              setEditingOrgRoles(selectableRoleIds.length > 0);
                            } else {
                              setSelectedOrgRoles(new Set());
                              setEditingOrgRoles(false);
                            }
                          }}
                          disabled={loadingOrgRoles}
                        />
                      </TableHead>
                      <TableHead>Role ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingOrgRoles
                      ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <LoadingSpinner />
                            <p className="mt-2 text-sm text-gray-600">Loading organization roles...</p>
                          </TableCell>
                        </TableRow>
                      )
                      : (organizationRoles.length > 0 
                      ? (organizationRoles.map(role => {
                          const isUserHighestRole = currentUserHighestRole?.id === role.id;
                          return (
                            <TableRow key={role.id} className={isUserHighestRole ? 'bg-yellow-50' : ''}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={selectedOrgRoles.has(role.id)}
                                  onChange={() => handleOrgRoleSelection(role.id)}
                                  disabled={isUserHighestRole}
                                  title={isUserHighestRole ? 'Cannot select your highest permission role' : ''}
                                />
                              </TableCell>
                              <TableCell>
                                {role.id}
                                {isUserHighestRole && (
                                  <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-yellow-200 text-yellow-800 rounded">
                                    Your Role
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>{role.name}</TableCell>
                              <TableCell>{role.rank}</TableCell>
                            </TableRow>
                          );
                        }))
                      : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            {filters.organizationId 
                              ? 'No roles found for this organization'
                              : 'Please select an organization to view roles'
                            }
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Operations for organization roles */}
            {editingOrgRoles && (
              <div className="py-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Organization Roles ({selectedOrgRoles.size})</h3>
                <div className="flex flex-row justify-center gap-4">
                  <button 
                    className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-yellow-600 text-white hover:bg-yellow-700"
                    onClick={() => handleEditRoles('organization')}
                  >
                    Edit
                  </button>
                  <button 
                    className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-red-600 text-white hover:bg-red-700"
                    onClick={() => {
                      if (selectedOrgRoles.size > 0) {
                        const roleIds = Array.from(selectedOrgRoles);
                        deleteRolesWithConfirmation(roleIds, filters.organizationId);
                      }
                    }}
                  >
                    Remove ({selectedOrgRoles.size})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal for new system role */}
          <Modal 
            isOpen={isSystemRoleModalOpen} 
            onClose={() => setIsSystemRoleModalOpen(false)}
          >
            <div className="bg-white rounded-lg shadow-xl min-w-[600px] max-w-[800px]">
              <div className="flex flex-col gap-2 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">New System Role</h3>
                <p className="text-sm text-gray-500 mt-1">Create a global role that applies to all organizations</p>
              </div>
              <NewRoleForm
                onSuccess={handleRoleCreated}
                onCancel={() => setIsSystemRoleModalOpen(false)}
              />
            </div>
          </Modal>
          
        </div>

        {/* Modal for new organization role */}
        <Modal 
          isOpen={isOrgRoleModalOpen} 
          onClose={() => setIsOrgRoleModalOpen(false)}
        >
          <div className="bg-white rounded-lg shadow-xl min-w-[500px] max-w-[600px]">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">New Organization Role</h3>
              <p className="text-sm text-gray-500 mt-1">
                Create a role for the selected organization: {filters.organizationId ? organizationOptions.find(o => o.id === filters.organizationId)?.name : 'None'}
              </p>
            </div>
            {filters.organizationId ? (
              <NewRoleForm
                organizationId={filters.organizationId}
                onSuccess={handleRoleCreated}
                onCancel={() => setIsOrgRoleModalOpen(false)}
              />
            ) : (
              <div className="p-6">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Please select an organization first before creating a role.
                  </p>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setIsOrgRoleModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* Modal for editing roles */}
        <Modal
          isOpen={isEditRolesModalOpen} 
          onClose={handleCancelRoleChanges}
        >
          <div className="bg-white rounded-lg shadow-xl min-h-[75vh] min-w-[50vw] max-w-[90vw] max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit {currentEditMode === 'system' ? 'System' : 'Organization'} Roles
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Editing {rolesBeingEdited.length} role(s){currentEditMode === 'organization' && filters.organizationId ? ` for organization: ${organizationOptions.find(o => o.id === filters.organizationId)?.name || filters.organizationId}` : ''}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {rolesBeingEdited.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No roles selected for editing</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {rolesBeingEdited.map((role) => {
                    const edit = roleEdits.get(role.id) || { name: role.name, level: role.rank };
                    const error = saveErrors.get(role.id);
                    return (
                      <EditRoleFormItem
                        key={role.id}
                        role={role}
                        organizationId={currentEditMode === 'organization' ? filters.organizationId : undefined}
                        name={edit.name}
                        level={edit.level}
                        onNameChange={(name) => handleRoleNameChange(role.id, name)}
                        onLevelChange={(level) => handleRoleLevelChange(role.id, level)}
                        error={error}
                        isSaving={isSavingAll}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              {saveErrors.has('general') && (
                <div className="text-sm text-red-600">
                  {saveErrors.get('general')}
                </div>
              )}
              <div className="flex justify-end gap-3 ml-auto">
                <button
                  onClick={handleCancelRoleChanges}
                  disabled={isSavingAll}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRoleChanges}
                  disabled={isSavingAll}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingAll ? 'Saving...' : `Save Changes (${rolesBeingEdited.length})`}
                </button>
              </div>
            </div>
          </div>  
        </Modal>
      </Layout>
    </ProtectedRoute>
  );
};

export default RolesPage;