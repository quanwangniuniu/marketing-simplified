'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  OnboardingProjectPayload,
  OnboardingProjectResponse,
  ProjectAPI,
  ProjectData,
} from '@/lib/api/projectApi';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useRouter } from 'next/navigation';

type WizardStep = {
  id: string;
  title: string;
  description: string;
};

const mediaWorkOptions = [
  'Paid Social',
  'Paid Search',
  'Programmatic Advertising',
  'Influencer / UGC Campaigns',
  'Cross-Channel Campaigns',
  'Performance (Direct Response)',
  'Brand Awareness Campaigns',
  'App Acquisition / App Install Campaigns',
];

const useCaseOptions = [
  'Project & Task Management',
  'Campaign Planning & Optimization',
  'Team Collaboration & Approvals',
  'Creative Asset Management',
  'Performance Tracking & Analytics',
  'Budget & Pacing Management',
  'Workflow & Task Assignment',
  'Centralized Operations Workspace',
  'Product personalization and analytics.',
];

const roleOptions = [
  'Super Administrator',
  'Organization Admin',
  'Team Leader',
  'Junior / Senior / Specialist Media Buyer',
  'Designer / Copywriter (Creative Team)',
  'Reviewer / Approver',
  'Campaign Manager',
  'Data Analyst',
  'Budget Controller',
  'Other',
];

const teamSizeOptions = ['Only me', '2-50', '51-250', '251-1k', '1k-5k', '5k+'];

const defaultObjectives = ['awareness'];
const defaultKpis = {
  ctr: { target: 0.02, suggested_by: defaultObjectives },
};

const steps: WizardStep[] = [
  {
    id: 'projectName',
    title: 'Name Your Project',
    description: 'Create your first project to unlock the dashboard.',
  },
  {
    id: 'mediaWork',
    title: 'Type of Media-Buying Work',
    description: 'Choose all channels that apply.',
  },
  {
    id: 'useCases',
    title: 'What Will You Use Marketing Simplified For?',
    description: 'Select the workflows you want to streamline.',
  },
  {
    id: 'role',
    title: "What's Your Role?",
    description: 'Help us tailor the workspace.',
  },
  {
    id: 'teamSize',
    title: 'Team Size',
    description: 'Estimate how many people will collaborate here.',
  },
  {
    id: 'invites',
    title: 'Invite Teammates',
    description: 'Add emails now or skip and invite later.',
  },
];

type WizardState = {
  projectName: string;
  mediaWorkTypes: string[];
  useCases: string[];
  role: string;
  teamSize: string;
  inviteEmails: string[];
  inviteInput: string;
};

const initialState: WizardState = {
  projectName: '',
  mediaWorkTypes: [],
  useCases: [],
  role: '',
  teamSize: '',
  inviteEmails: [],
  inviteInput: '',
};

const OnboardingWizard: React.FC = () => {
  const { markCompleted, fetchError, refreshProjects } = useOnboarding();
  const router = useRouter();
  const [state, setState] = useState<WizardState>(initialState);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const progress = useMemo(
    () => Math.round(((currentStep + 1) / steps.length) * 100),
    [currentStep]
  );

  const updateState = (payload: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...payload }));
    if (stepError) {
      setStepError(null);
    }
  };

  const toggleMultiSelect = (key: 'mediaWorkTypes' | 'useCases', value: string) => {
    setState((prev) => {
      const exists = prev[key].includes(value);
      const nextValues = exists
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value];
      return { ...prev, [key]: nextValues };
    });
    setStepError(null);
  };

  const setSingleSelect = (key: 'role' | 'teamSize', value: string) => {
    updateState({ [key]: value } as Partial<WizardState>);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addInvite = () => {
    const email = state.inviteInput.trim();
    if (!email) return;
    if (!validateEmail(email)) {
      setStepError('Please enter a valid email address.');
      return;
    }
    if (state.inviteEmails.includes(email)) {
      setStepError('This email is already added.');
      return;
    }
    updateState({
      inviteEmails: [...state.inviteEmails, email],
      inviteInput: '',
    });
  };

  const removeInvite = (email: string) => {
    updateState({
      inviteEmails: state.inviteEmails.filter((item) => item !== email),
    });
  };

  const validateStep = (stepIndex: number) => {
    switch (steps[stepIndex].id) {
      case 'projectName':
        if (!state.projectName.trim()) {
          setStepError('Project name is required.');
          return false;
        }
        return true;
      case 'mediaWork':
        if (state.mediaWorkTypes.length === 0) {
          setStepError('Select at least one type of media-buying work.');
          return false;
        }
        return true;
      case 'useCases':
        if (state.useCases.length === 0) {
          setStepError('Select at least one use case.');
          return false;
        }
        return true;
      case 'role':
        if (!state.role) {
          setStepError('Select your role.');
          return false;
        }
        return true;
      case 'teamSize':
        if (!state.teamSize) {
          setStepError('Select your team size.');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setSubmitError(null);
    setStepError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const buildPayload = (skipInvites: boolean): OnboardingProjectPayload => ({
    name: state.projectName.trim(),
    media_work_types: state.mediaWorkTypes,
    use_cases: state.useCases,
    role: state.role,
    team_size: state.teamSize,
    invite_emails: skipInvites ? [] : state.inviteEmails,
    objectives: defaultObjectives,
    kpis: defaultKpis,
  });

  const handleSubmit = async (skipInvites = false) => {
    if (!validateStep(currentStep)) return;

    setSubmitting(true);
    setSubmitError(null);

    const payload = buildPayload(skipInvites);

    try {
      const response = await ProjectAPI.createProjectViaOnboarding(payload);
      const project = (response as OnboardingProjectResponse)?.project || (response as ProjectData);

      if (!project || !project.id) {
        throw new Error('Invalid response from onboarding API');
      }

      markCompleted(project);
      // Refresh projects in store and navigate to the main workspace
      refreshProjects().finally(() => {
        router.push('/tasks');
      });
      toast.success('Onboarding complete. Project created!');
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Failed to finish onboarding';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    setStepError(null);
    setSubmitError(null);
  }, [currentStep]);

  const renderOptionPill = (
    label: string,
    isSelected: boolean,
    onClick: () => void,
    key: string
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-full border text-sm transition ${
        isSelected
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700'
      }`}
    >
      {label}
    </button>
  );

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'projectName':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Project name</label>
            <input
              type="text"
              value={state.projectName}
              onChange={(e) => updateState({ projectName: e.target.value })}
              placeholder="e.g. Q1 Performance Launch"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
            />
          </div>
        );
      case 'mediaWork':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Select all that apply.</p>
            <div className="flex flex-wrap gap-2">
              {mediaWorkOptions.map((option) =>
                renderOptionPill(
                  option,
                  state.mediaWorkTypes.includes(option),
                  () => toggleMultiSelect('mediaWorkTypes', option),
                  option
                )
              )}
            </div>
          </div>
        );
      case 'useCases':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Choose the workflows you plan to run.</p>
            <div className="flex flex-wrap gap-2">
              {useCaseOptions.map((option) =>
                renderOptionPill(
                  option,
                  state.useCases.includes(option),
                  () => toggleMultiSelect('useCases', option),
                  option
                )
              )}
            </div>
          </div>
        );
      case 'role':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {roleOptions.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSingleSelect('role', role)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                  state.role === role
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                <span>{role}</span>
                {state.role === role && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
          </div>
        );
      case 'teamSize':
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {teamSizeOptions.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setSingleSelect('teamSize', size)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  state.teamSize === size
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        );
      case 'invites':
        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={state.inviteInput}
                onChange={(e) => updateState({ inviteInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addInvite();
                  }
                }}
                placeholder="name@company.com"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
              />
              <button
                type="button"
                onClick={addInvite}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-60"
                disabled={!state.inviteInput}
              >
                Add
              </button>
            </div>
            {state.inviteEmails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {state.inviteEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-800 px-3 py-1 text-sm"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeInvite(email)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">
              You can skip this step and invite teammates later from the dashboard.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative z-[9999] w-full max-w-4xl mx-auto">
      <div className="absolute -top-10 left-6 text-xs text-blue-100 uppercase tracking-[0.2em] flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        Guided Onboarding
      </div>
      <div className="bg-white shadow-2xl rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-8 pt-8 pb-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Step {currentStep + 1} of {steps.length}</div>
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                {steps[currentStep].title}
                {currentStep === 0 && <ShieldCheck className="w-5 h-5 text-blue-600" />}
                {currentStep === 5 && <Mail className="w-5 h-5 text-blue-600" />}
              </h2>
              <p className="text-gray-600 mt-1">{steps[currentStep].description}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm text-gray-600 justify-end">
                <Users className="w-4 h-4 text-blue-600" />
                Workspace locked until setup
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="px-8 py-6 space-y-4">
          {fetchError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 mt-0.5" />
              <div>
                <div className="font-semibold">We had trouble checking your projects.</div>
                <div>{fetchError}</div>
                <button
                  type="button"
                  onClick={refreshProjects}
                  className="mt-2 text-amber-900 font-semibold hover:underline"
                >
                  Retry check
                </button>
              </div>
            </div>
          )}

          {renderStepContent()}

          {(stepError || submitError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {stepError || submitError}
            </div>
          )}
        </div>

        <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Your dashboard is disabled until onboarding is complete.
          </div>
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
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

            {currentStep < steps.length - 1 && (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-70"
                disabled={submitting}
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === steps.length - 1 && (
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
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-70"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Send invitations'}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
