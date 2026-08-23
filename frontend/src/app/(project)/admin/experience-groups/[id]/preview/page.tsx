'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/lib/projectStore';
import { ExperienceGroupAPI } from '@/lib/api/experienceGroupApi';
import { ExperienceGroup } from '@/types/experienceGroup';
import type { RequestFormResponse } from '@/types/ticketForm';
import DynamicFormRenderer from '@/components/ticket-form/DynamicFormRenderer';
import PortalPageShell from '@/components/ticket-form/portal/PortalPageShell';
import PortalBrandingRow from '@/components/ticket-form/portal/PortalBrandingRow';
import PortalPreviewSkeleton from '@/components/ticket-form/portal/PortalPreviewSkeleton';
import { AlertCircle } from 'lucide-react';
import { useBuildUrl } from '@/lib/buildUrl';

const PreviewPage: React.FC = () => {
  const params = useParams();
  const buildUrl = useBuildUrl();
  const id = String(params.id);
  const projectId = useProjectStore((s) => s.activeProject)?.id ?? null;

  const [data, setData] = useState<(ExperienceGroup & { is_preview: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formSchema, setFormSchema] = useState<RequestFormResponse | null>(null);
  const [formLoading, setFormLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);

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

  const fetchRequestForm = useCallback(async () => {
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await ExperienceGroupAPI.getRequestForm(id);
      setFormSchema(res.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setFormError('Configure a default ticket form for this project.');
      } else {
        setFormError('Failed to load request form.');
      }
      setFormSchema(null);
    } finally {
      setFormLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPreview();
    fetchRequestForm();
  }, [fetchPreview, fetchRequestForm]);

  const ticketFormsHref = buildUrl('/admin/ticket-forms');

  if (loading) {
    return (
      <PortalPageShell>
        <PortalPreviewSkeleton />
      </PortalPageShell>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
        <div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{error || 'Preview unavailable.'}</p>
          <button
            onClick={fetchPreview}
            className="ml-auto rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <PortalPageShell>
      {!formSubmitted && <PortalBrandingRow name={data.name} />}

      {formLoading ? (
        <PortalPreviewSkeleton showBrandingSkeleton={false} />
      ) : formError ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{formError}</p>
            <a
              href={ticketFormsHref}
              className="mt-1 inline-block text-xs text-[#2ab5be] hover:underline"
            >
              Open Ticket Forms admin →
            </a>
          </div>
        </div>
      ) : formSchema ? (
        <DynamicFormRenderer
          experienceGroupId={id}
          schema={formSchema}
          projectId={projectId ? Number(projectId) : undefined}
          variant="portal"
          onSubmitted={() => setFormSubmitted(true)}
          onSubmitAnother={() => setFormSubmitted(false)}
        />
      ) : null}
    </PortalPageShell>
  );
};

export default PreviewPage;
