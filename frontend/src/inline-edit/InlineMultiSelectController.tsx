'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { X, Loader2, ChevronDown } from 'lucide-react';

export interface InlineMultiSelectControllerProps<T extends string> {
  value: T[];
  options: Array<{ value: T; label: string }>;
  onSave: (value: T[]) => Promise<void> | void;
  validate?: (value: T[]) => string | null;
  className?: string;
  renderTrigger?: (value: T[], labels: string[]) => React.ReactNode;
  placeholder?: string;
}

function InlineMultiSelectController<T extends string>({
  value: initialValue,
  options,
  onSave,
  validate,
  className = '',
  renderTrigger,
  placeholder = 'Click to select',
}: InlineMultiSelectControllerProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedValues, setSelectedValues] = useState<T[]>(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalValuesRef = useRef<T[]>(initialValue);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync value when initialValue changes externally (only when not editing)
  useEffect(() => {
    if (!isEditing && JSON.stringify(selectedValues) !== JSON.stringify(initialValue)) {
      setSelectedValues(initialValue);
      originalValuesRef.current = initialValue;
    }
  }, [initialValue, isEditing, selectedValues]);

  const handleSave = useCallback(async () => {
    // Validate
    if (validate) {
      const validationError = validate(selectedValues);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // If value hasn't changed, just exit edit mode
    if (JSON.stringify(selectedValues.sort()) === JSON.stringify(originalValuesRef.current.sort())) {
      setIsEditing(false);
      return;
    }

    // Save
    try {
      setIsLoading(true);
      setError(null);
      await onSave(selectedValues);
      originalValuesRef.current = selectedValues;
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsLoading(false);
    }
  }, [selectedValues, validate, onSave]);

  // Close on outside click
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleSave();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, handleSave]);

  const getLabels = useCallback(
    (vals: T[]) => {
      return vals.map((val) => options.find((opt) => opt.value === val)?.label || val);
    },
    [options]
  );

  const toggleOption = useCallback((optionValue: T) => {
    setSelectedValues((prev) => {
      if (prev.includes(optionValue)) {
        return prev.filter((v) => v !== optionValue);
      } else {
        return [...prev, optionValue];
      }
    });
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedValues(originalValuesRef.current);
    setIsEditing(false);
    setError(null);
  }, []);

  const startEdit = useCallback(() => {
    originalValuesRef.current = [...selectedValues];
    setIsEditing(true);
    setError(null);
  }, [selectedValues]);

  if (isEditing) {
    const currentLabels = getLabels(selectedValues);
    return (
      <div ref={containerRef} className={`relative inline-block ${className}`}>
        <div className="border border-blue-500 rounded-md p-2 bg-white shadow-lg min-w-[200px] z-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Select platforms</span>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>
          
          {/* Selected badges */}
          {selectedValues.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-gray-200">
              {selectedValues.map((val) => {
                const label = options.find((opt) => opt.value === val)?.label || val;
                return (
                  <Badge
                    key={val}
                    variant="outline"
                    className="text-xs flex items-center gap-1 pr-1"
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => toggleOption(val)}
                      className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Options */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    {option.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>

          {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
        </div>
      </div>
    );
  }

  const currentLabels = getLabels(selectedValues);
  const triggerContent = renderTrigger
    ? renderTrigger(selectedValues, currentLabels)
    : selectedValues.length > 0
    ? (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((val) => {
            const label = options.find((opt) => opt.value === val)?.label || val;
            return (
              <Badge key={val} variant="outline" className="text-xs">
                {label}
              </Badge>
            );
          })}
        </div>
      )
    : (
        <span className="text-gray-400 italic">{placeholder}</span>
      );

  return (
    <div
      onClick={startEdit}
      className={`cursor-pointer hover:text-[#0E8A96] transition-colors inline-flex items-center gap-1 ${className}`}
      title="Click to edit"
    >
      {triggerContent}
      <ChevronDown className="h-3 w-3 text-gray-400" />
    </div>
  );
}

export default InlineMultiSelectController;

