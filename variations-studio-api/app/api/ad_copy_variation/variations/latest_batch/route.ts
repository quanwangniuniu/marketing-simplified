import { NextResponse } from 'next/server';

import { isAuthFailure, requireAccessUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireProjectForUser } from '@/lib/projects';
import { serializeVariation } from '@/lib/variations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAccessUser(request);
  if (isAuthFailure(auth)) {
    return NextResponse.json({ detail: auth.error }, { status: auth.status });
  }

  const projectParam = new URL(request.url).searchParams.get('project_id');
  const project = await requireProjectForUser(auth.userId, projectParam);
  if (!project.ok) {
    return NextResponse.json({ error: project.error }, { status: project.status });
  }

  const latest = await prisma.adCopyVariation.findFirst({
    where: { projectId: project.projectId, batchId: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  if (!latest?.batchId) {
    return NextResponse.json({ batch_id: null, count: 0, results: [] });
  }

  const rows = await prisma.adCopyVariation.findMany({
    where: { projectId: project.projectId, batchId: latest.batchId },
    orderBy: [{ batchPosition: 'asc' }, { id: 'asc' }],
  });

  return NextResponse.json({
    batch_id: latest.batchId,
    count: rows.length,
    results: rows.map(serializeVariation),
  });
}
