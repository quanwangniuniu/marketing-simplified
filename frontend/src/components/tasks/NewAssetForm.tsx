'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormValidation } from '@/hooks/useFormValidation';
import toast from 'react-hot-toast';

interface NewAssetFormProps {
  onAssetDataChange: (data: Record<string, any>) => void;
  assetData: {
    team?: string | number | null;
    tags?: string;
    notes?: string;
    file?: File | null;
  };
  taskData: Record<string, any>;
  validation: ReturnType<typeof useFormValidation<Record<string, any>>>;
}

export default function NewAssetForm({
  onAssetDataChange,
  assetData,
  validation,
}: NewAssetFormProps) {
  const { errors, validateField, clearFieldError, setErrors } = validation;

  const normalizedTags = useMemo(() => assetData.tags ?? '', [assetData.tags]);
  const normalizedTeam = useMemo(
    () => (assetData.team === undefined || assetData.team === null ? '' : String(assetData.team)),
    [assetData.team]
  );

  useEffect(() => {
    if (assetData.tags === undefined) {
      onAssetDataChange({ tags: '' });
    }
    if (assetData.team === undefined) {
      onAssetDataChange({ team: '' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (field: 'tags' | 'team', value: string) => {
    if (errors[field]) {
      clearFieldError(field);
    }

    onAssetDataChange({ ...assetData, [field]: value });

    const error = validateField(field, value);
    if (error && error !== '') {
      setErrors({ ...errors, [field]: error });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      onAssetDataChange({ ...assetData, file: null });
      return;
    }

    // Client-side max size guard
    const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || '2.5');
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`File too large (> ${maxMb}MB)`);
      e.target.value = '';
      onAssetDataChange({ ...assetData, file: null });
      return;
    }

    onAssetDataChange({ ...assetData, file });
  };

  return (
    <form className="w-full space-y-4">
      <div>
        <label htmlFor="asset-tags" className="block text-sm font-medium text-gray-700 mb-1">
          Asset Tags *
        </label>
        <input
          id="asset-tags"
          name="tags"
          type="text"
          value={normalizedTags}
          onChange={(e) => handleInputChange('tags', e.target.value)}
          placeholder="e.g. campaign, q4, video"
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            errors.tags ? 'border-red-500' : 'border-gray-300'
          }`}
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Separate multiple tags with commas. These tags help reviewers find relevant assets quickly.
        </p>
        {errors.tags && <p className="text-red-500 text-sm mt-1">{errors.tags}</p>}
      </div>

      <div>
        <label htmlFor="asset-team" className="block text-sm font-medium text-gray-700 mb-1">
          Team (optional)
        </label>
        <input
          id="asset-team"
          name="team"
          type="number"
          min="1"
          value={normalizedTeam}
          onChange={(e) => handleInputChange('team', e.target.value)}
          placeholder="Enter team ID if the asset belongs to a team"
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            errors.team ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        <p className="text-xs text-gray-500 mt-1">
          Leave blank if the asset is not associated with a specific team.
        </p>
        {errors.team && <p className="text-red-500 text-sm mt-1">{errors.team}</p>}
      </div>

      <div>
        <label htmlFor="asset-file" className="block text-sm font-medium text-gray-700 mb-1">
          Initial Version File (optional)
        </label>
        <input
          id="asset-file"
          name="file"
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {assetData.file && (
          <p className="text-xs text-gray-600 mt-1">
            Selected: {assetData.file.name} ({(assetData.file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          You can upload the first version file now, or upload it later after creating the asset.
          Max size: {process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || '2.5'}MB
        </p>
      </div>

      {/* Workflow Information */}
      <div className="p-3 bg-[#3CCED7]/10 border border-[#3CCED7]/30 rounded-md">
        <p className="text-xs text-[#1a9ba3]">
          <strong>Workflow:</strong> After creating the asset:
        </p>
        <ol className="text-xs text-[#1a9ba3] mt-1 ml-4 list-decimal">
          {assetData.file ? (
            <>
              <li>File will be uploaded automatically as the first version</li>
              <li>Wait for virus scan to complete</li>
              <li>Publish the version (when scan is clean)</li>
              <li>Submit for review</li>
            </>
          ) : (
            <>
              <li>Upload a version file</li>
              <li>Wait for virus scan to complete</li>
              <li>Publish the version (when scan is clean)</li>
              <li>Submit for review</li>
            </>
          )}
        </ol>
      </div>

      {/* hidden submit for accessibility */}
      <button type="submit" className="hidden">
        Submit Asset Form
      </button>
    </form>
  );
}
