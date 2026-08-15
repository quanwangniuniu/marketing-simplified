import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { isAuthFailure, requireAccessUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  activeProjectIdsForUser,
  isActiveProjectMember,
  resolveProjectId,
  toJsonSafe,
} from '@/lib/projects';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const auth = await requireAccessUser(request);
  if (isAuthFailure(auth)) {
    return NextResponse.json({ detail: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const projectParam = url.searchParams.get('project_id');
  const statusParam = url.searchParams.get('status');
  const sourceMode = url.searchParams.get('source_mode');
  const creativeParam = url.searchParams.get('creative');
  const batchId = url.searchParams.get('batch_id');
  const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get('page_size') || DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE)
  );

  const where: Prisma.AdCopyVariationWhereInput = {};

  if (projectParam) {
    const projectId = await resolveProjectId(projectParam);
    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }
    const allowed = await isActiveProjectMember(auth.userId, projectId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You are not a member of this project.' },
        { status: 403 }
      );
    }
    where.projectId = projectId;
  } else {
    const ids = await activeProjectIdsForUser(auth.userId);
    where.OR = [{ projectId: { in: ids } }, { projectId: null }];
  }

  if (statusParam) {
    const statuses = statusParam.split(',').map((item) => item.trim()).filter(Boolean);
    if (statuses.length) where.status = { in: statuses };
  }
  if (sourceMode) where.sourceMode = sourceMode;
  if (creativeParam && /^\d+$/.test(creativeParam)) {
    where.creativeId = BigInt(creativeParam);
  }
  if (batchId) where.batchId = batchId;

  const [count, rows] = await Promise.all([
    prisma.adCopyVariation.count({ where }),
    prisma.adCopyVariation.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    count,
    page,
    page_size: pageSize,
    results: rows.map((row) => ({
      id: toJsonSafe(row.id),
      slug: row.slug,
      project: toJsonSafe(row.projectId),
      creative: toJsonSafe(row.creativeId),
      source_mode: row.sourceMode,
      source_ref: row.sourceRef,
      hook: row.hook,
      headline: row.headline,
      description: row.description,
      cta: row.cta,
      instruction: row.instruction,
      model_name: row.modelName,
      prompt_version: row.promptVersion,
      batch_id: row.batchId,
      batch_position: row.batchPosition,
      status: row.status,
      created_by: toJsonSafe(row.createdById),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    })),
  });
}
