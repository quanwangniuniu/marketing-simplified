'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import { ProjectAPI, type ProjectData } from '@/lib/api/projectApi';

interface QuickCreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (project: ProjectData) => void | Promise<void>;
}

const projectTypeOptions: { value: string; label: string }[] = [
  { value: 'paid_social', label: 'Paid Social' },
  { value: 'paid_search', label: 'Paid Search' },
  { value: 'programmatic', label: 'Programmatic' },
  { value: 'influencer_ugc', label: 'Influencer / UGC' },
  { value: 'cross_channel', label: 'Cross-Channel' },
  { value: 'performance', label: 'Performance' },
  { value: 'brand_campaigns', label: 'Brand Campaigns' },
  { value: 'app_acquisition', label: 'App Acquisition' },
];

const getErrorMessage = (err: any): string =>
  // `any` retained because axios errors expose err.response.data.{error,detail,message,name}
  // which is not surfaced through unknown without narrowing
  err?.response?.data?.error ||
  err?.response?.data?.detail ||
  err?.response?.data?.name?.[0] ||
  err?.response?.data?.message ||
  err?.message ||
  'Failed to create project';

export default function QuickCreateProjectModal({ open, onClose, onCreated }: QuickCreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setSelectedTypes([]);
    setBudget('');
    setError(null);
    setSubmitting(false);
    const frame = requestAnimationFrame(() => nameInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const toggleType = (value: string) => {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Project name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Partial<ProjectData> = {
        name: trimmed,
        description: description.trim() || null,
        project_type: selectedTypes,
      };
      const numericBudget = budget.trim() ? Number(budget) : null;
      if (numericBudget != null && Number.isFinite(numericBudget) && numericBudget > 0) {
        payload.total_monthly_budget = numericBudget.toFixed(2);
      }
      const project = await ProjectAPI.createProject(payload);
      toast.success('Project created');
      if (onCreated) await onCreated(project);
      onClose();
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} disableBackdropClose>
      <div className="w-[min(560px,calc(100vw-2rem))]">
        <div className="relative rounded-xl bg-white shadow-2xl ring-1 ring-gray-100 overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-6 pt-5 pb-1">
            <h2 className="text-[15px] font-semibold text-gray-900">New project</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Quick setup — refine everything later in project settings.
            </p>
          </div>

          <div className="px-6 pt-4 pb-5 space-y-5">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {error}
              </div>
            )}

            <div className="group">
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                className="w-full bg-transparent text-[22px] font-semibold text-gray-900 placeholder:text-gray-300 placeholder:font-medium outline-none border-0 border-b-2 border-transparent focus:border-[#3CCED7] transition py-1"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add some details"
                rows={2}
                className="mt-2 w-full resize-none bg-transparent text-[14px] text-gray-700 placeholder:text-gray-400 outline-none border-0 leading-5 py-1"
              />
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Media-buying type
              </div>
              <div className="flex flex-wrap gap-1.5">
                {projectTypeOptions.map((opt) => {
                  const active = selectedTypes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleType(opt.value)}
                      className={`px-3 py-1 rounded-full text-[12px] font-medium transition border ${
                        active
                          ? 'bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white border-transparent shadow-sm'
                          : 'bg-gray-100 text-gray-700 border-transparent hover:border-[#3CCED7]/40 hover:bg-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Monthly budget
                <span className="ml-1.5 text-gray-300 normal-case tracking-normal font-normal">optional · USD</span>
              </div>
              <div className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[14px] text-gray-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent pl-5 text-[14px] text-gray-900 placeholder:text-gray-300 outline-none border-0 border-b border-gray-200 focus:border-[#3CCED7] transition py-1"
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-3 bg-gray-50 flex justify-end items-center gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 rounded-lg text-[14px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[14px] font-semibold text-white bg-gradient-to-br from-[#3CCED7] to-[#A6E661] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
