import { NextResponse } from 'next/server';

import { isAuthFailure, requireAccessUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isActiveProjectMember } from '@/lib/projects';
import { findVariationByIdOrSlug, serializeVariation } from '@/lib/variations';

export const dynamic = 'force-dynamic';

const WRITABLE_STRING_FIELDS = ['hook', 'headline', 'description', 'cta'] as const;
const WRITABLE_STATUSES = new Set(['draft', 'reviewed']);

type RouteContext = { params: { id: string } };

async function loadOwnedVariation(request: Request, idOrSlug: string) {
  const auth = await requireAccessUser(request);
  if (isAuthFailure(auth)) {
    return { error: NextResponse.json({ detail: auth.error }, { status: auth.status }) };
  }

  const row = await findVariationByIdOrSlug(idOrSlug);
  if (!row) {
    return { error: NextResponse.json({ detail: 'Not found.' }, { status: 404 }) };
  }

  if (row.projectId) {
    const allowed = await isActiveProjectMember(auth.userId, row.projectId);
    if (!allowed) {
      return {
        error: NextResponse.json(
          { error: 'You are not a member of this project.' },
          { status: 403 }
        ),
      };
    }
  }

  return { auth, row };
}

export async function GET(request: Request, context: RouteContext) {
  const loaded = await loadOwnedVariation(request, context.params.id);
  if ('error' in loaded) return loaded.error;
  return NextResponse.json(serializeVariation(loaded.row));
}

export async function PATCH(request: Request, context: RouteContext) {
  const loaded = await loadOwnedVariation(request, context.params.id);
  if ('error' in loaded) return loaded.error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if ('project' in body) {
    return NextResponse.json(
      { error: 'project cannot be modified' },
      { status: 400 }
    );
  }

  const data: {
    hook?: string;
    headline?: string;
    description?: string;
    cta?: string;
    status?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  for (const field of WRITABLE_STRING_FIELDS) {
    if (field in body) {
      if (typeof body[field] !== 'string') {
        return NextResponse.json(
          { error: `${field} must be a string` },
          { status: 400 }
        );
      }
      data[field] = body[field];
    }
  }

  if ('status' in body) {
    if (typeof body.status !== 'string' || !WRITABLE_STATUSES.has(body.status)) {
      return NextResponse.json(
        { error: 'status must be draft or reviewed' },
        { status: 400 }
      );
    }
    data.status = body.status;
  }

  const updated = await prisma.adCopyVariation.update({
    where: { id: loaded.row.id },
    data,
  });

  return NextResponse.json(serializeVariation(updated));
}
