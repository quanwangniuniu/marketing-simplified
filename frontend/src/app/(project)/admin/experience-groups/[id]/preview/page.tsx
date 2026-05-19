'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ExperienceGroupAPI } from '@/lib/api/experienceGroupApi';
import { ExperienceGroup } from '@/types/experienceGroup';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { AlertCircle, Eye } from 'lucide-react';

const PreviewPage: React.FC = () => {
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<(ExperienceGroup & { is_preview: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ExperienceGroupAPI.preview(id);
      setData(res.data);
    } catch {
      setError('Failed to load preview data.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-gray-50">
        <LoadingSpinner />
        <p className="text-sm text-gray-500">Loading preview...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md w-full">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error || 'Preview unavailable.'}</p>
          <button
            onClick={fetchPreview}
            className="ml-auto px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Preview mode banner */}
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-400 text-yellow-900 text-sm font-medium">
        <Eye className="h-4 w-4" />
        Preview Mode — Not visible to customers
      </div>

      {/* Simulated customer portal */}
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">

        {/* Header */}
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900">{data.name}</h1>
          {data.description && (
            <p className="text-gray-500">{data.description}</p>
          )}
        </div>

        {/* Knowledge base placeholder */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Knowledge Base</h2>
          <div className="h-10 bg-gray-100 rounded-lg flex items-center px-4 text-sm text-gray-400">
            Search articles...
          </div>
          <p className="text-xs text-gray-400 italic">
            Articles will appear here once Spaces are configured.
          </p>
        </div>

        {/* Contact form placeholder */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Submit a Request</h2>
          <p className="text-xs text-gray-400 italic">
            A request form will appear here once a Default Form is configured.
          </p>
        </div>

        {/* Live chat placeholder */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Live Chat</h2>
          <p className="text-xs text-gray-400 italic">
            Live chat will be available once a Support Channel is assigned.
          </p>
        </div>

        {/* Config summary */}
        <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 flex flex-col gap-1.5">
          <p className="font-medium text-gray-600 mb-1">Preview Config</p>
          <p>Status: <span className="font-mono">{data.status}</span></p>
          {data.published_at && (
            <p>Last published: {new Date(data.published_at).toLocaleString()}</p>
          )}
          <p>Showing draft content: {data.draft_snapshot ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  );
};

export default PreviewPage;
