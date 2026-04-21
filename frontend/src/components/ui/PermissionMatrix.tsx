// src/components/ui/PermissionMatrix.tsx
import React, { useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Info, Eye, Edit, Check, FileText, Trash2, Lock } from 'lucide-react';
import { Permission, Role, PermissionMatrix as PermissionMatrixType, PermissionEditLevel } from '@/types/permission';

interface PermissionMatrixProps {
  roles: Role[];
  permissions: Permission[];
  permissionMatrix: PermissionMatrixType;
  selectedRoleId: string;
  onPermissionChange: (roleId: string, permissionId: string, granted: boolean) => void;
  isLoading?: boolean;
  className?: string;
  showDescription?: boolean;
  compactMode?: boolean;
  highlightChanges?: boolean;
  // New props for role-based control
  userPermissionLevel?: PermissionEditLevel;
  canEditPermission?: (permission: Permission) => boolean;
}

// Action type icon mapping
const ActionIcons = {
  View: Eye,
  Edit: Edit,
  Approve: Check,
  Export: FileText,
  Delete: Trash2,
} as const;

// Hardcoded permission modules - must match backend Permission.MODULE_CHOICES
// These are the fixed, predefined modules in the system
const PERMISSION_MODULES = [
  'ASSET',
  'CAMPAIGN',
  'BUDGET_REQUEST',
  'BUDGET_POOL',
  'BUDGET_ESCALATION',
] as const;

// Permission checkbox component
interface PermissionCheckboxProps {
  permission: Permission;
  isGranted: boolean;
  isDisabled: boolean;
  isChanged?: boolean;
  onChange: (granted: boolean) => void;
  canEdit?: boolean;
}

const PermissionCheckbox: React.FC<PermissionCheckboxProps> = ({
  permission,
  isGranted,
  isDisabled,
  isChanged = false,
  onChange, 
  canEdit = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isDisabled && canEdit) {
      onChange(event.target.checked);
    }
  }, [isDisabled, canEdit, onChange]);

  const isActuallyDisabled = isDisabled || !canEdit;

  return (
    <div className="relative flex justify-center items-center">
      <label 
        className={`
          relative inline-flex items-center cursor-pointer group
          ${isActuallyDisabled ? 'cursor-not-allowed' : ''}
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <input
          type="checkbox"
          checked={isGranted}
          onChange={handleChange}
          disabled={isActuallyDisabled}
          className="sr-only peer"
          aria-label={`${permission.action} permission for ${permission.module}`}
        />
        
        {/* Custom checkbox */}
        <div className={`
          relative w-5 h-5 rounded border-2 transition-all duration-200
          ${isGranted 
            ? 'bg-[#3CCED7] border-[#3CCED7]' 
            : 'bg-white border-gray-300'
          }
          ${isActuallyDisabled
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:border-[#3CCED7] cursor-pointer group-hover:shadow-sm'
          }
          ${isChanged ? 'ring-2 ring-yellow-300 ring-offset-1' : ''}
          peer-focus:ring-2 peer-focus:ring-[#3CCED7] peer-focus:ring-offset-2
        `}>
          {/* Checkmark for selected state */}
          {isGranted && (
            <svg
              className="w-3 h-3 text-white absolute top-0.5 left-0.5 transition-opacity duration-200"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Permission level indicator */}
        {!canEdit && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-gray-400 rounded-full flex items-center justify-center">
            <Lock className="w-2 h-2 text-white" />
          </div>
        )}

        {/* Tooltip */}
        {isHovered && (
          <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap shadow-lg max-w-xs">
            <div className="font-medium">{permission.name}</div>
            <div className="text-gray-300 mt-1">{permission.description}</div>
            {!canEdit && (
              <div className="text-yellow-300 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                You don't have permission to edit this
              </div>
            )}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </label>
    </div>
  );
};

// Module row component
interface ModuleRowProps {
  module: string;
  modulePermissions: Permission[];
  actions: string[];
  selectedRole: Role | undefined;
  permissionMatrix: PermissionMatrixType;
  selectedRoleId: string;
  onPermissionChange: (roleId: string, permissionId: string, granted: boolean) => void;
  showDescription?: boolean;
  compactMode?: boolean;
  highlightChanges?: boolean;
  canEditPermission?: (permission: Permission) => boolean;
}

const ModuleRow: React.FC<ModuleRowProps> = ({
  module,
  modulePermissions,
  actions,
  selectedRole,
  permissionMatrix,
  selectedRoleId,
  onPermissionChange,
  showDescription = false,
  compactMode = false,
  highlightChanges = false,
  canEditPermission,
}) => {
  const isPermissionGranted = useCallback((permissionId: string): boolean => {
    return permissionMatrix[selectedRoleId]?.[permissionId] || false;
  }, [permissionMatrix, selectedRoleId]);

  const handlePermissionChange = useCallback((permissionId: string, granted: boolean) => {
    if (selectedRole?.isReadOnly) {
      return;
    }
    onPermissionChange(selectedRoleId, permissionId, granted);
  }, [selectedRole?.isReadOnly, onPermissionChange, selectedRoleId]);
    
  return (
    <div className={`
      grid grid-cols-6 gap-4 px-6 transition-colors duration-150
      ${compactMode ? 'py-2' : 'py-4'}
      hover:bg-gray-50 border-b border-gray-100 last:border-b-0
    `}>
      {/* Module name */}
      <div className="font-medium text-gray-900 flex items-center gap-2">
        <span>{module}</span>
        {showDescription && (
          <Info className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {/* Permission checkboxes */}
      {actions.map(action => {
        const permission = modulePermissions.find(p => p.action === action);
        const isGranted = permission ? isPermissionGranted(permission.id) : false;
        const isDisabled = selectedRole?.isReadOnly || !permission;
        const canEdit = permission ? (canEditPermission ? canEditPermission(permission) : true) : false;
        const ActionIcon = ActionIcons[action as keyof typeof ActionIcons];

        return (
          <div key={action} className="flex justify-center items-center">
            {permission ? (
              <PermissionCheckbox
                permission={permission}
                isGranted={isGranted}
                isDisabled={isDisabled}
                isChanged={highlightChanges}
                onChange={(granted) => handlePermissionChange(permission.id, granted)}
                canEdit={canEdit}
              />
            ) : (
              <div className="w-5 h-5 border-2 border-gray-200 rounded bg-gray-100 flex items-center justify-center">
                <span className="text-gray-400 text-xs">—</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Main permission matrix component
const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  roles,
  permissions,
  permissionMatrix,
  selectedRoleId,
  onPermissionChange,
  isLoading = false,
  className = '',
  showDescription = false,
  compactMode = false,
  highlightChanges = false,
  userPermissionLevel,
  canEditPermission,
}) => {

  // Use hardcoded module list to ensure all predefined modules are included,
  // even if they don't have permissions in the database yet
  const permissionsByModule = useMemo(() => {
    const grouped: { [module: string]: Permission[] } = {};
    // Populate with actual permissions from API
    permissions.forEach(permission => {
      // Use the module name as-is (already mapped by backend API)
      const moduleName = permission.module;
      // Add to predefined module if it exists, otherwise create new entry (for backwards compatibility)
      if (!grouped[moduleName]) {
        grouped[moduleName] = [];
      }
      grouped[moduleName].push(permission);
    });
    return grouped;
  }, [permissions]);

  // All action types - hardcoded, no need to fetch from API
  // Make sure to be consistent with the backend permission models
  const actions = ['View', 'Edit', 'Approve', 'Delete', 'Export'];

  // Get selected role
  const selectedRole = useMemo(() => {
    return roles.find(role => role.id === selectedRoleId);
  }, [roles, selectedRoleId]);

  // Statistics
  const permissionStats = useMemo(() => {
    if (!selectedRoleId) return { total: 0, granted: 0, percentage: 0 };
    
    const rolePermissions = permissionMatrix[selectedRoleId] || {};
    const total = permissions.length;
    const granted = Object.values(rolePermissions).filter(Boolean).length;
    const percentage = total > 0 ? Math.round((granted / total) * 100) : 0;
    
    return { total, granted, percentage };
  }, [selectedRoleId, permissionMatrix, permissions]);

  // Get permission level color and description
  const getPermissionLevelInfo = useCallback((level: PermissionEditLevel) => {
    switch (level) {
      case 'FULL':
        return {
          color: 'bg-green-100 text-green-800',
          description: 'Full Access - Can edit all permissions'
        };
      case 'LIMITED':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          description: 'Limited Access - Can edit specific modules/actions'
        };
      case 'VIEW_ONLY':
        return {
          color: 'bg-[#3CCED7]/15 text-[#1a9ba3]',
          description: 'View Only - Can only view permissions'
        };
      case 'NONE':
        return {
          color: 'bg-gray-100 text-gray-800',
          description: 'No Access - Cannot access permission management'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800',
          description: 'Unknown permission level'
        };
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="space-y-4">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No role selected state
  if (!selectedRoleId) {
    return (
      <div className={`text-center py-12 text-gray-500 ${className}`}>
        <Info className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium">Please select a role to view permissions</p>
        <p className="text-sm mt-2">Choose a role from the dropdown above to manage its permissions</p>
      </div>
    );
  }

  const permissionLevelInfo = userPermissionLevel ? getPermissionLevelInfo(userPermissionLevel) : null;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Permission level indicator */}
      {userPermissionLevel && permissionLevelInfo && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Your Permission Level:
              </span>
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${permissionLevelInfo.color}`}>
                {userPermissionLevel}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{permissionLevelInfo.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Permission statistics header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedRole?.name} Permissions
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{permissionStats.granted} of {permissionStats.total} granted</span>
              <span className="text-gray-400">•</span>
              <span className={`font-medium ${
                permissionStats.percentage > 75 ? 'text-green-600' :
                permissionStats.percentage > 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {permissionStats.percentage}%
              </span>
            </div>
          </div>
          
          {selectedRole?.description && (
            <div className="text-sm text-gray-500">
              {selectedRole.description}
            </div>
          )}
        </div>
      </div>

      {/* Table header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-6 gap-4 px-6 py-4">
          <div className="font-semibold text-gray-900 flex items-center gap-2">
            <span>Module</span>
            {showDescription && (
              <Info className="h-4 w-4 text-gray-400" />
            )}
          </div>
          {actions.map(action => {
            const ActionIcon = ActionIcons[action as keyof typeof ActionIcons];
            return (
              <div key={action} className="font-semibold text-gray-900 text-center flex items-center justify-center gap-2">
                {ActionIcon && <ActionIcon className="h-4 w-4" />}
                <span>{action}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Permission matrix content */}
      <div className="divide-y divide-gray-200">
        {Object.keys(permissionsByModule).map(module => {
          const modulePermissions = permissionsByModule[module] || [];
          const moduleName = module.replace('_', ' ');
          return (
            <ModuleRow
              key={module}
              module={moduleName}
              modulePermissions={modulePermissions}
              actions={actions}
              selectedRole={selectedRole}
              permissionMatrix={permissionMatrix}
              selectedRoleId={selectedRoleId}
              onPermissionChange={onPermissionChange}
              showDescription={showDescription}
              compactMode={compactMode}
              highlightChanges={highlightChanges}
              canEditPermission={canEditPermission}
            />
          );
        })}
      </div>

      {/* Read-only role warning */}
      {selectedRole?.isReadOnly && (
        <div className="bg-yellow-50 border-t border-yellow-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Read-only Role
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                This role is marked as read-only and cannot be modified. Changes to permissions are not allowed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Permission level warning */}
      {userPermissionLevel === 'VIEW_ONLY' && (
        <div className="bg-[#3CCED7]/10 border-t border-[#3CCED7]/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-[#3CCED7]" />
            <div>
              <p className="text-sm font-medium text-[#1a9ba3]">
                View Only Mode
              </p>
              <p className="text-sm text-[#1a9ba3] mt-1">
                You are in view-only mode. You can see permissions but cannot make changes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {permissions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">No permissions available</p>
          <p className="text-sm mt-2">There are no permissions configured for this system</p>
        </div>
      )}
    </div>
  );
};

export default PermissionMatrix;