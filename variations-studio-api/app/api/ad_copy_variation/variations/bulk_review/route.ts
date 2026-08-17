import { NextResponse } from 'next/server';

import { ApiError, responseFromUnknown, startBulkPost } from '@/lib/bulk';
import { prisma } from '@/lib/prisma';
import { serializeVariation } from '@/lib/variations';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await startBulkPost(request);
  if (!ctx.ok) return ctx.response;

  try {
    const payload = await prisma.$transaction(async (tx) => {
      const rows = await tx.adCopyVariation.findMany({
        where: { projectId: ctx.projectId, id: { in: ctx.selectedBigIds } },
      });
      if (rows.length !== ctx.selectedIds.length) {
        throw new ApiError(400, 'selected_ids must all belong to the current project');
      }
      if (rows.some((row) => row.status !== 'draft')) {
        throw new ApiError(400, 'selected_ids must all be draft rows');
      }

      const updated = await tx.adCopyVariation.updateMany({
        where: { projectId: ctx.projectId, id: { in: ctx.selectedBigIds } },
        data: { status: 'reviewed' },
      });
      const updatedRows = await tx.adCopyVariation.findMany({
        where: { projectId: ctx.projectId, id: { in: ctx.selectedBigIds } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });

      return {
        reviewed_count: updated.count,
        results: updatedRows.map(serializeVariation),
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    return responseFromUnknown(err);
  }
}
