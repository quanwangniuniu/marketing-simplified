import { useState, useEffect, useCallback, useRef } from 'react';
import { Permission, Role, PermissionEditLevel } from '@/types/permission';
import { PermissionAPI } from '@/lib/api/permissionApi';

interface UsePermissionEditControlOptions {
  autoLoad?: boolean;
}

interface UsePermissionEditControlReturn {
  userRoles: Role[];
  loading: boolean;
  error: string | null;
  canEditPermission: (permission: Permission) => boolean;
  canEditRole: (roleId: string) => boolean;
  getUserPermissionLevel: () => PermissionEditLevel;
  getUserPermissionSummary: () => {
    level: PermissionEditLevel;
    canEdit: boolean;
    editableModules: string[];
    editableActions: string[];
    description: string;
  };
  getEditableModules: () => string[];
  getEditableActions: () => string[];
  canPerformAction: (action: string) => boolean;
  refresh: (forceRefresh?: boolean) => Promise<void>;
  getPermissionLevelDescription: (level: PermissionEditLevel) => string;
  // New functions for highest permission role
  getCurrentUserHighestRole: () => Role | null;
  getCurrentUserHighestRank: () => number | null;
  hasSystemAccess: () => boolean;
}

/**
 * Hook for managing role-based permission control on the frontend
 * Calculates user's permission level based on their roles and provides
 * functions to check editing capabilities
 */
export const usePermissionEditControl = (
  options: UsePermissionEditControlOptions = {}
): UsePermissionEditControlReturn => {
  const { autoLoad = true } = options;
  const [userRoles, setUserRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calculate permission level based on user roles
   * - FULL: Can edit all permissions (Super Admin)
   * - LIMITED: Can edit some permissions based on role
   * - VIEW_ONLY: Can only view permissions
   * - NONE: No access (no roles or very low level)
   */
  const calculatePermissionLevel = useCallback((roles: Role[]): PermissionEditLevel => {
    if (roles.length === 0) return 'NONE';
    
    const levels = roles.map(role => role.rank || 10);
    const highestLevel = Math.min(...levels);
    
    // Updated logic for better role differentiation
    if (highestLevel <= 1) {
      return 'FULL';
    }
    if (highestLevel <= 3) {
      return 'LIMITED';
    }
    if (highestLevel <= 6) {
      return 'VIEW_ONLY';
    }
    return 'NONE';
  }, []);

  /**
   * Get editable modules for different permission levels
   */
  const getEditableModulesForLevel = useCallback((level: PermissionEditLevel, roles: Role[] = []): string[] => {
    switch (level) {
      case 'FULL':
        return ['Asset Management', 'Campaign Execution', 'Budget Approval', 'Reporting'];
      case 'LIMITED':
        // Different LIMITED permissions based on role
        const roleNames = roles.map(r => r.name);
        
        // Check for both organization-specific and global roles
        if (roleNames.some(name => name.includes('Admin'))) {
          return ['Asset Management', 'Campaign Execution', 'Budget Approval', 'Reporting']; // Admin can edit all modules
        }
        if (roleNames.some(name => name.includes('Manager'))) {
          return ['Asset Management', 'Campaign Execution', 'Reporting']; // Manager can edit Asset, Campaign and Reporting
        }
        return ['Asset Management']; // Default LIMITED access to Asset only
      case 'VIEW_ONLY':
        return []; // Can view but not edit
      default:
        return [];
    }
  }, []);

  /**
   * Get editable actions for different permission levels
   */
  const getEditableActionsForLevel = useCallback((level: PermissionEditLevel, roles: Role[] = []): string[] => {
    switch (level) {
      case 'FULL':
        return ['View', 'Edit', 'Approve', 'Delete', 'Export'];
      case 'LIMITED':
        // Different LIMITED actions based on role
        const roleNames = roles.map(r => r.name);
        
        // Check for both organization-specific and global roles
        if (roleNames.some(name => name.includes('Admin'))) {
          return ['View', 'Edit', 'Approve', 'Delete']; // Admin can do most actions
        }
        if (roleNames.some(name => name.includes('Manager'))) {
          return ['View', 'Edit', 'Approve']; // Manager can view, edit, and approve
        }
        return ['View', 'Edit']; // Default LIMITED access
      case 'VIEW_ONLY':
        return ['View']; // Editor can only view
      default:
        return []; // No access for Viewer
    }
  }, []);

  /**
   * Load current user's roles from API
   */
    // Add a ref to prevent duplicate API calls
  const loadingRef = useRef(false);

  const loadUserRoles = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate calls
    if (loadingRef.current && !forceRefresh) {
      console.log('🚫 Skipping duplicate API call - already loading');
      return;
    }
    
    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      // Get current user from auth store, fall back to localStorage if not yet hydrated.
      const { useAuthStore } = await import('@/lib/authStore');
      const { readPersistedAuthState } = await import('@/lib/api');
      const authStore = useAuthStore.getState();
      const currentUser = authStore.user ?? readPersistedAuthState()?.state?.user ?? null;

      if (!currentUser) {
        console.log('User not authenticated, setting empty roles');
        setUserRoles([]);
        return;
      }

      console.log('🔄 Loading roles for user:', currentUser.email, forceRefresh ? '(force refresh)' : '');

      const userRoles = await PermissionAPI.getCurrentUserRoles();

      console.log('📋 User roles found:', userRoles);

      const permissionLevel = calculatePermissionLevel(userRoles);

      console.log('🎯 Calculated permission level:', permissionLevel);

      // Add permission level and editable modules/actions to roles
      const rolesWithPermissionLevel = userRoles.map(role => ({
        ...role,
        permissionEditLevel: permissionLevel,
        canEdit: permissionLevel === 'FULL' || permissionLevel === 'LIMITED',
        editableModules: getEditableModulesForLevel(permissionLevel, userRoles),
        editableActions: getEditableActionsForLevel(permissionLevel, userRoles)
      }));

      setUserRoles(rolesWithPermissionLevel);

      console.log('✅ User roles loaded and processed:', rolesWithPermissionLevel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user roles');
      console.error('❌ Error loading user roles:', err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []); // Removed dependencies to reduce re-renders

  // Use a ref to track if initial load has happened
  const initialLoadRef = useRef(false);
  
  useEffect(() => {
    // Prevent multiple initial loads in development mode
    if (autoLoad && !initialLoadRef.current) {
      initialLoadRef.current = true;
      loadUserRoles();
    }
  }, [autoLoad, loadUserRoles]);

  /**
   * Check if user can edit a specific permission
   */
  const canEditPermission = useCallback((permission: Permission): boolean => {
    if (userRoles.length === 0) return false;
    
    const permissionLevel = calculatePermissionLevel(userRoles);
    
    
    console.log('🔒 Checking permission for:', permission.module, permission.action);
    console.log('🎯 User permission level:', permissionLevel);
    console.log('👥 User roles:', userRoles);
    
    switch (permissionLevel) {
      case 'FULL':
        console.log('✅ FULL access - can edit all permissions');
        return true;
      case 'LIMITED':
        
        // Use the first role as they all have the same calculated permission level
        const userRole = userRoles[0];

        if (!userRole) {
          console.log('❌ No user role found');
          return false;
        }

        // For rank <=2 Organization Admin, can edit all permissions
        const rank = userRole.rank;
        if (rank <= 2) {
          return true;
        }
        
        // For LIMITED access and rank <= 2, check specific module and action permissions
        const canEditModule = (userRole.editableModules || []).includes(permission.module);
        const canEditAction = (userRole.editableActions || []).includes(permission.action);
        
        console.log('📋 Editable modules:', userRole.editableModules);
        console.log('⚡ Editable actions:', userRole.editableActions);
        console.log('🔍 Can edit module?', canEditModule);
        console.log('🔍 Can edit action?', canEditAction);
        
        const canEdit = canEditModule && canEditAction;
        console.log('🎯 Final decision:', canEdit ? 'CAN EDIT' : 'CANNOT EDIT');
        
        return canEdit;
      case 'VIEW_ONLY':
        console.log('👀 VIEW_ONLY access - cannot edit');
        return false;
      case 'NONE':
        console.log('🚫 NONE access - cannot edit');
        return false;
      default:
        console.log('❌ Unknown permission level');
        return false;
    }
  }, [userRoles, calculatePermissionLevel]);

  /**
   * Check if user can edit a specific role
   */
  const canEditRole = useCallback((roleId: string): boolean => {
    if (userRoles.length === 0) return false;
    
    const permissionLevel = calculatePermissionLevel(userRoles);
    return permissionLevel === 'FULL' || permissionLevel === 'LIMITED';
  }, [userRoles, calculatePermissionLevel]);

  /**
   * Get user's highest permission level
   */
  const getUserPermissionLevel = useCallback((): PermissionEditLevel => {
    return calculatePermissionLevel(userRoles);
  }, [userRoles, calculatePermissionLevel]);

  /**
   * Get editable modules for current user
   */
  const getEditableModules = useCallback((): string[] => {
    const permissionLevel = getUserPermissionLevel();
    return getEditableModulesForLevel(permissionLevel, userRoles);
  }, [getUserPermissionLevel, getEditableModulesForLevel, userRoles]);

  /**
   * Get editable actions for current user
   */
  const getEditableActions = useCallback((): string[] => {
    const permissionLevel = getUserPermissionLevel();
    return getEditableActionsForLevel(permissionLevel, userRoles);
  }, [getUserPermissionLevel, getEditableActionsForLevel, userRoles]);

  /**
   * Check if user can perform a specific action
   */
  const canPerformAction = useCallback((action: string) => {
    const permissionLevel = getUserPermissionLevel();
    
    const actionPermissions: Record<string, PermissionEditLevel[]> = {
      save: ['FULL', 'LIMITED'],
      copy: ['FULL', 'LIMITED'],
      export: ['FULL', 'LIMITED', 'VIEW_ONLY'],
      audit: ['FULL'],
      delete: ['FULL']
    };
    
    return actionPermissions[action]?.includes(permissionLevel) || false;
  }, [getUserPermissionLevel]);

  /**
   * Get permission level description
   */
  const getPermissionLevelDescription = useCallback((level: PermissionEditLevel): string => {
    switch (level) {
      case 'FULL':
        return 'Full Access - Can edit all permissions';
      case 'LIMITED':
        return 'Limited Access - Can edit specific modules/actions';
      case 'VIEW_ONLY':
        return 'View Only - Can view but not edit permissions';
      case 'NONE':
        return 'No Access - Cannot access permission management';
      default:
        return 'Unknown access level';
    }
  }, []);

  /**
   * Get user's permission summary
   */
  const getUserPermissionSummary = useCallback(() => {
    const permissionLevel = getUserPermissionLevel();
    const editableModules = getEditableModules();
    const editableActions = getEditableActions();
    
    return {
      level: permissionLevel,
      canEdit: permissionLevel === 'FULL' || permissionLevel === 'LIMITED',
      editableModules,
      editableActions,
      description: getPermissionLevelDescription(permissionLevel)
    };
  }, [getUserPermissionLevel, getEditableModules, getEditableActions, getPermissionLevelDescription]);

  /**
   * Get current user's highest permission role (lowest rank = highest permission)
   */
  const getCurrentUserHighestRole = useCallback((): Role | null => {
    if (userRoles.length === 0) return null;
    // Find the role with the lowest rank (highest permission)
    const sortedRoles = [...userRoles].sort((a, b) => (a.rank || 999) - (b.rank || 999));
    return sortedRoles[0];
  }, [userRoles]);

  /**
   * Get current user's highest permission rank (lowest rank value = highest permission)
   */
  const getCurrentUserHighestRank = useCallback((): number | null => {
    if (userRoles.length === 0) return null;
    const ranks = userRoles.map(role => role.rank || 999);
    return Math.min(...ranks);
  }, [userRoles]);

  /**
   * Check if user has system-level access (rank = 1)
   * System roles are only accessible to users with rank 1 (highest privilege)
   */
  const hasSystemAccess = useCallback((): boolean => {
    if (userRoles.length === 0) return false;
    // Get the lowest rank (highest privilege level)
    const minRank = Math.min(...userRoles.map(role => role.rank || 999));
    return minRank === 1;
  }, [userRoles]);

  return {
    userRoles,
    loading,
    error,
    canEditPermission,
    canEditRole,
    getUserPermissionLevel,
    getUserPermissionSummary,
    getEditableModules,
    getEditableActions,
    canPerformAction,
    refresh: useCallback((forceRefresh = true) => {
      console.log('🔄 Manual refresh triggered');
      initialLoadRef.current = false; // Reset initial load flag
      return loadUserRoles(forceRefresh);
    }, [loadUserRoles]),
    getPermissionLevelDescription,
    getCurrentUserHighestRole,
    getCurrentUserHighestRank,
    hasSystemAccess
  };
}; 