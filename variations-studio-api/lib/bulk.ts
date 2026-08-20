import { NextResponse } from 'next/server';

import { isAuthFailure } from '@/lib/auth';
import { requireProjectForUser } from '@/lib/projects';
import { requireStudioContext } from '@/lib/tenant';

export class ApiError extends Error {
  status: number;
  field: 'error' | 'detail';

  constructor(status: number, message: string, field: 'error' | 'detail' = 'error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
  }
}

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export function responseFromUnknown(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ [err.field]: err.message }, { status: err.status });
  }
  throw err;
}

export function projectIdParam(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string') return raw;
  return null;
}

export function parseSelectedIds(
  raw: unknown
): { ok: true; ids: number[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'selected_ids must be a non-empty list' };
  }
  const ids: number[] = [];
  for (const item of raw) {
    let value: number;
    if (typeof item === 'number') {
      value = item;
    } else if (typeof item === 'string' && /^-?\d+$/.test(item.trim())) {
      value = Number(item);
    } else {
      return { ok: false, error: 'selected_ids must contain integers' };
    }
    if (!Number.isInteger(value)) {
      return { ok: false, error: 'selected_ids must contain integers' };
    }
    ids.push(value);
  }
  return { ok: true, ids: [...new Set(ids)] };
}

export async function readJsonBody(
  request: Request
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse }
> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, response: jsonError('Invalid JSON body', 400) };
    }
    return { ok: true, body: body as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body', 400) };
  }
}

export async function startBulkPost(request: Request): Promise<
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      projectId: bigint;
      body: Record<string, unknown>;
      selectedIds: number[];
      selectedBigIds: bigint[];
    }
> {
  const auth = await requireStudioContext(request);
  if (isAuthFailure(auth)) {
    return {
      ok: false,
      response: NextResponse.json({ detail: auth.error }, { status: auth.status }),
    };
  }

  const json = await readJsonBody(request);
  if (!json.ok) return json;

  const project = await requireProjectForUser(
    auth.schema,
    auth.userId,
    projectIdParam(json.body.project_id)
  );
  if (!project.ok) {
    return { ok: false, response: jsonError(project.error, project.status) };
  }

  const selected = parseSelectedIds(json.body.selected_ids);
  if (!selected.ok) {
    return { ok: false, response: jsonError(selected.error, 400) };
  }

  return {
    ok: true,
    projectId: project.projectId,
    body: json.body,
    selectedIds: selected.ids,
    selectedBigIds: selected.ids.map((id) => BigInt(id)),
  };
}
