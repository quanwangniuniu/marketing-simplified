'use client';



import { useCallback, useEffect, useRef, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { useActiveProjectForFlatRoute } from '@/lib/useActiveProjectForFlatRoute';
import { useBuildUrl } from '@/lib/buildUrl';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

import DashboardLayout from '@/components/dashboard/DashboardLayout';

import LoadingSpinner from '@/components/ui/LoadingSpinner';

import TicketFormBuilder from '@/components/ticket-form/TicketFormBuilder';

import { TicketFormAPI } from '@/lib/api/ticketFormApi';

import type { TicketFormDetail } from '@/types/ticketForm';

import toast from 'react-hot-toast';



export default function TicketFormEditPage() {

  const params = useParams();

  const router = useRouter();
  const buildUrl = useBuildUrl();

  const { activeProject } = useActiveProjectForFlatRoute();

  const formId = String(params.id);

  const projectId = Number(activeProject?.id ?? 0);



  const [form, setForm] = useState<TicketFormDetail | null>(null);

  const [name, setName] = useState('');

  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(true);

  const lastSavedMetadata = useRef({ name: '', description: '' });



  const load = useCallback(async () => {

    setLoading(true);

    try {

      const res = await TicketFormAPI.retrieve(formId);

      setForm(res.data);

      setName(res.data.name);

      setDescription(res.data.description ?? '');

      lastSavedMetadata.current = {
        name: res.data.name,
        description: res.data.description ?? '',
      };

    } catch {

      toast.error('Failed to load form.');

    } finally {

      setLoading(false);

    }

  }, [formId]);



  useEffect(() => { load(); }, [load]);



  const saveMetadata = async () => {

    const trimmedName = name.trim();

    if (!trimmedName) {

      toast.error('Form name is required.');

      setName(lastSavedMetadata.current.name);

      return;

    }

    if (
      trimmedName === lastSavedMetadata.current.name
      && description === lastSavedMetadata.current.description
    ) {

      return;

    }

    try {

      await TicketFormAPI.update(formId, { name: trimmedName, description });

      lastSavedMetadata.current = { name: trimmedName, description };

      setForm((prev) => (prev ? { ...prev, name: trimmedName, description } : prev));

      toast.success('Form details saved.');

    } catch {

      toast.error('Could not save details.');

      setName(lastSavedMetadata.current.name);

      setDescription(lastSavedMetadata.current.description);

    }

  };

  const deleteForm = async () => {
    if (!window.confirm('Delete this form? This cannot be undone.')) return;

    try {
      await TicketFormAPI.delete(formId);
      toast.success('Form deleted.');
      router.push(buildUrl(`/admin/ticket-forms`));
    } catch {
      toast.error('Could not delete form.');
    }
  };

  return (

    <ProtectedRoute requiredAuth={true} fallback="/unauthorized">

      <DashboardLayout alerts={[]} upcomingMeetings={[]}>

          {loading || !form ? (

            <div className="flex items-center justify-center py-24">

              <LoadingSpinner />

            </div>

          ) : (

            <TicketFormBuilder

              formId={formId}

              projectId={projectId}

              formName={name}

              formDescription={description}

              onFormNameChange={setName}

              onFormDescriptionChange={setDescription}

              onSaveMetadata={saveMetadata}

              onDeleteForm={deleteForm}

              initialFields={form.fields}

              onSaved={load}

            />

          )}

      </DashboardLayout>

    </ProtectedRoute>

  );

}

