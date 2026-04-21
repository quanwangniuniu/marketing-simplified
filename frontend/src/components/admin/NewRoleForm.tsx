'use client';

import React, { useState } from 'react';
import { PermissionAPI } from '@/lib/api/permissionApi';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface NewRoleFormProps {
  organizationId?: string;
  onSuccess?: () => void;
  onCancel: () => void;
}

interface FormErrors {
  name?: string;
  level?: string;
  general?: string;
}

const NewRoleForm: React.FC<NewRoleFormProps> = ({
  organizationId,
  onSuccess,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Role name is required';
    }

    if (level === '' || level === null || level === undefined) {
      newErrors.level = 'Level is required';
    } else if (typeof level === 'number' && level < 0) {
      newErrors.level = 'Level must be a positive integer';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const roleData: any = {
        name: name.trim(),
        level: Number(level),
      };

      // Only include organization_id if it's provided (for organization roles)
      if (organizationId) {
        roleData.organization_id = parseInt(organizationId, 10);
      }

      await PermissionAPI.createRole(roleData);

      // Reset form
      setName('');
      setLevel('');
      setErrors({});

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Failed to create role:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to create role';
      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
      {/* Organization Info (if provided) */}
      {organizationId && (
        <div className="p-3 bg-[#3CCED7]/10 border border-[#3CCED7]/30 rounded-lg">
          <p className="text-sm text-[#1a9ba3]">
            <span className="font-semibold">Organization ID:</span> {organizationId}
          </p>
          <p className="text-xs text-[#3CCED7] mt-1">
            This role will be associated with the selected organization.
          </p>
        </div>
      )}

      {/* General Error */}
      {errors.general && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{errors.general}</p>
        </div>
      )}

      {/* Role Name Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="role-name" className="text-sm font-medium text-gray-700">
          Role Name <span className="text-red-500">*</span>
        </label>
        <input
          id="role-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors({ ...errors, name: undefined });
          }}
          placeholder="e.g., Team Leader, Media Buyer"
          className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
            errors.name ? 'border-red-300' : 'border-gray-300'
          }`}
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Level Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="role-level" className="text-sm font-medium text-gray-700">
          Level <span className="text-red-500">*</span>
        </label>
        <input
          id="role-level"
          type="number"
          min="1"
          value={level}
          onChange={(e) => {
            const value = e.target.value === '' ? '' : parseInt(e.target.value, 10);
            setLevel(value);
            if (errors.level) setErrors({ ...errors, level: undefined });
          }}
          placeholder="e.g., 1 (lower = higher privilege)"
          className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
            errors.level ? 'border-red-300' : 'border-gray-300'
          }`}
          disabled={isSubmitting}
        />
        {errors.level && (
          <p className="text-sm text-red-600">{errors.level}</p>
        )}
        <p className="text-xs text-gray-500">
          Lower number = higher privilege (e.g., 1 = Super Admin, 10 = Regular User)
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-row justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isSubmitting && <LoadingSpinner size="sm" />}
          <span>{isSubmitting ? 'Creating...' : 'Create Role'}</span>
        </button>
      </div>
    </form>
  );
};

export default NewRoleForm;

