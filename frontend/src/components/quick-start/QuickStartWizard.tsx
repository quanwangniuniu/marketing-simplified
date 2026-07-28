'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveQuickStartExitPath } from '@/lib/quickStartReturn';
import toast from 'react-hot-toast';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProjectAPI } from '@/lib/api/projectApi';
import type { ProjectData } from '@/lib/api/projectApi';
import { useQuickStartRetryCooldown } from '@/hooks/useQuickStartRetryCooldown';
import { QuickStartAPI } from '@/lib/api/quickStartApi';
import {
  QUICK_START_CONFIRM_ERROR_FALLBACK,
  QUICK_START_PREVIEW_ERROR_FALLBACK,
  resolveQuickStartError,
} from '@/lib/quickStartUserMessages';
import { saveQuickStartPostCreateGuide } from '@/lib/quickStartPostCreate';
import {
  INITIAL_QUICK_START_WIZARD_STATE,
  QUICK_START_MAX_COMBINED_LENGTH,
  QUICK_START_MAX_PROMPT_LENGTH,
  QUICK_START_MIN_PROMPT_LENGTH,
  QUICK_START_WIZARD_STEPS,
} from './constants';
import {
  isQuickStartCombinedLengthValid,
  isQuickStartPromptLengthValid,
} from './inputLimits';
import { buildQuickStartPreviewRequest } from './buildPreviewRequest';
import {
  buildQuickStartConfirmRequest,
  hasEnabledQuickStartModule,
  validateQuickStartConfirm,
} from './buildConfirmRequest';
import QuickStartGenerating from './QuickStartGenerating';
import QuickStartShell from './QuickStartShell';
import QuickStartPreviewStep from './steps/QuickStartPreviewStep';
import RegenerateWarning from '@/components/agent/chat/RegenerateWarning';
import QuickStartPromptStep from './steps/QuickStartPromptStep';
import QuickStartSupplementStep from './steps/QuickStartSupplementStep';
import type { QuickStartSelectedModules } from '@/types/quickStart';
import type { QuickStartPreviewPayload, QuickStartWizardState } from './types';
import { buildUrl } from '@/lib/buildUrl';

type LoadingMode = 'preview' | 'confirm' | null;

function previewFailureMessage(error: unknown): string {
  return resolveQuickStartError(error, QUICK_START_PREVIEW_ERROR_FALLBACK).message;
}

function confirmFailureMessage(error: unknown): string {
  return resolveQuickStartError(error, QUICK_START_CONFIRM_ERROR_FALLBACK).message;
}

export default function QuickStartWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { markCompleted, refreshProjects } = useOnboarding();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<QuickStartWizardState>(INITIAL_QUICK_START_WIZARD_STATE);
  const [stepError, setStepError] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>(null);
  const [preview, setPreview] = useState<QuickStartPreviewPayload | null>(null);
  const [showRegenWarning, setShowRegenWarning] = useState(false);
  const [pendingRegenModules, setPendingRegenModules] = useState<QuickStartSelectedModules | undefined>(undefined);
  const { isCoolingDown, secondsLeft, startCooldown } = useQuickStartRetryCooldown();

  const currentStep = QUICK_START_WIZARD_STEPS[stepIndex];
  const isWorking = loadingMode !== null;

  const updateState = useCallback((patch: Partial<QuickStartWizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
    setStepError(null);
  }, []);

  const exitWizard = useCallback(() => {
    router.push(resolveQuickStartExitPath(searchParams.get('from')));
  }, [router, searchParams]);

  const validatePrompt = useCallback(() => {
    const trimmed = state.prompt.trim();
    if (trimmed.length < QUICK_START_MIN_PROMPT_LENGTH) {
      setStepError(
        `Please enter at least ${QUICK_START_MIN_PROMPT_LENGTH} characters describing your campaign.`
      );
      return false;
    }
    if (trimmed.length > QUICK_START_MAX_PROMPT_LENGTH) {
      setStepError(
        `Campaign prompt must be at most ${QUICK_START_MAX_PROMPT_LENGTH.toLocaleString()} characters.`
      );
      return false;
    }
    return true;
  }, [state.prompt]);

  const validateSupplement = useCallback(() => {
    if (!validatePrompt()) return false;

    const promptLen = state.prompt.trim().length;
    const supplementLen = state.supplement.trim().length;
    if (!isQuickStartCombinedLengthValid(promptLen, supplementLen)) {
      setStepError(
        `Prompt and additional context combined must be at most ${QUICK_START_MAX_COMBINED_LENGTH.toLocaleString()} characters.`
      );
      return false;
    }
    return true;
  }, [state.prompt, state.supplement, validatePrompt]);

  const fetchPreview = useCallback(
    async (options?: {
      advanceToPreview?: boolean;
      selectedModules?: QuickStartSelectedModules;
    }) => {
      if (!validateSupplement()) return;

      setLoadingMode('preview');
      setStepError(null);

      const requestState: QuickStartWizardState = {
        ...state,
        selectedModules: options?.selectedModules ?? state.selectedModules,
      };
      if (options?.selectedModules) {
        setState((prev) => ({ ...prev, selectedModules: options.selectedModules! }));
      }

      try {
        const response = await QuickStartAPI.preview(
          buildQuickStartPreviewRequest(requestState, 2)
        );

        if (!response.outline || !response.blueprint) {
          setStepError('Preview did not return a blueprint. Please try again.');
          return;
        }

        const payload: QuickStartPreviewPayload = {
          outline: response.outline,
          blueprint: response.blueprint,
        };
        setPreview(payload);
        setState((prev) => ({
          ...prev,
          projectTitle: response.outline?.project.title ?? prev.projectTitle,
        }));

        if (options?.advanceToPreview !== false) {
          setStepIndex(2);
        }
      } catch (error) {
        const resolved = resolveQuickStartError(error, QUICK_START_PREVIEW_ERROR_FALLBACK);
        setStepError(resolved.message);
        if (resolved.retryAfterSeconds) {
          startCooldown(resolved.retryAfterSeconds);
        }
      } finally {
        setLoadingMode(null);
      }
    },
    [state, validateSupplement]
  );

  const handleNextFromPrompt = async () => {
    if (!validatePrompt()) return;

    setLoadingMode('preview');
    setStepError(null);

    try {
      await QuickStartAPI.preview(buildQuickStartPreviewRequest(state, 1));
      setStepIndex(1);
    } catch (error) {
      const resolved = resolveQuickStartError(error, QUICK_START_PREVIEW_ERROR_FALLBACK);
      setStepError(resolved.message);
      if (resolved.retryAfterSeconds) {
        startCooldown(resolved.retryAfterSeconds);
      }
    } finally {
      setLoadingMode(null);
    }
  };

  const handleSkipSupplement = () => {
    void fetchPreview();
  };

  const handleNextFromSupplement = () => {
    void fetchPreview();
  };

  const handleRegenerate = () => {
    setPendingRegenModules(undefined);
    setShowRegenWarning(true);
  };

  const confirmRegenerate = () => {
    setShowRegenWarning(false);
    void fetchPreview({ advanceToPreview: false, selectedModules: pendingRegenModules });
  };

  const handleConfirm = async () => {
    const validationError = validateQuickStartConfirm(preview, state);
    if (validationError) {
      setStepError(validationError);
      return;
    }

    setLoadingMode('confirm');
    setStepError(null);

    try {
      const response = await QuickStartAPI.confirm(
        buildQuickStartConfirmRequest(preview!, state)
      );

      const project: ProjectData = {
        id: response.project.id,
        slug: response.project.slug,
        name: response.project.name,
        is_active: response.project.is_active ?? true,
      };

      // set_active is slug-only on the backend; pass slug (fall back to id for legacy).
      await ProjectAPI.setActiveProject(project.slug ?? project.id);
      markCompleted(project);
      await refreshProjects();

      const {
        tasks,
        spreadsheets,
        calendar_events: calendarEvents,
        decisions,
        miro_boards: miroBoards,
      } = response.summary;
      saveQuickStartPostCreateGuide({
        projectId: project.id,
        projectName: project.name,
        summary: response.summary,
        enabledModules: { ...state.selectedModules },
        spreadsheetId: response.created.spreadsheet_slugs?.[0] ?? null,
        miroBoardId: response.created.miro_board_slugs?.[0] ?? null,
        createdAt: Date.now(),
      });
      const parts = [
        tasks > 0 ? `${tasks} task${tasks === 1 ? '' : 's'}` : null,
        spreadsheets > 0 ? `${spreadsheets} spreadsheet${spreadsheets === 1 ? '' : 's'}` : null,
        calendarEvents > 0
          ? `${calendarEvents} calendar event${calendarEvents === 1 ? '' : 's'}`
          : null,
        decisions > 0 ? `${decisions} decision${decisions === 1 ? '' : 's'}` : null,
        miroBoards > 0 ? `${miroBoards} board${miroBoards === 1 ? '' : 's'}` : null,
      ].filter(Boolean);
      toast.success(
        parts.length > 0
          ? `Created "${project.name}" with ${parts.join(', ')}.`
          : `Created "${project.name}".`
      );
      router.push(buildUrl('/overview'));
    } catch (error) {
      const message = confirmFailureMessage(error);
      setStepError(message);
      toast.error(message);
    } finally {
      setLoadingMode(null);
    }
  };

  const previewPrimaryDisabled =
    !state.projectTitle.trim() || !hasEnabledQuickStartModule(state.selectedModules);

  const supplementGenerateDisabled =
    isCoolingDown ||
    !isQuickStartCombinedLengthValid(state.prompt.trim().length, state.supplement.trim().length);

  const supplementPrimaryLabel = isCoolingDown
    ? `Try again in ${secondsLeft}s`
    : 'Generate preview';

  const previewRegenerateDisabled = isCoolingDown || previewPrimaryDisabled;
  const previewRegenerateLabel = isCoolingDown ? `Try again in ${secondsLeft}s` : 'Regenerate';

  const shellProps =
    currentStep.id === 'prompt'
      ? {
          primaryLabel: 'Continue',
          onPrimary: () => void handleNextFromPrompt(),
          primaryDisabled: !isQuickStartPromptLengthValid(state.prompt.trim().length),
          showBack: false,
          showSecondary: false,
        }
      : currentStep.id === 'supplement'
        ? {
            primaryLabel: supplementPrimaryLabel,
            onPrimary: handleNextFromSupplement,
            onSecondary: handleSkipSupplement,
            secondaryLabel: 'Skip',
            showBack: true,
            showSecondary: true,
            onBack: () => setStepIndex(0),
            primaryDisabled: supplementGenerateDisabled,
            secondaryDisabled: isWorking,
          }
        : {
            primaryLabel: 'Create project',
            onPrimary: () => void handleConfirm(),
            onSecondary: handleRegenerate,
            secondaryLabel: previewRegenerateLabel,
            showBack: true,
            showSecondary: true,
            onBack: () => setStepIndex(1),
            primaryDisabled: previewPrimaryDisabled,
            secondaryDisabled: previewRegenerateDisabled,
          };

  const generatingMessage =
    loadingMode === 'confirm'
      ? 'Creating your project and workspace…'
      : currentStep.id === 'preview'
        ? 'Regenerating your project draft…'
        : 'Generating your project draft with AI…';

  const stepContent = (() => {
    if (isWorking && currentStep.id !== 'prompt') {
      return <QuickStartGenerating message={generatingMessage} mode={loadingMode ?? 'preview'} />;
    }

    if (currentStep.id === 'prompt') {
      return <QuickStartPromptStep state={state} onChange={updateState} />;
    }
    if (currentStep.id === 'supplement') {
      return <QuickStartSupplementStep state={state} onChange={updateState} />;
    }
    if (!preview) {
      return (
        <p className="text-sm text-gray-600">
          No preview loaded. Go back and generate a draft.
        </p>
      );
    }
    return (
      <QuickStartPreviewStep
        state={state}
        preview={preview}
        onChange={updateState}
        onBlueprintChange={(nextBlueprint) => {
          setPreview((current) =>
            current ? { ...current, blueprint: nextBlueprint } : current
          );
        }}
        onRegenerate={(selectedModules) => {
          setPendingRegenModules(selectedModules);
          setShowRegenWarning(true);
        }}
      />
    );
  })();

  return (
    <>
      <RegenerateWarning
        isOpen={showRegenWarning}
        estimatedTokens={500}
        onConfirm={confirmRegenerate}
        onCancel={() => setShowRegenWarning(false)}
      />
      <QuickStartShell
        step={currentStep}
        stepIndex={stepIndex}
        totalSteps={QUICK_START_WIZARD_STEPS.length}
        errorMessage={stepError}
        onExit={exitWizard}
        isSubmitting={isWorking}
        {...shellProps}
      >
        {stepContent}
      </QuickStartShell>
    </>
  );
}
