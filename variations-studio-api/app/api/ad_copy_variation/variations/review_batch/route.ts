import { NextResponse } from 'next/server';

import { ApiError, jsonError, responseFromUnknown, startBulkPost } from '@/lib/bulk';
import { prisma } from '@/lib/prisma';
import { serializeVariation } from '@/lib/variations';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await startBulkPost(request);
  if (!ctx.ok) return ctx.response;

  const batchId =
    typeof ctx.body.batch_id === 'string' ? ctx.body.batch_id.trim() : '';
  if (!batchId) {
    return jsonError('batch_id is required', 400);
  }

  try {
    const payload = await prisma.$transaction(async (tx) => {
      const selectedRows = await tx.adCopyVariation.findMany({
        where: {
          projectId: ctx.projectId,
          batchId,
          id: { in: ctx.selectedBigIds },
        },
      });
      if (selectedRows.length !== ctx.selectedIds.length) {
        throw new ApiError(
          400,
          'selected_ids must all belong to the current project and batch'
        );
      }
      if (selectedRows.some((row) => row.status !== 'draft')) {
        throw new ApiError(400, 'selected_ids must all be draft rows');
      }

      const reviewed = await tx.adCopyVariation.updateMany({
        where: {
          projectId: ctx.projectId,
          batchId,
          status: 'draft',
          id: { in: ctx.selectedBigIds },
        },
        data: { status: 'reviewed' },
      });
      const deleted = await tx.adCopyVariation.deleteMany({
        where: {
          projectId: ctx.projectId,
          batchId,
          status: 'draft',
          id: { notIn: ctx.selectedBigIds },
        },
      });
      const remaining = await tx.adCopyVariation.findMany({
        where: { projectId: ctx.projectId, batchId },
        orderBy: [{ batchPosition: 'asc' }, { id: 'asc' }],
      });

      return {
        batch_id: batchId,
        reviewed_count: reviewed.count,
        deleted_count: deleted.count,
        results: remaining.map(serializeVariation),
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    return responseFromUnknown(err);
  }
}
