'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { CreateSheetRequest } from '@/types/spreadsheet';

interface CreateSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSheetRequest) => Promise<void>;
  loading?: boolean;
  defaultName?: string;
}

export default function CreateSheetModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  defaultName,
}: CreateSheetModalProps) {
  const [formData, setFormData] = useState<CreateSheetRequest>({
    name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setFormData({ name: '' });
      setErrors({});
      return;
    }

    // When opening, set the default name if provided
    if (defaultName) {
      setFormData({ name: defaultName });
    }
  }, [isOpen, defaultName]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Sheet name is required';
    } else if (formData.name.trim().length > 200) {
      newErrors.name = 'Sheet name cannot exceed 200 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSubmit({
        name: formData.name.trim(),
      });
      // Reset form on success
      setFormData({ name: '' });
      setErrors({});
    } catch (error) {
      console.error('Error creating sheet:', error);
      // Error handling is done in parent component
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ name: '' });
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="w-[min(500px,calc(100vw-2rem))]">
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-8 pt-8 pb-4 border-b border-gray-100">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-gray-900">Create Sheet</h2>
              <p className="text-gray-600">Give your sheet a name to get started.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Sheet Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Sheet Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter sheet name"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7] transition-colors ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={loading}
                maxLength={200}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              <p className="mt-1 text-xs text-gray-500">
                {formData.name.length}/200 characters
              </p>
            </div>

            {/* Error message display */}
            {errors.general && (
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                {errors.general}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#3CCED7] rounded-lg hover:bg-[#2AB5BD] transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Sheet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}

