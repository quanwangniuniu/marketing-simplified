'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export interface InlineSelectControllerProps<T extends string> {
  value: T | undefined;
  options: Array<{ value: T; label: string }>;
  onSave: (value: T) => Promise<void> | void;
  validate?: (value: T) => string | null;
  className?: string;
  renderTrigger?: (value: T | undefined, label: string) => React.ReactNode;
  placeholder?: string;
}

function InlineSelectController<T extends string>({
  value: initialValue,
  options,
  onSave,
  validate,
  className = '',
  renderTrigger,
  placeholder = 'Click to select',
}: InlineSelectControllerProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState<T | undefined>(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalValueRef = useRef<T | undefined>(initialValue);
  const selectRef = useRef<HTMLButtonElement>(null);
  const isSavingRef = useRef(false);
  const pendingValueRef = useRef<T | undefined>(undefined);

  // Sync value when initialValue changes externally (only when not editing)
  useEffect(() => {
    if (!isEditing && value !== initialValue) {
      setValue(initialValue);
      originalValueRef.current = initialValue;
    }
  }, [initialValue, isEditing, value]);

  // Focus select when entering edit mode
  useEffect(() => {
    if (isEditing && selectRef.current) {
      // Small delay to ensure the select is rendered
      setTimeout(() => {
        selectRef.current?.click();
      }, 0);
    }
  }, [isEditing]);

  const getLabel = useCallback(
    (val: T | undefined) => {
      if (!val) return placeholder;
      return options.find((opt) => opt.value === val)?.label || val;
    },
    [options, placeholder]
  );

  const handleSave = useCallback(async (valueToSave?: T) => {
    const valueToUse = valueToSave ?? value;
    
    // Don't save if value is undefined
    if (!valueToUse) {
      setIsEditing(false);
      return;
    }

    // Validate
    if (validate) {
      const validationError = validate(valueToUse);
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
      isSavingRef.current = true;
      setIsLoading(true);
      setError(null);
      await onSave(valueToUse);
      originalValueRef.current = valueToUse;
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsLoading(false);
      isSavingRef.current = false;
    }
  }, [value, validate, onSave]);

  const handleValueChange = useCallback(
    (newValue: string) => {
      // Ensure the value is one of the valid options
      const validValue = options.find((opt) => opt.value === newValue)?.value;
      if (validValue) {
        pendingValueRef.current = validValue;
        setValue(validValue);
        // Pass value directly to save to avoid async state issue
        setTimeout(() => {
          handleSave(validValue);
          pendingValueRef.current = undefined;
        }, 100);
      }
    },
    [handleSave, options]
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
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <Select
          value={value || ''}
          onValueChange={handleValueChange}
          onOpenChange={(open) => {
            if (!open && !isLoading && !isSavingRef.current && !pendingValueRef.current) {
              // Only cancel if dropdown closed, we're not loading, not saving, and no value change is pending
              // Check if value changed - if not, cancel; if yes, let save complete
              if (value === originalValueRef.current) {
                handleCancel();
              }
            }
          }}
          disabled={isLoading}
        >
          <SelectTrigger
            ref={selectRef}
            className="h-auto py-1 px-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
              }
            }}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  const currentLabel = getLabel(value);
  const triggerContent = renderTrigger ? renderTrigger(value, currentLabel) : (
    <span className={!value ? 'text-gray-400 italic' : ''}>
      {currentLabel}
    </span>
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

export default InlineSelectController;

