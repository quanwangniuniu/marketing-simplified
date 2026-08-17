import { randomUUID } from 'crypto';

import { ApiError } from '@/lib/bulk';
import {
  creativeToTemplate,
  loadCreativeForProject,
  parseCreativeId,
} from '@/lib/creatives';
import { callGeminiJson } from '@/lib/gemini';
import { prisma } from '@/lib/prisma';
import {
  MAX_BATCH,
  MODEL_NAME,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildUserPrompt,
  type CopyJson,
} from '@/lib/prompts';
import { allocateSlugs } from '@/lib/slugs';
import { serializeVariation } from '@/lib/variations';

const SOURCE_MODES = new Set(['existing', 'custom', 'external_url']);

export type GenerateBatchResponse = {
  batch_id: string;
  count_requested: number;
  count_succeeded: number;
  count_failed: number;
  results: ReturnType<typeof serializeVariation>[];
  failed_indices: number[];
};

function parseCount(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 1;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) {
    return Number(raw.trim());
  }
  throw new ApiError(400, 'count must be an integer');
}

function parseBaseCopy(raw: unknown): CopyJson {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    hook: typeof obj.hook === 'string' ? obj.hook : '',
    headline: typeof obj.headline === 'string' ? obj.headline : '',
    description: typeof obj.description === 'string' ? obj.description : '',
    cta: typeof obj.cta === 'string' ? obj.cta : '',
  };
}

async function generateCopies(
  baseCopy: CopyJson,
  instruction: string,
  count: number
): Promise<{ copies: CopyJson[]; failedIndices: number[] }> {
  const copies: CopyJson[] = [];
  const failedIndices: number[] = [];
  const outcomes = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      try {
        const copy = await callGeminiJson(
          SYSTEM_PROMPT,
          buildUserPrompt(baseCopy, instruction),
          baseCopy,
          index
        );
        return { index, copy };
      } catch {
        return { index, copy: null };
      }
    })
  );
  outcomes.sort((a, b) => a.index - b.index);
  for (const outcome of outcomes) {
    if (outcome.copy) copies.push(outcome.copy);
    else failedIndices.push(outcome.index);
  }
  return { copies, failedIndices };
}

async function persistBatch(args: {
  copies: CopyJson[];
  batchId: string;
  projectId: bigint;
  userId: number;
  sourceMode: string;
  sourceRef: string;
  instruction: string;
  creativeId: bigint | null;
}) {
  const now = new Date();
  const slugs = await allocateSlugs(args.copies.map((copy) => copy.headline));
  await prisma.adCopyVariation.createMany({
    data: args.copies.map((copy, index) => ({
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      sourceMode: args.sourceMode,
      sourceRef: args.sourceRef,
      hook: copy.hook,
      headline: copy.headline,
      description: copy.description,
      cta: copy.cta,
      instruction: args.instruction,
      modelName: MODEL_NAME,
      promptVersion: PROMPT_VERSION,
      batchId: args.batchId,
      batchPosition: index,
      status: 'draft',
      createdById: BigInt(args.userId),
      creativeId: args.creativeId,
      projectId: args.projectId,
      slug: slugs[index],
    })),
  });
  return prisma.adCopyVariation.findMany({
    where: { projectId: args.projectId, batchId: args.batchId },
    orderBy: [{ batchPosition: 'asc' }, { id: 'asc' }],
  });
}

export async function runCustomGenerate(args: {
  userId: number;
  projectId: bigint;
  body: Record<string, unknown>;
}): Promise<GenerateBatchResponse> {
  const count = parseCount(args.body.count);
  if (count < 1 || count > MAX_BATCH) {
    throw new ApiError(400, `count must be between 1 and ${MAX_BATCH}`);
  }

  const sourceMode = args.body.source_mode;
  if (typeof sourceMode !== 'string' || !SOURCE_MODES.has(sourceMode)) {
    throw new ApiError(400, `unknown source_mode: ${sourceMode}`);
  }
  if (sourceMode === 'external_url') {
    throw new ApiError(400, 'external_url is not implemented yet');
  }

  const instruction =
    typeof args.body.instruction === 'string' ? args.body.instruction : '';

  let baseCopy: CopyJson;
  let creativeId: bigint | null = null;
  if (sourceMode === 'existing') {
    const loaded = await loadCreativeForProject(
      parseCreativeId(args.body.creative_id),
      args.projectId
    );
    creativeId = loaded.id;
    baseCopy = creativeToTemplate(loaded);
  } else {
    baseCopy = parseBaseCopy(args.body.base_copy);
  }

  const batchId = randomUUID();
  const { copies, failedIndices } = await generateCopies(
    baseCopy,
    instruction,
    count
  );

  const saved = copies.length
    ? await persistBatch({
        copies,
        batchId,
        projectId: args.projectId,
        userId: args.userId,
        sourceMode,
        sourceRef: '',
        instruction,
        creativeId,
      })
    : [];

  return {
    batch_id: batchId,
    count_requested: count,
    count_succeeded: copies.length,
    count_failed: failedIndices.length,
    results: saved.map(serializeVariation),
    failed_indices: failedIndices,
  };
}
