import { randomUUID } from 'crypto';

import { ApiError, projectIdParam } from '@/lib/bulk';
import {
  creativeToTemplate,
  loadCreativeForProject,
  parseCreativeId,
} from '@/lib/creatives';
import { callGeminiJson, isGeminiQuotaError } from '@/lib/gemini';
import { requireProjectForUser } from '@/lib/projects';
import {
  AI_QUOTA_MESSAGE,
  BATCH_CONCURRENCY,
  MAX_BATCH,
  MODEL_NAME,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildExternalUrlPrompt,
  buildUserPrompt,
  type CopyJson,
} from '@/lib/prompts';
import { allocateSlugs } from '@/lib/slugs';
import { BrowserlessError, fetchUrlText, parseExternalUrl } from '@/lib/urlFetch';
import { insertVariations } from '@/lib/variationStore';
import { serializeVariation } from '@/lib/variations';

const SOURCE_MODES = new Set(['existing', 'custom', 'external_url']);

export type GenerateBatchResponse = {
  batch_id: string;
  count_requested: number;
  count_succeeded: number;
  count_failed: number;
  results: ReturnType<typeof serializeVariation>[];
  failed_indices: number[];
  error?: string;
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
  userPrompt: string,
  count: number
): Promise<{ copies: CopyJson[]; failedIndices: number[]; quotaFailed: boolean }> {
  const ordered: Array<CopyJson | null> = Array.from({ length: count }, () => null);
  const failedIndices: number[] = [];
  let quotaFailed = false;
  let next = 0;

  async function worker() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= count) return;
      try {
        ordered[index] = await callGeminiJson(SYSTEM_PROMPT, userPrompt);
      } catch (err) {
        if (isGeminiQuotaError(err)) quotaFailed = true;
        failedIndices.push(index);
      }
    }
  }

  const workers = Math.min(BATCH_CONCURRENCY, count);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  failedIndices.sort((a, b) => a - b);
  return {
    copies: ordered.filter((row): row is CopyJson => row !== null),
    failedIndices,
    quotaFailed,
  };
}

async function persistBatch(args: {
  schema: string;
  copies: CopyJson[];
  batchId: string;
  projectId: bigint;
  userId: number;
  sourceMode: string;
  sourceRef: string;
  instruction: string;
  creativeId: bigint | null;
}) {
  const slugs = await allocateSlugs(
    args.schema,
    args.copies.map((copy) => copy.headline)
  );
  return insertVariations(
    args.schema,
    args.copies.map((copy, index) => ({
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
    }))
  );
}

export async function runCustomGenerate(args: {
  schema: string;
  userId: number;
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

  const project = await requireProjectForUser(
    args.schema,
    args.userId,
    projectIdParam(args.body.project_id)
  );
  if (!project.ok) {
    throw new ApiError(project.status, project.error, project.field);
  }

  const instruction =
    typeof args.body.instruction === 'string' ? args.body.instruction : '';

  let userPrompt: string;
  let creativeId: bigint | null = null;
  let sourceRef = '';
  if (sourceMode === 'existing') {
    const loaded = await loadCreativeForProject(
      parseCreativeId(args.body.creative_id),
      project.projectId
    );
    creativeId = loaded.id;
    userPrompt = buildUserPrompt(creativeToTemplate(loaded), instruction);
  } else if (sourceMode === 'external_url') {
    sourceRef = parseExternalUrl(args.body.url);
    try {
      userPrompt = buildExternalUrlPrompt(await fetchUrlText(sourceRef), instruction);
    } catch (err) {
      const message =
        err instanceof BrowserlessError
          ? err.message
          : 'Browserless fetch failed';
      return {
        batch_id: randomUUID(),
        count_requested: count,
        count_succeeded: 0,
        count_failed: count,
        results: [],
        failed_indices: Array.from({ length: count }, (_, index) => index),
        error: message,
      };
    }
  } else {
    userPrompt = buildUserPrompt(parseBaseCopy(args.body.base_copy), instruction);
  }

  const batchId = randomUUID();
  const { copies, failedIndices, quotaFailed } = await generateCopies(
    userPrompt,
    count
  );

  const saved = copies.length
    ? await persistBatch({
        schema: args.schema,
        copies,
        batchId,
        projectId: project.projectId,
        userId: args.userId,
        sourceMode,
        sourceRef,
        instruction,
        creativeId,
      })
    : [];

  const payload: GenerateBatchResponse = {
    batch_id: batchId,
    count_requested: count,
    count_succeeded: copies.length,
    count_failed: failedIndices.length,
    results: saved.map(serializeVariation),
    failed_indices: failedIndices,
  };
  if (!copies.length && quotaFailed) {
    payload.error = AI_QUOTA_MESSAGE;
  }
  return payload;
}
