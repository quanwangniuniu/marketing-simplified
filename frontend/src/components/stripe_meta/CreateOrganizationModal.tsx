'use client';

import { useState } from 'react';
import { X, Building2 } from 'lucide-react';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; email_domain?: string }) => Promise<void>;
  loading?: boolean;
}

export default function CreateOrganizationModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  loading = false 
}: CreateOrganizationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    email_domain: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Organization name is required';
    }
    
    if (formData.email_domain && formData.email_domain.trim()) {
      const domain = formData.email_domain.trim();
      const normalizedDomain = domain.startsWith('@') ? domain : `@${domain}`;
      
      if (!normalizedDomain.includes('.') || normalizedDomain.length < 4) {
        newErrors.email_domain = 'Please enter a valid email domain (e.g., company.com)';
      }
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    try {
      await onSubmit({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        email_domain: formData.email_domain.trim() || undefined
      });
      
      // Reset form on success
      setFormData({ name: '', description: '', email_domain: '' });
      setErrors({});
    } catch (error) {
      console.error('Error creating organization:', error);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ name: '', description: '', email_domain: '' });
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#3CCED7] to-[#3CCED7] rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xl font-semibold text-gray-800">Create Organization</div>
              <div className="text-sm text-gray-500">Set up your organization</div>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Organization Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Organization Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter organization name"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7] transition-colors ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-gray-400">(Optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of your organization"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7] transition-colors resize-none"
              disabled={loading}
            />
          </div>

          {/* Email Domain */}
          <div>
            <label htmlFor="email_domain" className="block text-sm font-medium text-gray-700 mb-2">
              Email Domain <span className="text-gray-400">(Optional)</span>
            </label>
            <input
              type="text"
              id="email_domain"
              name="email_domain"
              value={formData.email_domain}
              onChange={handleInputChange}
              placeholder="company.com"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7] transition-colors ${
                errors.email_domain ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.email_domain && (
              <p className="mt-1 text-sm text-red-600">{errors.email_domain}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Enter the email domain for your organization (e.g., company.com)
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-[#3CCED7] to-[#3CCED7] text-white rounded-lg hover:from-[#3CCED7] hover:to-[#2AB5BD] transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating...
                </div>
              ) : (
                'Create Organization'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
