import { PatternStep } from '@/types/patterns';

export const HEADER_ROW_INDEX = 0;
export const RENAME_DEDUP_WINDOW_MS = 1500;

export const shouldRecordHeaderRename = (rowIndex: number) => rowIndex === HEADER_ROW_INDEX;

export type RenameDedupState = Record<string, { stepId: string; timestamp: number }>;

export type RenameColumnRecordInput = {
  columnIndex: number;
  newName: string;
  oldName?: string | null;
  headerRowIndex?: number;
};

const normalizeHeader = (value: string) => value.trim().replace(/\s+/g, ' ');

export const recordRenameColumnStep = (
  steps: PatternStep[],
  input: RenameColumnRecordInput,
  state: RenameDedupState,
  createId: () => string,
  now: number = Date.now(),
  windowMs: number = RENAME_DEDUP_WINDOW_MS
): { steps: PatternStep[]; state: RenameDedupState } => {
  const trimmedNew = normalizeHeader(input.newName);
  const trimmedOld = normalizeHeader(input.oldName ?? '');
  if (!trimmedNew || trimmedNew === trimmedOld) {
    return { steps, state };
  }

  const headerRowIndex = input.headerRowIndex ?? HEADER_ROW_INDEX;
  const columnIndex = input.columnIndex;
  const columnRefIndex = columnIndex + 1;
  const headerRow = headerRowIndex + 1;

  const payload = {
    header_row_index: headerRow,
    from_header: trimmedOld ? trimmedOld : null,
    to_header: trimmedNew,
    column_ref: { index: columnRefIndex },
    column_locator: {
      strategy: 'BY_HEADER_TEXT' as const,
      from_header: trimmedOld ? trimmedOld : null,
      fallback_index: columnRefIndex,
    },
  };

  const dedupKey = `idx:${columnIndex}`;
  const existing = state[dedupKey];
  if (existing && now - existing.timestamp <= windowMs) {
    const index = steps.findIndex(
      (step) => step.id === existing.stepId && step.type === 'SET_COLUMN_NAME'
    );
    if (index >= 0) {
      const nextSteps = [...steps];
      nextSteps[index] = {
        ...nextSteps[index],
        params: payload,
        createdAt: new Date(now).toISOString(),
      } as PatternStep;
      return {
        steps: nextSteps,
        state: { ...state, [dedupKey]: { stepId: existing.stepId, timestamp: now } },
      };
    }
  }

  const stepId = createId();
  const nextSteps = [
    ...steps,
    {
      id: stepId,
      type: 'SET_COLUMN_NAME' as const,
      params: payload,
      disabled: false,
      createdAt: new Date(now).toISOString(),
    },
  ];

  return {
    steps: nextSteps,
    state: { ...state, [dedupKey]: { stepId, timestamp: now } },
  };
};
