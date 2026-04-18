'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SpreadsheetAPI } from '@/lib/api/spreadsheetApi';
import { SpreadsheetData, SheetData, CreateSheetRequest, UpdateSheetRequest } from '@/types/spreadsheet';
import { AlertCircle, ArrowLeft, FileSpreadsheet, Loader2, Plus, X } from 'lucide-react';
import CreateSheetModal from '@/components/spreadsheets/CreateSheetModal';
import SpreadsheetGrid, { SpreadsheetGridHandle } from '@/components/spreadsheets/SpreadsheetGrid';
import PatternAgentPanel from '@/components/spreadsheets/PatternAgentPanel';
import { PivotEditorPanel } from '@/components/spreadsheets/PivotEditorPanel';
import {
  PivotConfig,
  SourceColumn,
  SourceRow,
  buildPivotTable,
  pivotResultToCellOperations,
  generateClearOperationsForStaleCells,
  generatePivotSheetName,
  createEmptyPivotConfig,
  isPivotConfigValid,
} from '@/lib/spreadsheet/pivot';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import { PatternAPI } from '@/lib/api/patternApi';
import { rowColToA1 } from '@/lib/spreadsheets/a1';
import {
  HEADER_ROW_INDEX,
  RENAME_DEDUP_WINDOW_MS,
  recordRenameColumnStep,
  shouldRecordHeaderRename,
  RenameDedupState,
} from '@/lib/spreadsheets/patternRecorder';
import {
  CreatePatternPayload,
  ApplyHighlightParams,
  FillSeriesParams,
  InsertColumnParams,
  InsertRowParams,
  DeleteColumnParams,
  PatternStep,
  TimelineItem,
  flattenTimelineItems,
  WorkflowPatternDetail,
  WorkflowPatternStepRecord,
  WorkflowPatternSummary,
  PatternJobStatus,
} from '@/types/patterns';
import {
  deleteTimelineItemById,
  moveStepOutOfGroup,
  timelineItemsToCreateSteps,
  updateTimelineItemById,
} from '@/lib/spreadsheets/timelineItems';

export default function SpreadsheetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;
  const spreadsheetId = params?.spreadsheetId as string;
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetData | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createSheetModalOpen, setCreateSheetModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createSheetDefaultName, setCreateSheetDefaultName] = useState('Sheet1');
  const [renamingSheetId, setRenamingSheetId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renamingSpreadsheetTitle, setRenamingSpreadsheetTitle] = useState(false);
  const [spreadsheetTitleRenameValue, setSpreadsheetTitleRenameValue] = useState('');
  const [renamingSpreadsheetSaving, setRenamingSpreadsheetSaving] = useState(false);
  const [sheetMenuOpenId, setSheetMenuOpenId] = useState<number | null>(null);
  const [sheetMenuAnchor, setSheetMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirmSheet, setDeleteConfirmSheet] = useState<SheetData | null>(null);
  const [deletingSheet, setDeletingSheet] = useState(false);
  const [highlightCell, setHighlightCell] = useState<{ row: number; col: number } | null>(null);
  const [patterns, setPatterns] = useState<WorkflowPatternSummary[]>([]);
  const [exportingPattern, setExportingPattern] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<WorkflowPatternDetail | null>(null);
  const [applySteps, setApplySteps] = useState<
    Array<WorkflowPatternStepRecord & { status: 'pending' | 'success' | 'error'; errorMessage?: string }>
  >([]);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyFailedIndex, setApplyFailedIndex] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [patternJobId, setPatternJobId] = useState<string | null>(null);
  const [patternJobStatus, setPatternJobStatus] = useState<PatternJobStatus | null>(null);
  const [patternJobProgress, setPatternJobProgress] = useState(0);
  const [patternJobStep, setPatternJobStep] = useState<number | null>(null);
  const [patternJobError, setPatternJobError] = useState<string | null>(null);
  const [sheetHydrationReady, setSheetHydrationReady] = useState(true);
  const [pivotConfigsBySheet, setPivotConfigsBySheet] = useState<Record<number, PivotConfig>>({});
  const [pivotSourceDataBySheet, setPivotSourceDataBySheet] = useState<Record<number, {
    cells: Map<string, { rawInput: string; computedString?: string | null }>;
    rowCount: number;
    colCount: number;
    sourceSheetId: number;
    sourceSheetName: string;
  }>>({});
  const [pivotDimensionsBySheet, setPivotDimensionsBySheet] = useState<Record<number, { rowCount: number; colCount: number }>>({});
  const [showPivotEditor, setShowPivotEditor] = useState(false);
  const gridRef = useRef<SpreadsheetGridHandle | null>(null);
  const patternJobStartRef = useRef<number | null>(null);
  const renameDedupRef = useRef<Record<number, RenameDedupState>>({});
  const activeJobIdRef = useRef<string | null>(null);
  const applyStepsRef = useRef<
    Array<WorkflowPatternStepRecord & { status: 'pending' | 'success' | 'error'; errorMessage?: string }>
  >([]);
  const applyHighlightStepsRef = useRef<(steps: WorkflowPatternStepRecord[]) => void>(() => {});
  const isReplayingRef = useRef(false);
  const isCreatingFirstSheetRef = useRef(false);
  const [agentStepsBySheet, setAgentStepsBySheet] = useState<Record<number, TimelineItem[]>>({});

  useEffect(() => {
    if (activeSheetId == null) return;
    setHighlightCell(null);
    const activeSheet = sheets.find((s) => s.id === activeSheetId);
    const isPivot = !!activeSheet && activeSheet.kind === 'pivot';
    setShowPivotEditor(isPivot);
  }, [activeSheetId, sheets]);

  // When a pivot sheet becomes active and we don't yet have its source metadata in memory,
  // hydrate pivotSourceDataBySheet by reading the source sheet from the backend.
  useEffect(() => {
    const hydratePivotSource = async () => {
      if (!spreadsheetId || !activeSheetId) return;
      const activeSheet = sheets.find((s) => s.id === activeSheetId);
      if (!activeSheet || activeSheet.kind !== 'pivot') return;
      if (pivotSourceDataBySheet[activeSheetId]) return;

      // Prefer in-memory config; fall back to sheet.pivot_config from API payload.
      const config = pivotConfigsBySheet[activeSheetId];
      const sourceSheetId =
        config?.sourceSheetId ?? activeSheet.pivot_config?.source_sheet_id ?? null;
      if (!sourceSheetId) return;

      const sourceSheet = sheets.find((s) => s.id === sourceSheetId);
      const sourceSheetName = sourceSheet?.name ?? 'Unknown';

      try {
        const sourceSheetData = await SpreadsheetAPI.readCellRange(
          Number(spreadsheetId),
          sourceSheetId,
          0,
          999,
          0,
          50
        );

        const sourceRowCount =
          sourceSheetData.sheet_row_count ?? sourceSheetData.row_count;
        const sourceColCount =
          sourceSheetData.sheet_column_count ?? sourceSheetData.column_count;

        const getCellKey = (row: number, col: number) => `${row}:${col}`;

        const cells = new Map<string, { rawInput: string; computedString?: string | null }>();
        for (const cell of sourceSheetData.cells) {
          const key = getCellKey(cell.row_position, cell.column_position);
          cells.set(key, {
            rawInput: cell.raw_input ?? '',
            computedString: cell.computed_string ?? null,
          });
        }

        setPivotSourceDataBySheet((prev) => {
          // If another concurrent hydrate already populated it, keep existing.
          if (prev[activeSheetId]) return prev;
          return {
            ...prev,
            [activeSheetId]: {
              cells,
              rowCount: sourceRowCount,
              colCount: sourceColCount,
              sourceSheetId,
              sourceSheetName,
            },
          };
        });
      } catch (err) {
        console.error('Failed to hydrate pivot source data:', err);
      }
    };

    hydratePivotSource();
  }, [activeSheetId, spreadsheetId, sheets, pivotConfigsBySheet, pivotSourceDataBySheet]);

  const agentSteps = activeSheetId != null ? agentStepsBySheet[activeSheetId] ?? [] : [];

  const updateAgentSteps = useCallback(
    (updater: TimelineItem[] | ((prev: TimelineItem[]) => TimelineItem[])) => {
      if (activeSheetId == null) return;
      setAgentStepsBySheet((prev) => {
        const current = prev[activeSheetId] ?? [];
        const next = typeof updater === 'function' ? updater(current) : updater;
        if (next === current) return prev;
        return {
          ...prev,
          [activeSheetId]: next,
        };
      });
    },
    [activeSheetId]
  );

  const createStepId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `step_${Date.now()}_${Math.random().toString(16).slice(2)}`;


  const getNextSheetName = (existingSheets: SheetData[]) => {
    const sheetNumberRegex = /^sheet(\d+)$/i;
    let maxNumber = 0;
    existingSheets.forEach((sheet) => {
      const match = sheet.name.trim().match(sheetNumberRegex);
      if (match) {
        const num = Number(match[1]);
        if (!Number.isNaN(num)) {
          maxNumber = Math.max(maxNumber, num);
        }
      }
    });
    return `Sheet${maxNumber + 1}`;
  };

  const createFirstSheetIfNeeded = async (existingSheets: SheetData[]) => {
    if (!spreadsheetId || existingSheets.length > 0) {
      return null;
    }

    // If another concurrent call is already in the process of creation, exit directly.
    if (isCreatingFirstSheetRef.current) {
      return null;
    }

    // lock
    isCreatingFirstSheetRef.current = true;

    try {
      return await SpreadsheetAPI.createSheet(Number(spreadsheetId), { name: 'Sheet1' });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 400) {
        // Sheet1 already exists (race/auto-create), fetch it.
        const retryResponse = await SpreadsheetAPI.listSheets(Number(spreadsheetId));
        const retrySheets = retryResponse.results || [];
        if (retrySheets.length > 0) {
          return retrySheets[0];
        }
      }
      throw err;
    } finally {
      // Unlock regardless of success or failure.
      isCreatingFirstSheetRef.current = false;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!spreadsheetId) {
        setError('Spreadsheet ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Fetch spreadsheet
        const spreadsheetData = await SpreadsheetAPI.getSpreadsheet(Number(spreadsheetId));
        setSpreadsheet(spreadsheetData);

        // Fetch sheets
        const sheetsResponse = await SpreadsheetAPI.listSheets(Number(spreadsheetId));
        const sheetsList = sheetsResponse.results || [];

        // Auto-create the first sheet if none exist yet
        if (sheetsList.length === 0) {
          const newSheet = await createFirstSheetIfNeeded(sheetsList);
          if (newSheet) {
            setSheets([newSheet]);
            setActiveSheetId(newSheet.id);
          }
        } else {
          setSheets(sheetsList);
          setCreateSheetDefaultName(getNextSheetName(sheetsList));

          // Hydrate pivot configs from backend metadata
          const hydratedPivotConfigs: Record<number, PivotConfig> = {};
          sheetsList.forEach((sheet) => {
            if (sheet.kind === 'pivot' && sheet.pivot_config) {
              const cfg = sheet.pivot_config;
              hydratedPivotConfigs[sheet.id] = {
                sourceSheetId: cfg.source_sheet_id,
                rows: cfg.rows_config || [],
                columns: cfg.columns_config || [],
                values: cfg.values_config || [],
                showGrandTotalRow: cfg.show_grand_total_row,
              };
            }
          });
          setPivotConfigsBySheet(hydratedPivotConfigs);
          // Set first sheet as active if available
          if (sheetsList.length > 0 && !activeSheetId) {
            setActiveSheetId(sheetsList[0].id);
          }
        }
      } catch (err: any) {
        console.error('Failed to load data:', err);
        const errorMessage =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to load spreadsheet';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [spreadsheetId]);

  useEffect(() => {
    const loadPatterns = async () => {
      try {
        const response = await PatternAPI.listPatterns();
        setPatterns(response.results || []);
      } catch (err) {
        console.error('Failed to load patterns:', err);
      }
    };
    loadPatterns();
  }, []);

  const loadPatternDetail = useCallback(async (patternId: string) => {
    try {
      const pattern = await PatternAPI.getPattern(patternId);
      const sortedSteps = [...(pattern.steps || [])].sort((a, b) => a.seq - b.seq);
      setSelectedPattern(pattern);
      setApplySteps(
        sortedSteps.map((step) => ({
          ...step,
          status: 'pending',
        }))
      );
      setApplyError(null);
      setApplyFailedIndex(null);
    } catch (err) {
      console.error('Failed to load pattern detail:', err);
      toast.error('Failed to load pattern');
    }
  }, []);

  const handleDeletePattern = useCallback(
    async (patternId: string) => {
      try {
        await PatternAPI.deletePattern(patternId);
        setPatterns((prev) => prev.filter((pattern) => pattern.id !== patternId));
        if (selectedPattern?.id === patternId) {
          setSelectedPattern(null);
          setApplySteps([]);
          setApplyError(null);
          setApplyFailedIndex(null);
        }
        toast.success('Pattern deleted');
      } catch (err: any) {
        console.error('Failed to delete pattern:', err);
        const errorMessage =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to delete pattern';
        toast.error(errorMessage);
      }
    },
    [selectedPattern]
  );





  const applyHighlightSteps = useCallback((steps: WorkflowPatternStepRecord[]) => {
    steps.forEach((step) => {
      if (step.type !== 'APPLY_HIGHLIGHT' || step.disabled) return;
      gridRef.current?.applyHighlightOperation(step.params as ApplyHighlightParams);
    });
  }, []);

  useEffect(() => {
    applyStepsRef.current = applySteps;
    applyHighlightStepsRef.current = applyHighlightSteps;
  }, [applySteps, applyHighlightSteps]);

  const applyPatternSteps = useCallback(async () => {
    if (!selectedPattern || !spreadsheetId || !activeSheetId) return;
    isReplayingRef.current = true;
    setIsApplying(true);
    setApplyError(null);
    setApplyFailedIndex(null);
    setPatternJobError(null);
    setPatternJobProgress(0);
    setPatternJobStep(null);
    setPatternJobId(null);
    setPatternJobStatus(null);
    setApplySteps((prev) => prev.map((step) => ({ ...step, status: 'pending', errorMessage: undefined })));

    try {
      const applyUrl = `/api/spreadsheet/patterns/${selectedPattern.id}/apply/`;
      if (process.env.NODE_ENV !== 'production') {
        console.info('[PatternApply] POST', applyUrl, {
          spreadsheet_id: Number(spreadsheetId),
          sheet_id: activeSheetId,
        });
      }
      const response = await PatternAPI.applyPattern(selectedPattern.id, {
        spreadsheet_id: Number(spreadsheetId),
        sheet_id: activeSheetId,
      });
      if (process.env.NODE_ENV !== 'production') {
        console.info('[PatternApply] job_id', response.job_id, 'status', response.status);
      }
      patternJobStartRef.current = Date.now();
      setPatternJobId(response.job_id);
      setPatternJobStatus(response.status);
    } catch (err: any) {
      isReplayingRef.current = false;
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to apply pattern';
      setApplyError(message);
      setIsApplying(false);
      toast.error(message);
    }
  }, [selectedPattern, spreadsheetId, activeSheetId]);

  useEffect(() => {
    if (!patternJobId) return;
    if (activeJobIdRef.current === patternJobId) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[PatternPoll] skip duplicate poll start', { jobId: patternJobId });
      }
      return;
    }
    activeJobIdRef.current = patternJobId;
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    const isTerminal = (job: { status: string; finishedAt?: string | null }) =>
      job.status === 'succeeded' ||
      job.status === 'failed' ||
      job.status === 'canceled' ||
      job.finishedAt != null;

    if (process.env.NODE_ENV !== 'production') {
      console.info('[PatternPoll] start', { jobId: patternJobId });
    }

    const poll = async () => {
      try {
        const job = await PatternAPI.getPatternJob(patternJobId);
        if (cancelled) return;

        setPatternJobStatus(job.status);
        setPatternJobProgress(job.progress ?? 0);
        setPatternJobStep(job.current_step ?? null);
        setPatternJobError(job.error_message ?? null);

        setApplySteps((prev) =>
          prev.map((step) => {
            if (job.status === 'succeeded') {
              return { ...step, status: 'success', errorMessage: undefined };
            }
            if (job.status === 'failed' && job.current_step === step.seq) {
              return { ...step, status: 'error', errorMessage: job.error_message ?? 'Failed to apply step' };
            }
            if (job.current_step != null && step.seq < job.current_step) {
              return { ...step, status: 'success', errorMessage: undefined };
            }
            return { ...step, status: 'pending', errorMessage: undefined };
          })
        );

        if (isTerminal(job)) {
          activeJobIdRef.current = null;
          isReplayingRef.current = false;
          if (process.env.NODE_ENV !== 'production') {
            console.info('[PatternPoll] stop', { jobId: patternJobId, status: job.status, finishedAt: job.finishedAt });
          }
        }

        if (job.status === 'succeeded') {
          setIsApplying(false);
          patternJobStartRef.current = null;
          gridRef.current?.refresh();
          const steps = applyStepsRef.current;
          applyHighlightStepsRef.current(steps);
          return;
        }

        if (job.status === 'failed') {
          setIsApplying(false);
          setApplyError(job.error_message ?? 'Failed to apply pattern');
          setApplyFailedIndex(
            job.current_step != null ? Math.max(0, job.current_step - 1) : null
          );
          patternJobStartRef.current = null;
          return;
        }

        if (job.status === 'canceled') {
          setIsApplying(false);
          patternJobStartRef.current = null;
          return;
        }

        if (job.status === 'queued') {
          const startedAt = patternJobStartRef.current;
          if (startedAt && Date.now() - startedAt > 60000) {
            activeJobIdRef.current = null;
            isReplayingRef.current = false;
            const message = 'Pattern job is still queued after 60s. Worker may not be consuming tasks.';
            setIsApplying(false);
            setApplyError(message);
            setPatternJobError(message);
            return;
          }
        }
      } catch (err: any) {
        if (cancelled) return;
        activeJobIdRef.current = null;
        isReplayingRef.current = false;
        const message =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to fetch job status';
        setApplyError(message);
        setIsApplying(false);
        if (process.env.NODE_ENV !== 'production') {
          console.info('[PatternPoll] stop (error)', { jobId: patternJobId });
        }
        return;
      }

      timer = setTimeout(poll, 1500);
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (activeJobIdRef.current === patternJobId) {
        activeJobIdRef.current = null;
      }
    };
  }, [patternJobId]);

  const handleFormulaCommit = useCallback((data: { row: number; col: number; formula: string }) => {
    if (isReplayingRef.current) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[PatternRecorder] skip formula (replaying)');
      }
      return;
    }
    const targetRow = data.row + 1;
    const targetCol = data.col + 1;
    const a1 = rowColToA1(targetRow, targetCol) ?? 'A1';
    updateAgentSteps((prev) => [
      ...prev,
      {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `step_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        type: 'APPLY_FORMULA',
        target: { row: targetRow, col: targetCol },
        a1,
        formula: data.formula,
        disabled: false,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [updateAgentSteps]);

  const handleHeaderRenameCommit = useCallback(
    (payload: { rowIndex: number; colIndex: number; newValue: string; oldValue: string }) => {
      if (isReplayingRef.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.info('[PatternRecorder] skip header rename (replaying)');
        }
        return;
      }
      if (!shouldRecordHeaderRename(payload.rowIndex)) return;
      if (activeSheetId == null) return;
      updateAgentSteps((prev) => {
        const sheetState = renameDedupRef.current[activeSheetId] ?? {};
        const flat = flattenTimelineItems(prev);
        const result = recordRenameColumnStep(
          flat,
          {
            columnIndex: payload.colIndex,
            newName: payload.newValue,
            oldName: payload.oldValue,
            headerRowIndex: HEADER_ROW_INDEX,
          },
          sheetState,
          createStepId,
          Date.now(),
          RENAME_DEDUP_WINDOW_MS
        );
        renameDedupRef.current[activeSheetId] = result.state;
        return result.steps;
      });
    },
    [activeSheetId, updateAgentSteps]
  );

  const handleHighlightCommit = useCallback(
    (payload: ApplyHighlightParams) => {
      if (isReplayingRef.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.info('[PatternRecorder] skip highlight (replaying)');
        }
        return;
      }
      if (activeSheetId == null) return;
      updateAgentSteps((prev) => [
        ...prev,
        {
          id: createStepId(),
          type: 'APPLY_HIGHLIGHT',
          params: payload,
          disabled: false,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    [activeSheetId, updateAgentSteps]
  );

  const buildPatternStepPayload = (step: PatternStep, index: number) => {
    const seq = index + 1;
    switch (step.type) {
      case 'APPLY_FORMULA':
        return {
          seq,
          type: step.type,
          disabled: step.disabled,
          params: {
            target: step.target,
            a1: step.a1,
            formula: step.formula,
          },
        };
      case 'INSERT_ROW':
        return {
          seq,
          type: step.type,
          disabled: step.disabled,
          params: step.params,
        };
      case 'INSERT_COLUMN':
        return {
          seq,
          type: step.type,
          disabled: step.disabled,
          params: step.params,
        };
      case 'DELETE_COLUMN':
        return {
          seq,
          type: step.type,
          disabled: step.disabled,
          params: step.params,
        };
      case 'FILL_SERIES':
        return {
          seq,
          type: step.type,
          disabled: step.disabled,
          params: step.params,
        };
      case 'SET_COLUMN_NAME':
        return {
          seq,
          type: step.type,
          disabled: step.disabled,
          params: step.params,
        };
      case 'APPLY_HIGHLIGHT':
        return {
          seq,
          type: step.type,
          disabled: step.disabled,
          params: step.params,
        };
      default: {
        const _exhaustive: never = step;
        return _exhaustive;
      }
    }
  };

  const applyPatternStepUpdates = (step: PatternStep, updates: Partial<PatternStep>): PatternStep => {
    switch (step.type) {
      case 'APPLY_FORMULA':
        return { ...step, ...(updates as Partial<typeof step>) };
      case 'INSERT_ROW':
        return { ...step, ...(updates as Partial<typeof step>) };
      case 'INSERT_COLUMN':
        return { ...step, ...(updates as Partial<typeof step>) };
      case 'DELETE_COLUMN':
        return { ...step, ...(updates as Partial<typeof step>) };
      case 'FILL_SERIES':
        return { ...step, ...(updates as Partial<typeof step>) };
      case 'SET_COLUMN_NAME':
        return { ...step, ...(updates as Partial<typeof step>) };
      case 'APPLY_HIGHLIGHT':
        return { ...step, ...(updates as Partial<typeof step>) };
      default: {
        const _exhaustive: never = step;
        return _exhaustive;
      }
    }
  };

  const handleExportPattern = useCallback(
    async (name: string, selectedItems: TimelineItem[]) => {
      if (!spreadsheetId || selectedItems.length === 0) return false;
      const payload: CreatePatternPayload = {
        name,
        description: '',
        origin: {
          spreadsheet_id: Number(spreadsheetId),
          sheet_id: activeSheetId ?? undefined,
        },
        steps: timelineItemsToCreateSteps(selectedItems),
      };

      setExportingPattern(true);
      try {
        const created = await PatternAPI.createPattern(payload);
        toast.success('Pattern saved');
        setPatterns((prev) => [created, ...prev]);
        return true;
      } catch (err: any) {
        console.error('Failed to save pattern:', err);
        const errorMessage =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to save pattern';
        toast.error(errorMessage);
        return false;
      } finally {
        setExportingPattern(false);
      }
    },
    [activeSheetId, spreadsheetId]
  );

  const handleCreateSheet = async (data: CreateSheetRequest) => {
    if (!spreadsheetId) {
      toast.error('Spreadsheet ID is required');
      return;
    }

    setCreating(true);
    try {
      const newSheet = await SpreadsheetAPI.createSheet(Number(spreadsheetId), data);
      toast.success('Sheet created successfully');
      
      // Refresh the sheets list
      const sheetsResponse = await SpreadsheetAPI.listSheets(Number(spreadsheetId));
      const sheetsList = sheetsResponse.results || [];
      setSheets(sheetsList);
      setCreateSheetDefaultName(getNextSheetName(sheetsList));
      
      // Set the new sheet as active
      setActiveSheetId(newSheet.id);
      
      // Close modal
      setCreateSheetModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create sheet:', err);
      const errorMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to create sheet';
      toast.error(errorMessage);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  const handleCreatePivotSheet = useCallback(async (sourceData: {
    cells: Map<string, { rawInput: string; computedString?: string | null }>;
    rowCount: number;
    colCount: number;
  }) => {
    if (!spreadsheetId || !activeSheetId) {
      toast.error('Cannot create pivot table');
      return;
    }

    const sourceSheet = sheets.find((s) => s.id === activeSheetId);
    if (!sourceSheet) return;

    try {
      const sheetName = generatePivotSheetName(sheets.map((s) => s.name));
      const newSheet = await SpreadsheetAPI.createSheet(Number(spreadsheetId), { name: sheetName });

      await SpreadsheetAPI.resizeSheet(Number(spreadsheetId), newSheet.id, 100, 26);

      // Persist initial pivot config on backend (empty definition with source sheet linkage).
      const initialConfig = createEmptyPivotConfig(activeSheetId);
      await SpreadsheetAPI.upsertPivotConfig(Number(spreadsheetId), newSheet.id, {
        sourceSheetId: activeSheetId,
        rows: initialConfig.rows,
        columns: initialConfig.columns,
        values: initialConfig.values,
        showGrandTotalRow: initialConfig.showGrandTotalRow,
      });

      const sheetsResponse = await SpreadsheetAPI.listSheets(Number(spreadsheetId));
      const sheetsList = sheetsResponse.results || [];
      setSheets(sheetsList);
      setCreateSheetDefaultName(getNextSheetName(sheetsList));

      setPivotSourceDataBySheet((prev) => ({
        ...prev,
        [newSheet.id]: {
          ...sourceData,
          sourceSheetId: activeSheetId,
          sourceSheetName: sourceSheet.name,
        },
      }));

      setActiveSheetId(newSheet.id);
      setShowPivotEditor(true);

      toast.success(`Created pivot sheet: ${sheetName}`);
    } catch (err: any) {
      console.error('Failed to create pivot sheet:', err);
      toast.error(err?.message || 'Failed to create pivot sheet');
    }
  }, [spreadsheetId, activeSheetId, sheets]);

  const handlePivotConfigChange = useCallback(
    async (newConfig: PivotConfig) => {
      if (!activeSheetId || !spreadsheetId) return;

      // 1) Update local config immediately so UI reflects changes.
      setPivotConfigsBySheet((prev) => ({
        ...prev,
        [activeSheetId]: newConfig,
      }));

      const pivotMeta = pivotSourceDataBySheet[activeSheetId];
      const sourceSheetId = pivotMeta?.sourceSheetId ?? newConfig.sourceSheetId;
      if (!sourceSheetId || !isPivotConfigValid(newConfig)) return;

      // 2) Instant preview: recompute pivot in the browser using already-loaded source data.
      try {
        // If we don't yet have source cells cached, fetch them once.
        let sourceData = pivotSourceDataBySheet[activeSheetId];
        if (!sourceData) {
          const sourceSheetResponse = await SpreadsheetAPI.readCellRange(
            Number(spreadsheetId),
            sourceSheetId,
            0,
            999,
            0,
            50
          );

          const sourceRowCount =
            sourceSheetResponse.sheet_row_count ?? sourceSheetResponse.row_count;
          const sourceColCount =
            sourceSheetResponse.sheet_column_count ?? sourceSheetResponse.column_count;

          const getCellKey = (row: number, col: number) => `${row}:${col}`;
          const cells = new Map<string, { rawInput: string; computedString?: string | null }>();
          for (const cell of sourceSheetResponse.cells) {
            const key = getCellKey(cell.row_position, cell.column_position);
            cells.set(key, {
              rawInput: cell.raw_input ?? '',
              computedString: cell.computed_string ?? null,
            });
          }

          const sourceSheet = sheets.find((s) => s.id === sourceSheetId);
          sourceData = {
            cells,
            rowCount: sourceRowCount,
            colCount: sourceColCount,
            sourceSheetId,
            sourceSheetName: sourceSheet?.name ?? 'Unknown',
          };
          setPivotSourceDataBySheet((prev) => ({
            ...prev,
            [activeSheetId]: sourceData!,
          }));
        }

        const getCellKey = (row: number, col: number) => `${row}:${col}`;

        const columns: SourceColumn[] = [];
        for (let col = 0; col < sourceData.colCount; col++) {
          const cellData = sourceData.cells.get(getCellKey(0, col));
          const header = (cellData?.rawInput ?? '').trim();
          if (header) {
            columns.push({ index: col, header });
          }
        }

        const sourceRows: SourceRow[] = [];
        for (let row = 1; row < sourceData.rowCount; row++) {
          const rowRecord: SourceRow = {};
          let hasData = false;
          for (let col = 0; col < sourceData.colCount; col++) {
            const cellData = sourceData.cells.get(getCellKey(row, col));
            const value = cellData?.computedString ?? cellData?.rawInput ?? '';
            rowRecord[col] = value;
            if (value.trim()) hasData = true;
          }
          if (hasData) {
            sourceRows.push(rowRecord);
          }
        }

        const pivotResult = buildPivotTable(sourceRows, columns, newConfig);
        const previousDimensions = pivotDimensionsBySheet[activeSheetId] ?? {
          rowCount: 0,
          colCount: 0,
        };

        const setOperations = pivotResultToCellOperations(pivotResult);
        const clearOperations = generateClearOperationsForStaleCells(
          previousDimensions.rowCount,
          previousDimensions.colCount,
          pivotResult.rowCount,
          pivotResult.colCount
        );

        const allOperations: Array<{
          operation: 'set' | 'clear';
          row: number;
          column: number;
          raw_input?: string;
        }> = [...setOperations, ...clearOperations];

        await SpreadsheetAPI.resizeSheet(
          Number(spreadsheetId),
          activeSheetId,
          Math.max(pivotResult.rowCount + 10, previousDimensions.rowCount + 10, 100),
          Math.max(pivotResult.colCount + 5, previousDimensions.colCount + 5, 26)
        );

        await SpreadsheetAPI.batchUpdateCells(
          Number(spreadsheetId),
          activeSheetId,
          allOperations,
          false
        );

        setPivotDimensionsBySheet((prev) => ({
          ...prev,
          [activeSheetId]: {
            rowCount: pivotResult.rowCount,
            colCount: pivotResult.colCount,
          },
        }));

        // 3) Update the grid view immediately.
        gridRef.current?.refresh();
      } catch (err: any) {
        console.error('Failed to update pivot preview:', err);
        toast.error('Failed to update pivot preview');
      }

      // 4) Fire-and-forget: persist config and trigger backend recompute for durability.
      (async () => {
        try {
          await SpreadsheetAPI.upsertPivotConfig(Number(spreadsheetId), activeSheetId, {
            sourceSheetId,
            rows: newConfig.rows,
            columns: newConfig.columns,
            values: newConfig.values,
            showGrandTotalRow: newConfig.showGrandTotalRow,
          });
          await SpreadsheetAPI.recomputePivot(Number(spreadsheetId), activeSheetId);
        } catch (err) {
          // Best-effort; log but don't surface noisy errors to the user.
          console.error('Background pivot persistence/recompute failed:', err);
        }
      })();
    },
    [activeSheetId, spreadsheetId, pivotSourceDataBySheet, pivotDimensionsBySheet, sheets]
  );

  const handleRefreshPivot = useCallback(() => {
    if (!activeSheetId) return;
    const config = pivotConfigsBySheet[activeSheetId];
    if (config) {
      handlePivotConfigChange(config);
    }
  }, [activeSheetId, pivotConfigsBySheet, handlePivotConfigChange]);

  const isPivotSheet = (() => {
    if (!activeSheetId) return false;
    const sheet = sheets.find((s) => s.id === activeSheetId);
    return !!sheet && sheet.kind === 'pivot';
  })();

  const handleRenameSheet = async (sheetId: number, data: UpdateSheetRequest) => {
    if (!spreadsheetId) {
      toast.error('Spreadsheet ID is required');
      return;
    }

    const trimmedName = (data.name ?? '').trim();
    if (!trimmedName) {
      toast.error('Sheet name is required');
      return;
    }

    if (trimmedName.length > 200) {
      toast.error('Sheet name cannot exceed 200 characters');
      return;
    }

    setRenaming(true);
    try {
      const updatedSheet = await SpreadsheetAPI.updateSheet(Number(spreadsheetId), sheetId, {
        name: trimmedName,
      });

      setSheets((prev) =>
        prev.map((sheet) => (sheet.id === sheetId ? { ...sheet, name: updatedSheet.name } : sheet))
      );

      toast.success('Sheet renamed');
      setRenamingSheetId(null);
      setRenameValue('');
    } catch (err: any) {
      console.error('Failed to rename sheet:', err);
      const errorMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to rename sheet';
      toast.error(errorMessage);
    } finally {
      setRenaming(false);
    }
  };

  const beginRenameSheet = (sheet: SheetData) => {
    setRenamingSheetId(sheet.id);
    setRenameValue(sheet.name);
  };

  const cancelRenameSheet = () => {
    setRenamingSheetId(null);
    setRenameValue('');
  };

  const handleRenameSpreadsheet = async () => {
    if (!spreadsheetId) {
      toast.error('Spreadsheet ID is required');
      return;
    }

    const trimmedName = spreadsheetTitleRenameValue.trim();
    if (!trimmedName) {
      toast.error('Spreadsheet name is required');
      return;
    }

    if (trimmedName.length > 200) {
      toast.error('Spreadsheet name cannot exceed 200 characters');
      return;
    }

    setRenamingSpreadsheetSaving(true);
    try {
      const updated = await SpreadsheetAPI.updateSpreadsheet(Number(spreadsheetId), {
        name: trimmedName,
      });
      setSpreadsheet((prev) => (prev ? { ...prev, name: updated.name } : prev));
      toast.success('Spreadsheet renamed');
      setRenamingSpreadsheetTitle(false);
      setSpreadsheetTitleRenameValue('');
    } catch (err: any) {
      console.error('Failed to rename spreadsheet:', err);
      const errorMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to rename spreadsheet';
      toast.error(errorMessage);
    } finally {
      setRenamingSpreadsheetSaving(false);
    }
  };

  const beginRenameSpreadsheetTitle = () => {
    if (renamingSheetId != null) return;
    if (!spreadsheet) return;
    setRenamingSpreadsheetTitle(true);
    setSpreadsheetTitleRenameValue(spreadsheet.name);
  };

  const cancelRenameSpreadsheetTitle = () => {
    setRenamingSpreadsheetTitle(false);
    setSpreadsheetTitleRenameValue('');
  };

  const handleDeleteSheet = useCallback(
    async (sheet: SheetData) => {
      if (!spreadsheetId || !projectId) {
        toast.error('Project or Spreadsheet ID is required');
        return;
      }

      setDeletingSheet(true);
      try {
        await SpreadsheetAPI.deleteSheet(Number(projectId), Number(spreadsheetId), sheet.id);
        toast.success('Sheet deleted');

        const sheetsResponse = await SpreadsheetAPI.listSheets(Number(spreadsheetId));
        const sheetsList = sheetsResponse.results || [];
        setSheets(sheetsList);

        if (!sheetsList.length) {
          setActiveSheetId(null);
        } else if (activeSheetId === sheet.id) {
          const deletedIndex = sheets.findIndex((s) => s.id === sheet.id);
          const nextSheet =
            sheetsList[deletedIndex] ||
            sheetsList[deletedIndex - 1] ||
            sheetsList[0];
          setActiveSheetId(nextSheet.id);
        }
      } catch (err: any) {
        console.error('Failed to delete sheet:', err);
        const errorMessage =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.message ||
          'Delete failed.';
        toast.error(errorMessage);
      } finally {
        setDeletingSheet(false);
        setDeleteConfirmSheet(null);
        setSheetMenuOpenId(null);
      }
    },
    [spreadsheetId, projectId, activeSheetId, sheets]
  );

  useEffect(() => {
    if (sheetMenuOpenId === null) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-sheet-menu]') || target.closest('[data-sheet-menu-trigger]')) {
        return;
      }
      setSheetMenuOpenId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSheetMenuOpenId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sheetMenuOpenId]);

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl px-4 py-10">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <p className="mt-3 font-medium text-gray-900">Loading spreadsheet…</p>
                <p className="text-sm text-gray-600">Fetching spreadsheet details from the backend.</p>
              </div>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl px-4 py-10">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-white p-10 text-center text-red-600">
                <AlertCircle className="h-6 w-6" />
                <p className="mt-3 font-semibold">Could not load spreadsheet</p>
                <p className="text-sm text-red-500">{error}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      setError(null);
                      setLoading(true);
                      const fetchData = async () => {
                        try {
                          const spreadsheetData = await SpreadsheetAPI.getSpreadsheet(Number(spreadsheetId));
                          setSpreadsheet(spreadsheetData);
                          const sheetsResponse = await SpreadsheetAPI.listSheets(Number(spreadsheetId));
                          setSheets(sheetsResponse.results || []);
                        } catch (err: any) {
                          setError(
                            err?.response?.data?.error ||
                              err?.response?.data?.detail ||
                              err?.message ||
                              'Failed to load spreadsheet'
                          );
                        } finally {
                          setLoading(false);
                        }
                      };
                      fetchData();
                    }}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Retry
                  </button>
                  <Link
                    href={`/projects/${projectId}/spreadsheets`}
                    className="rounded-full bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    Back to Spreadsheets
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!spreadsheet) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl px-4 py-10">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-600">
                <FileSpreadsheet className="h-7 w-7 text-gray-400" />
                <p className="mt-3 font-semibold text-gray-900">Spreadsheet not found</p>
                <p className="text-sm text-gray-500">The spreadsheet you're looking for doesn't exist.</p>
                <Link
                  href={`/projects/${projectId}/spreadsheets`}
                  className="mt-4 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Back to Spreadsheets
                </Link>
              </div>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const activeSheet = sheets.find(s => s.id === activeSheetId);

  return (
    <ProtectedRoute>
      <Layout mainScrollMode="container">
        {/* Full viewport height, no page scroll: only the grid container scrolls. */}
        <div className="h-full min-h-0 overflow-hidden bg-white flex flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 bg-white">
            <div className="max-w-7xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/projects/${projectId}/spreadsheets`)}
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-green-50 text-green-700">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    {renamingSpreadsheetTitle ? (
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={spreadsheetTitleRenameValue}
                          onChange={(e) => setSpreadsheetTitleRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleRenameSpreadsheet();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelRenameSpreadsheetTitle();
                            }
                          }}
                          className="h-8 min-w-[12rem] max-w-md flex-1 rounded border border-gray-300 px-2 text-lg font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          disabled={renamingSpreadsheetSaving}
                        />
                        <button
                          type="button"
                          onClick={() => void handleRenameSpreadsheet()}
                          className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          disabled={renamingSpreadsheetSaving}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={cancelRenameSpreadsheetTitle}
                          className="rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          disabled={renamingSpreadsheetSaving}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <h1
                        className="truncate text-lg font-medium text-gray-900 cursor-default select-none"
                        onDoubleClick={beginRenameSpreadsheetTitle}
                        title="Double-click to rename"
                      >
                        {spreadsheet.name}
                      </h1>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sheet Tabs */}
          <div className="border-b border-gray-200 bg-white">
            <div className="max-w-7xl">
              <div className="flex items-center gap-1 overflow-x-auto">
                {sheets.map((sheet) => {
                  const isRenaming = renamingSheetId === sheet.id;
                  const isActive = activeSheetId === sheet.id;
                  const isMenuOpen = sheetMenuOpenId === sheet.id;

                  return (
                    <div
                      key={sheet.id}
                      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        isActive
                          ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (!isRenaming) {
                          setActiveSheetId(sheet.id);
                        }
                      }}
                      onDoubleClick={() => beginRenameSheet(sheet)}
                    >
                      {isRenaming ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleRenameSheet(sheet.id, { name: renameValue });
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelRenameSheet();
                              }
                            }}
                            className="h-7 w-32 rounded border border-gray-300 px-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                            disabled={renaming}
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameSheet(sheet.id, { name: renameValue })}
                            className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            disabled={renaming}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={cancelRenameSheet}
                            className="rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            disabled={renaming}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span>{sheet.name}</span>
                          <div className="relative" data-sheet-menu>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setSheetMenuAnchor({
                                  top: rect.bottom + 6,
                                  left: rect.right,
                                });
                                setSheetMenuOpenId(isMenuOpen ? null : sheet.id);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="ml-1 rounded px-1 text-xs text-gray-500 hover:bg-gray-200"
                              aria-haspopup="menu"
                              aria-expanded={isMenuOpen}
                              title="Sheet actions"
                              data-sheet-menu-trigger
                            >
                              ⋯
                            </button>
                            {isMenuOpen && sheetMenuAnchor &&
                              createPortal(
                                <div
                                  className="fixed z-[1000] w-32 rounded-md border border-gray-200 bg-white shadow-lg"
                                  style={{
                                    top: sheetMenuAnchor.top,
                                    left: sheetMenuAnchor.left - 128,
                                  }}
                                  role="menu"
                                  data-sheet-menu
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setSheetMenuOpenId(null);
                                      setDeleteConfirmSheet(sheet);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                                    role="menuitem"
                                  >
                                    Delete
                                  </button>
                                </div>,
                                document.body
                              )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => {
                    setCreateSheetDefaultName(getNextSheetName(sheets));
                    setCreateSheetModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
                  title="Create new sheet"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Sheet</span>
                </button>
              </div>
            </div>
          </div>

          {/* Spreadsheet Content Area: flex-1 + min-h-0 so it gets bounded height and grid scrolls inside. */}
          <div className="flex-1 min-h-0 overflow-hidden bg-gray-50 flex flex-col">
            {activeSheet ? (
              <div className="flex-1 min-h-0 min-w-0 flex h-full overflow-hidden">
                {/* Center column: grid container. min-w-0 is critical to prevent it from forcing the flex row wider than the viewport. */}
                <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
                  <SpreadsheetGrid
                    ref={gridRef}
                    spreadsheetId={Number(spreadsheetId)}
                    sheetId={activeSheet.id}
                    spreadsheetName={spreadsheet.name}
                    sheetName={activeSheet.name}
                    frozenRowCount={activeSheet.frozen_row_count ?? 0}
                    onFreezeHeaderChange={(val) => {
                      setSheets((prev) =>
                        prev.map((s) =>
                          s.id === activeSheet.id
                            ? { ...s, frozen_row_count: val }
                            : s
                        )
                      );
                    }}
                    onFormulaCommit={handleFormulaCommit}
                    onHeaderRenameCommit={handleHeaderRenameCommit}
                    onHighlightCommit={handleHighlightCommit}
                    onInsertRowCommit={(payload: InsertRowParams) => {
                      updateAgentSteps((prev) => [
                        ...prev,
                        {
                          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
                            ? crypto.randomUUID()
                            : `step_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                          type: 'INSERT_ROW',
                          params: payload,
                          disabled: false,
                          createdAt: new Date().toISOString(),
                        },
                      ]);
                    }}
                    onInsertColumnCommit={(payload: InsertColumnParams) => {
                      updateAgentSteps((prev) => [
                        ...prev,
                        {
                          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
                            ? crypto.randomUUID()
                            : `step_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                          type: 'INSERT_COLUMN',
                          params: payload,
                          disabled: false,
                          createdAt: new Date().toISOString(),
                        },
                      ]);
                    }}
                    onDeleteColumnCommit={(payload: DeleteColumnParams) => {
                      updateAgentSteps((prev) => [
                        ...prev,
                        {
                          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
                            ? crypto.randomUUID()
                            : `step_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                          type: 'DELETE_COLUMN',
                          params: payload,
                          disabled: false,
                          createdAt: new Date().toISOString(),
                        },
                      ]);
                    }}
                    onFillCommit={(payload: FillSeriesParams) => {
                      updateAgentSteps((prev) => [
                        ...prev,
                        {
                          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
                            ? crypto.randomUUID()
                            : `step_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                          type: 'FILL_SERIES',
                          params: payload,
                          disabled: false,
                          createdAt: new Date().toISOString(),
                        },
                      ]);
                    }}
                    highlightCell={highlightCell}
                    onHydrationStatusChange={status => setSheetHydrationReady(status === 'ready')}
                    onOpenPivotBuilder={handleCreatePivotSheet}
                  />
                </div>
                {/* Right column: Show Pivot Editor for pivot sheets, Pattern panel for regular sheets */}
                {isPivotSheet && showPivotEditor ? (
                  <PivotEditorPanel
                    config={pivotConfigsBySheet[activeSheet.id] || createEmptyPivotConfig(pivotSourceDataBySheet[activeSheet.id]?.sourceSheetId || 0)}
                    sourceSheetName={pivotSourceDataBySheet[activeSheet.id]?.sourceSheetName || 'Unknown'}
                    sourceColumns={(() => {
                      const sourceData = pivotSourceDataBySheet[activeSheet.id];
                      if (!sourceData) return [];
                      const cols: SourceColumn[] = [];
                      for (let col = 0; col < sourceData.colCount; col++) {
                        const cellData = sourceData.cells.get(`0:${col}`);
                        const header = (cellData?.rawInput ?? '').trim();
                        if (header) {
                          cols.push({ index: col, header });
                        }
                      }
                      return cols;
                    })()}
                    sourceRowCount={(() => {
                      const sourceData = pivotSourceDataBySheet[activeSheet.id];
                      if (!sourceData) return 0;
                      let count = 0;
                      for (let row = 1; row < sourceData.rowCount; row++) {
                        for (let col = 0; col < sourceData.colCount; col++) {
                          const cellData = sourceData.cells.get(`${row}:${col}`);
                          if ((cellData?.rawInput ?? '').trim()) {
                            count++;
                            break;
                          }
                        }
                      }
                      return count;
                    })()}
                    onConfigChange={handlePivotConfigChange}
                    onClose={() => setShowPivotEditor(false)}
                    onRefresh={handleRefreshPivot}
                  />
                ) : (
                  <PatternAgentPanel
                    items={agentSteps}
                    patterns={patterns}
                    selectedPatternId={selectedPattern?.id ?? null}
                    applySteps={applySteps}
                    applyError={applyError}
                    applyFailedIndex={applyFailedIndex}
                    isApplying={isApplying}
                    exporting={exportingPattern}
                    onReorder={updateAgentSteps}
                    onUpdateStep={(id, updates) =>
                      updateAgentSteps((prev) => updateTimelineItemById(prev, id, updates))
                    }
                    onDeleteStep={(id) =>
                      updateAgentSteps((prev) => deleteTimelineItemById(prev, id))
                    }
                    onMoveStepOutOfGroup={(groupId, step) =>
                      updateAgentSteps((prev) => moveStepOutOfGroup(prev, groupId, step))
                    }
                    onHoverStep={(step) => {
                      if (step.type === 'APPLY_FORMULA') {
                        setHighlightCell({ row: step.target.row - 1, col: step.target.col - 1 });
                      }
                    }}
                    onClearHover={() => setHighlightCell(null)}
                    onExportPattern={handleExportPattern}
                    onSelectPattern={loadPatternDetail}
                    onDeletePattern={handleDeletePattern}
                    onApplyPattern={applyPatternSteps}
                    onRetryApply={applyPatternSteps}
                    disableApplyPattern={!sheetHydrationReady}
                    applyJobStatus={patternJobStatus}
                    applyJobProgress={patternJobProgress}
                    applyJobError={patternJobError}
                  />
                )}
              </div>
            ) : sheets.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white p-12 text-center">
                  <FileSpreadsheet className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-semibold text-gray-900 mb-2">No sheets yet</p>
                  <p className="text-sm text-gray-500 mb-6">Create your first sheet to get started.</p>
                  <button
                    onClick={() => {
                      setCreateSheetDefaultName(getNextSheetName(sheets));
                      setCreateSheetModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    Create Sheet
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Layout>
      <CreateSheetModal
        isOpen={createSheetModalOpen}
        onClose={() => setCreateSheetModalOpen(false)}
        onSubmit={handleCreateSheet}
        loading={creating}
        defaultName={createSheetDefaultName}
      />
      {deleteConfirmSheet && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!deletingSheet) {
              setDeleteConfirmSheet(null);
            }
          }}
        >
          <div className="w-[min(420px,calc(100vw-2rem))]">
            <div className="rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100">
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Delete sheet</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Delete &quot;{deleteConfirmSheet.name}&quot;? This action cannot be undone.
                </p>
              </div>
              <div className="p-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmSheet(null)}
                  className="rounded border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  disabled={deletingSheet}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteConfirmSheet && void handleDeleteSheet(deleteConfirmSheet)}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  disabled={deletingSheet}
                >
                  {deletingSheet ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </ProtectedRoute>
  );
}
