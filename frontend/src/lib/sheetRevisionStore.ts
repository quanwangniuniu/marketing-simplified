const revisions = new Map<string, number>();
export const SHEET_REVISION_CONFLICT_EVENT = 'sheet-revision-conflict';

export function isSheetRevisionConflictResponse(
  status: unknown,
  data: unknown
): boolean {
  if (!data || typeof data !== 'object') return false;
  const payload = data as { code?: unknown; current_revision?: unknown };
  const currentRevision = Number(payload.current_revision);
  const hasCurrentRevision =
    Number.isSafeInteger(currentRevision) && currentRevision >= 0;
  if (!hasCurrentRevision) return false;
  return (
    payload.code === 'SHEET_REVISION_CONFLICT' ||
    status === 409
  );
}

function key(sheetId: number | string): string {
  return String(sheetId);
}

export function getSheetRevision(sheetId: number | string): number | null {
  return revisions.get(key(sheetId)) ?? null;
}

export function setSheetRevision(
  sheetId: number | string,
  revision: unknown
): number | null {
  const parsed = Number(revision);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return getSheetRevision(sheetId);
  const current = getSheetRevision(sheetId);
  if (current == null || parsed > current) {
    revisions.set(key(sheetId), parsed);
    return parsed;
  }
  return current;
}

export function clearSheetRevision(sheetId: number | string): void {
  revisions.delete(key(sheetId));
}

export function withBaseRevision<T extends Record<string, unknown>>(
  sheetId: number | string,
  body: T
): T & { base_revision?: number } {
  const revision = getSheetRevision(sheetId);
  return revision == null ? body : { ...body, base_revision: revision };
}

export function publishSheetRevisionConflict(
  sheetId: number | string,
  currentRevision: unknown
): void {
  const revision = setSheetRevision(sheetId, currentRevision);
  if (revision == null || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SHEET_REVISION_CONFLICT_EVENT, {
      detail: { sheetId: Number(sheetId), revision },
    })
  );
}
