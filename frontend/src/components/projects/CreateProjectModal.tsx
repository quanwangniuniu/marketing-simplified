'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import { ProjectAPI, ProjectData } from '@/lib/api/projectApi';

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (project: ProjectData | null) => void | Promise<void>;
};

const steps = [
  {
    id: 'projectName',
    title: 'Name Your Project',
    description: 'Give your project a clear, recognizable name.',
  },
  {
    id: 'mediaWork',
    title: 'Type of Media-Buying Work',
    description: 'Select all media-buying areas this project will cover.',
  },
  {
    id: 'invites',
    title: 'Invite Teammates',
    description: 'Add collaborators now or skip and invite later.',
  },
];

const mediaWorkOptions: { label: string; value: string }[] = [
  { label: 'Paid Social', value: 'paid_social' },
  { label: 'Paid Search', value: 'paid_search' },
  { label: 'Programmatic Advertising', value: 'programmatic' },
  { label: 'Influencer / UGC Campaigns', value: 'influencer_ugc' },
  { label: 'Cross-Channel Campaigns', value: 'cross_channel' },
  { label: 'Performance (Direct Response)', value: 'performance' },
  { label: 'Brand Awareness Campaigns', value: 'brand_campaigns' },
  { label: 'App Acquisition / App Install Campaigns', value: 'app_acquisition' },
];

const defaultObjectives = ['awareness'];
const defaultKpis = {
  ctr: { target: 0.02, suggested_by: defaultObjectives },
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getErrorMessage = (error: any) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  'Failed to create project';

const CreateProjectModal = ({ open, onClose, onCreated }: CreateProjectModalProps) => {
  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [inviteInput, setInviteInput] = useState('');
  const [invites, setInvites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setProjectName('');
    setSelectedTypes([]);
    setInviteInput('');
    setInvites([]);
    setError(null);
    setSubmitting(false);
  }, [open]);

  const toggleType = (value: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
    setError(null);
  };

  const addInvite = () => {
    const email = inviteInput.trim();
    if (!email) return;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (invites.includes(email)) {
      setError('This teammate is already added.');
      return;
    }
    setInvites((prev) => [...prev, email]);
    setInviteInput('');
    setError(null);
  };

  const removeInvite = (email: string) => {
    setInvites((prev) => prev.filter((item) => item !== email));
  };

  const validateStep = (index: number) => {
    if (index === 0 && !projectName.trim()) {
      setError('Project name is required.');
      return false;
    }
    if (index === 1 && selectedTypes.length === 0) {
      setError('Select at least one media-buying type.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (skipInvites = false) => {
    if (!validateStep(step)) return;
    setSubmitting(true);

    try {
      const payload = {
        name: projectName.trim(),
        project_type: selectedTypes,
        objectives: defaultObjectives,
        kpis: defaultKpis,
        invite_members: skipInvites
          ? []
          : invites.map((email) => ({
              email,
              role: 'Team Leader' as const,
            })),
      };

      const response = await ProjectAPI.createProjectViaOnboarding(payload);
      const project = (response as any)?.project || (response as ProjectData);
      toast.success('Project created successfully');

      if (onCreated) {
        await onCreated(project || null);
      }
      onClose();
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (steps[step].id) {
      case 'projectName':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Project name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Q1 Performance Launch"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[#3CCED7] focus:ring-2 focus:ring-blue-200 transition"
            />
          </div>
        );
      case 'mediaWork':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Select all that apply.</p>
            <div className="flex flex-wrap gap-2">
              {mediaWorkOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleType(option.value)}
                  className={`px-3 py-2 rounded-full border text-sm transition ${
                    selectedTypes.includes(option.value)
                      ? 'bg-[#3CCED7] text-white border-[#3CCED7] shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-[#1a9ba3]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        );
      case 'invites':
        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addInvite();
                  }
                }}
                placeholder="name@company.com"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 focus:border-[#3CCED7] focus:ring-2 focus:ring-blue-200 transition"
              />
              <button
                type="button"
                onClick={addInvite}
                className="px-4 py-2 rounded-lg bg-[#3CCED7] text-white font-medium hover:bg-[#2AB5BD] transition disabled:opacity-60"
                disabled={!inviteInput}
              >
                Add
              </button>
            </div>
            {invites.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {invites.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-2 rounded-full bg-[#3CCED7]/10 text-[#1a9ba3] px-3 py-1 text-sm"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeInvite(email)}
                      className="text-[#3CCED7] hover:text-[#1a9ba3]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">You can skip this step and invite teammates later.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose}>
      <div className="w-[min(960px,calc(100vw-2rem))]">
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-8 pt-8 pb-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-blue-50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-[0.2em] text-[#3CCED7] flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Create Project
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                  {steps[step].title}
                  {step === 1 && <CheckCircle2 className="w-5 h-5 text-[#3CCED7]" />}
                  {step === 2 && <Users className="w-5 h-5 text-[#3CCED7]" />}
                </h2>
                <p className="text-gray-600">{steps[step].description}</p>
              </div>
              <div className="text-sm font-medium text-gray-600">Step {step + 1} of {steps.length}</div>
            </div>
            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#3CCED7] transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="px-8 py-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                {error}
              </div>
            )}
            {renderStepContent()}
          </div>

          <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4 text-[#3CCED7]" />
              We’ll keep everyone in sync once the project is created.
            </div>
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-100"
                  disabled={submitting}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}

              {step < steps.length - 1 && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#3CCED7] rounded-lg hover:bg-[#2AB5BD] disabled:opacity-70"
                  disabled={submitting}
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === steps.length - 1 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    className="text-sm font-medium text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-70"
                    disabled={submitting}
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#3CCED7] rounded-lg hover:bg-[#2AB5BD] disabled:opacity-70"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating...' : 'Create project'}
                    {!submitting && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CreateProjectModal;
