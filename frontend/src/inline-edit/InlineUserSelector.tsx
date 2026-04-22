'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import UserPicker, { User } from '@/people/UserPicker';
import UserAvatar from '@/people/UserAvatar';
import { Loader2 } from 'lucide-react';

export interface InlineUserSelectorProps {
  value: number | undefined;
  users: User[];
  onSave: (value: number | null) => Promise<void> | void;
  validate?: (value: number | null) => string | null;
  className?: string;
  renderTrigger?: (value: number | undefined, user: User | null) => React.ReactNode;
  placeholder?: string;
  loading?: boolean;
  currentUser?: { id?: number; username?: string; email?: string };
}

function InlineUserSelector({
  value: initialValue,
  users,
  onSave,
  validate,
  className = '',
  renderTrigger,
  placeholder = 'Click to select',
  loading: externalLoading = false,
  currentUser,
}: InlineUserSelectorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState<number | undefined>(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalValueRef = useRef<number | undefined>(initialValue);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync value when initialValue changes externally (only when not editing)
  useEffect(() => {
    if (!isEditing && value !== initialValue) {
      setValue(initialValue);
      originalValueRef.current = initialValue;
    }
  }, [initialValue, isEditing, value]);

  // Handle click outside to cancel
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing]);

  const getSelectedUser = useCallback((): User | null => {
    if (!value) return null;
    return users.find((u) => Number(u.id) === Number(value)) || null;
  }, [users, value]);

  const handleSave = useCallback(async (valueToSave?: number | null) => {
    const valueToUse = valueToSave ?? value;
    
    // Validate
    if (validate) {
      const validationError = validate(valueToUse ?? null);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // If value hasn't changed, just exit edit mode
    if (valueToUse === originalValueRef.current) {
      setIsEditing(false);
      return;
    }

    // Save
    try {
      setIsLoading(true);
      setError(null);
      await onSave(valueToUse ?? null);
      originalValueRef.current = valueToUse;
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsLoading(false);
    }
  }, [value, validate, onSave]);

  const handleValueChange = useCallback(
    (newValue: string | number | null) => {
      const numericValue = newValue === null ? null : Number(newValue);
      setValue(numericValue ?? undefined);
      // Auto-save on selection
      setTimeout(() => {
        handleSave(numericValue ?? undefined);
      }, 100);
    },
    [handleSave]
  );

  const handleCancel = useCallback(() => {
    setValue(originalValueRef.current);
    setIsEditing(false);
    setError(null);
  }, []);

  const startEdit = useCallback(() => {
    originalValueRef.current = value;
    setIsEditing(true);
    setError(null);
  }, [value]);

  if (isEditing) {
    return (
      <div ref={containerRef} className={`inline-flex items-center gap-2 ${className}`}>
        <div className="w-48">
          <UserPicker
            users={users}
            value={value ?? null}
            onChange={handleValueChange}
            placeholder={placeholder}
            disabled={isLoading || externalLoading}
            loading={externalLoading}
            allowClear={false}
            className="w-full"
          />
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  const selectedUser = getSelectedUser();
  const displayUser = selectedUser || (currentUser ? {
    id: currentUser.id ?? 0,
    name: currentUser.username || currentUser.email || 'Unknown',
    email: currentUser.email || '',
  } : null);

  const triggerContent = renderTrigger ? renderTrigger(value, selectedUser) : (
    <div className="flex items-center gap-2">
      {displayUser ? (
        <>
          <UserAvatar user={displayUser} size="sm" />
          <span className="text-sm text-gray-900">{displayUser.name}</span>
        </>
      ) : (
        <span className="text-sm text-gray-400 italic">{placeholder}</span>
      )}
    </div>
  );

  return (
    <span
      onClick={startEdit}
      className={`cursor-pointer hover:text-[#0E8A96] transition-colors ${className}`}
      title="Click to edit"
    >
      {triggerContent}
    </span>
  );
}

export default InlineUserSelector;

