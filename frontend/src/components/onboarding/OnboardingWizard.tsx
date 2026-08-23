'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
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
import { OrganizationAPI } from '@/lib/api/organizationApi';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuthStore } from '@/lib/authStore';
import { useRouter } from 'next/navigation';
import { buildUrl } from '@/lib/buildUrl';

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

const defaultObjectives = ['awareness'];
const defaultKpis = {
  ctr: { target: 0.02, suggested_by: defaultObjectives },
};

const steps: WizardStep[] = [
  {
    id: 'organization',
    title: 'Create Your Organization',
    description: 'Create your own organization or join an existing one to start your first project.',
  },
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
    id: 'invites',
    title: 'Invite Teammates',
    description: 'Add emails now or skip and invite later.',
  },
];

type WizardState = {
  // Organization related state
  organizationMode: 'create' | 'join';
  organizationName: string;
  organizationSlug: string;
  selectedOrganization: {
    id: number;
    name: string;
    slug: string;
    member_count?: number;
  } | null;
  // Tracks the org action already committed to the backend so Back can undo it
  committedOrg: { id: number; action: 'create' | 'join' } | null;

  // Original state
  projectName: string;
  mediaWorkTypes: string[];
  inviteEmails: string[];
  inviteInput: string;
};

const initialState: WizardState = {
  // Organization defaults
  organizationMode: 'create',
  organizationName: '',
  organizationSlug: '',
  selectedOrganization: null,
  committedOrg: null,

  // Original defaults
  projectName: '',
  mediaWorkTypes: [],
  inviteEmails: [],
  inviteInput: '',
};

type OnboardingWizardProps = {
  /** Return to Quick Start vs Classic chooser (onboarding overlay only). */
  onExit?: () => void;
};

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onExit }) => {
  const { markCompleted, fetchError, refreshProjects } = useOnboarding();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [state, setState] = useState<WizardState>(initialState);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validatingSlug, setValidatingSlug] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const slugInputRef = useRef<HTMLInputElement>(null);

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

  const toggleMultiSelect = (key: 'mediaWorkTypes', value: string) => {
    setState((prev) => {
      const exists = prev[key].includes(value);
      const nextValues = exists
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value];
      return { ...prev, [key]: nextValues };
    });
    setStepError(null);
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

  // Organization API handlers
  const handleCreateOrganization = async (name: string) => {
    try {
      const response = await OrganizationAPI.createOrganization({ name });
      updateState({
        selectedOrganization: {
          id: response.organization.id,
          name: response.organization.name,
          slug: response.organization.slug,
          member_count: response.organization.member_count,
        },
        committedOrg: { id: response.organization.id, action: 'create' },
      });
      toast.success(`Organization "${response.organization.name}" created successfully!`);
      return true;
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Failed to create organization';
      setStepError(message);
      toast.error(message);
      return false;
    }
  };

  const handleValidateSlug = async (slug: string) => {
    if (!slug.trim()) {
      setStepError('Please enter your organization code.');
      return;
    }

    setValidatingSlug(true);
    setStepError(null);

    try {
      const response = await OrganizationAPI.validateSlug(slug.trim());
      if (response.exists && response.organization) {
        updateState({ selectedOrganization: response.organization });
        toast.success(`Found organization: ${response.organization.name}`);
        slugInputRef.current?.blur();
      } else {
        setStepError('Organization not found. Please check the code and try again.');
        updateState({ selectedOrganization: null });
      }
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Failed to validate organization code';
      setStepError(message);
      updateState({ selectedOrganization: null });
    } finally {
      setValidatingSlug(false);
    }
  };

  const handleJoinOrganization = async (slug: string) => {
    try {
      const response = await OrganizationAPI.joinOrganization({ slug });
      updateState({
        selectedOrganization: {
          id: response.organization.id,
          name: response.organization.name,
          slug: response.organization.slug,
          member_count: response.organization.member_count,
        },
        committedOrg: { id: response.organization.id, action: 'join' },
      });
      toast.success(`Successfully joined "${response.organization.name}"!`);
      return true;
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Failed to join organization';
      setStepError(message);
      toast.error(message);
      return false;
    }
  };

  const validateStep = (stepIndex: number) => {
    switch (steps[stepIndex].id) {
      case 'organization':
        if (state.organizationMode === 'create') {
          if (!state.organizationName.trim()) {
            setStepError('Organization name is required.');
            return false;
          }
        } else {
          // Join mode
          if (!state.organizationSlug.trim()) {
            setStepError('Organization code is required.');
            return false;
          }
          if (!state.selectedOrganization) {
            setStepError('Please validate the organization code first.');
            return false;
          }
        }
        return true;
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
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    // Handle organization step with async API call
    if (steps[currentStep].id === 'organization') {
      setSubmitting(true);
      let success = false;

      if (state.organizationMode === 'create') {
        success = await handleCreateOrganization(state.organizationName.trim());
      } else {
        success = await handleJoinOrganization(state.organizationSlug.trim());
      }

      setSubmitting(false);

      if (!success) return; // Don't proceed if API call failed
    }

    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = async () => {
    setSubmitError(null);
    setStepError(null);

    // Going back from step 1 (projectName) to step 0 (organization) —
    // undo the org action that was already committed to the backend.
    if (currentStep === 1 && state.committedOrg) {
      const { id, action } = state.committedOrg;
      setUndoing(true);
      try {
        if (action === 'create') {
          // force=true bypasses the last-org check for new users
          await OrganizationAPI.deleteOrganization(id, true);
        } else {
          // Remove self from the joined org
          if (currentUserId) {
            await OrganizationAPI.removeMember(id, Number(currentUserId));
          }
        }
        // Reset org-related state so the user starts fresh on step 0
        updateState({
          committedOrg: null,
          selectedOrganization: null,
          organizationName: '',
          organizationSlug: '',
        });
      } catch {
        // Undo failed — still let the user go back; they can tidy up manually
        toast.error('Could not undo the previous action. You can remove the organization manually.');
        updateState({ committedOrg: null, selectedOrganization: null });
      } finally {
        setUndoing(false);
      }
    }

    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const buildPayload = (skipInvites: boolean): OnboardingProjectPayload => ({
    name: state.projectName.trim(),
    media_work_types: state.mediaWorkTypes,
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
      toast.success('Onboarding complete. Project created!');

      // Navigate immediately since markCompleted already set the active project
      // We'll let the main app refresh projects on mount
      router.push(buildUrl('/overview'));
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
          ? 'bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white border-transparent shadow-sm'
          : 'bg-white text-gray-700 border-gray-200 hover:border-[#3CCED7]/40 hover:text-[#3CCED7]'
      }`}
    >
      {label}
    </button>
  );

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'organization':
        return (
          <div className="space-y-4">
            {state.organizationMode === 'create' ? (
              <>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Organization name</label>
                  <input
                    type="text"
                    value={state.organizationName}
                    onChange={(e) => updateState({ organizationName: e.target.value })}
                    placeholder="e.g. Acme Corporation"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20 focus:outline-none transition"
                    disabled={submitting}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateState({ organizationMode: 'join', organizationName: '' })}
                  className="text-sm text-[#3CCED7] hover:text-[#0F172A] hover:underline transition"
                  disabled={submitting}
                >
                  Want to join an existing organization?
                </button>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Organization code</label>
                  <div className="flex gap-2">
                    <input
                      ref={slugInputRef}
                      type="text"
                      value={state.organizationSlug}
                      onChange={(e) => {
                        updateState({ organizationSlug: e.target.value, selectedOrganization: null });
                        setStepError(null);
                      }}
                      onFocus={() => {
                        if (state.selectedOrganization) {
                          updateState({ selectedOrganization: null });
                        }
                      }}
                      placeholder="e.g. acme-corp"
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20 focus:outline-none transition"
                      disabled={validatingSlug || submitting}
                    />
                    <button
                      type="button"
                      onClick={() => handleValidateSlug(state.organizationSlug)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white font-medium hover:opacity-90 transition disabled:opacity-60"
                      disabled={!state.organizationSlug.trim() || validatingSlug || submitting}
                    >
                      {validatingSlug ? (
                        'Validating...'
                      ) : state.selectedOrganization ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Validated
                        </>
                      ) : (
                        'Validate'
                      )}
                    </button>
                  </div>
                  {state.selectedOrganization && (
                    <div className="rounded-lg border border-[#3CCED7]/30 bg-[#3CCED7]/10 px-4 py-3 text-sm">
                      <div className="font-semibold text-gray-900">{state.selectedOrganization.name}</div>
                      <div className="text-gray-600">Organization code: {state.selectedOrganization.slug}</div>
                      {state.selectedOrganization.member_count !== undefined && (
                        <div className="text-gray-600">{state.selectedOrganization.member_count} members</div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => updateState({ organizationMode: 'create', organizationSlug: '', selectedOrganization: null })}
                  className="text-sm text-[#3CCED7] hover:text-[#0F172A] hover:underline transition"
                  disabled={submitting}
                >
                  Don&apos;t have a code? Create your own organization
                </button>
              </>
            )}
          </div>
        );
      case 'projectName':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Project name</label>
            <input
              type="text"
              value={state.projectName}
              onChange={(e) => updateState({ projectName: e.target.value })}
              placeholder="e.g. Q1 Performance Launch"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20 focus:outline-none transition"
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
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20 focus:outline-none transition"
              />
              <button
                type="button"
                onClick={addInvite}
                className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white font-medium hover:opacity-90 transition disabled:opacity-60"
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
                    className="inline-flex items-center gap-2 rounded-full bg-[#3CCED7]/10 text-[#0F172A] border border-[#3CCED7]/30 px-3 py-1 text-sm"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeInvite(email)}
                      className="text-[#3CCED7] hover:text-[#0F172A]"
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
      <div className="absolute -top-10 left-6 text-xs text-white/90 uppercase tracking-[0.2em] flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        Guided Onboarding
      </div>
      <div className="bg-white shadow-2xl rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-8 pt-8 pb-4 border-b border-gray-100 bg-gradient-to-r from-[#3CCED7]/5 via-white to-[#A6E661]/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-gray-500">Step {currentStep + 1} of {steps.length}</div>
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                {steps[currentStep].title}
                {currentStep === 0 && <ShieldCheck className="w-5 h-5 text-[#3CCED7]" />}
                {currentStep === steps.length - 1 && <Mail className="w-5 h-5 text-[#3CCED7]" />}
              </h2>
              <p className="text-gray-600 mt-1">{steps[currentStep].description}</p>
            </div>
            {onExit ? (
              <button
                type="button"
                onClick={onExit}
                className="inline-flex shrink-0 items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
                aria-label="Exit classic setup"
              >
                <X className="w-4 h-4" />
                Exit
              </button>
            ) : (
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-gray-600 justify-end">
                  <Users className="w-4 h-4 text-[#3CCED7]" />
                  Workspace locked until setup
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661] transition-all duration-300"
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
            <ShieldCheck className="w-4 h-4 text-[#3CCED7]" />
            Your dashboard is disabled until onboarding is complete.
          </div>
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-60"
                disabled={submitting || undoing}
              >
                <ArrowLeft className="w-4 h-4" />
                {undoing ? 'Undoing…' : 'Back'}
              </button>
            )}

            {currentStep < steps.length - 1 && (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-br from-[#3CCED7] to-[#A6E661] rounded-lg hover:opacity-90 disabled:opacity-70"
                disabled={submitting || undoing}
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
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-br from-[#3CCED7] to-[#A6E661] rounded-lg hover:opacity-90 disabled:opacity-70"
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
