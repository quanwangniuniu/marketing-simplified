import { prisma } from '@/lib/prisma';
import { toJsonSafe } from '@/lib/projects';
import type { AdCopyVariation } from '@prisma/client';

export function serializeVariation(row: AdCopyVariation) {
  return {
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
  };
}

export async function findVariationByIdOrSlug(idOrSlug: string) {
  const value = idOrSlug.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    return prisma.adCopyVariation.findFirst({
      where: { id: BigInt(value) },
    });
  }
  return prisma.adCopyVariation.findFirst({
    where: { slug: value },
  });
}
