import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { tenantTable } from '@/lib/tenant';

export const VARIATION_TABLE = 'ad_copy_variation_adcopyvariation';

type SqlClient = {
  $queryRaw: typeof prisma.$queryRaw;
  $executeRaw: typeof prisma.$executeRaw;
};

export type VariationRow = {
  id: bigint;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  sourceMode: string;
  sourceRef: string;
  hook: string;
  headline: string;
  description: string;
  cta: string;
  instruction: string;
  modelName: string;
  promptVersion: string;
  batchId: string | null;
  batchPosition: number | null;
  status: string;
  createdById: bigint | null;
  creativeId: bigint | null;
  projectId: bigint | null;
  slug: string;
};

export type VariationInsert = {
  sourceMode: string;
  sourceRef: string;
  hook: string;
  headline: string;
  description: string;
  cta: string;
  instruction: string;
  modelName: string;
  promptVersion: string;
  batchId: string | null;
  batchPosition: number | null;
  status: string;
  createdById: bigint | null;
  creativeId: bigint | null;
  projectId: bigint | null;
  slug: string;
};

const COLUMNS = Prisma.raw(`
  id,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  is_deleted AS "isDeleted",
  source_mode AS "sourceMode",
  source_ref AS "sourceRef",
  hook,
  headline,
  description,
  cta,
  instruction,
  model_name AS "modelName",
  prompt_version AS "promptVersion",
  batch_id AS "batchId",
  batch_position AS "batchPosition",
  status,
  created_by_id AS "createdById",
  creative_id AS "creativeId",
  project_id AS "projectId",
  slug
`);

function table(schema: string): Prisma.Sql {
  return tenantTable(schema, VARIATION_TABLE);
}

function idList(ids: bigint[]): Prisma.Sql {
  return Prisma.join(ids);
}

export async function findVariationBySlug(
  schema: string,
  slug: string,
  db: SqlClient = prisma
): Promise<VariationRow | null> {
  const value = slug.trim();
  if (!value) return null;
  const rows = await db.$queryRaw<VariationRow[]>`
    SELECT ${COLUMNS} FROM ${table(schema)}
    WHERE slug = ${value}
    LIMIT 1`;
  return rows[0] ?? null;
}

export async function findVariationById(
  schema: string,
  id: bigint,
  db: SqlClient = prisma
): Promise<VariationRow | null> {
  const rows = await db.$queryRaw<VariationRow[]>`
    SELECT ${COLUMNS} FROM ${table(schema)}
    WHERE id = ${id}
    LIMIT 1`;
  return rows[0] ?? null;
}

export async function findVariationsByIds(
  schema: string,
  projectId: bigint,
  ids: bigint[],
  db: SqlClient = prisma
): Promise<VariationRow[]> {
  if (!ids.length) return [];
  return db.$queryRaw<VariationRow[]>`
    SELECT ${COLUMNS} FROM ${table(schema)}
    WHERE project_id = ${projectId} AND id IN (${idList(ids)})`;
}

export async function findVariationsByIdsAnyProject(
  schema: string,
  ids: bigint[],
  db: SqlClient = prisma
): Promise<VariationRow[]> {
  if (!ids.length) return [];
  return db.$queryRaw<VariationRow[]>`
    SELECT ${COLUMNS} FROM ${table(schema)}
    WHERE id IN (${idList(ids)})`;
}

export async function findBatchVariations(
  schema: string,
  projectId: bigint,
  batchId: string,
  db: SqlClient = prisma
): Promise<VariationRow[]> {
  return db.$queryRaw<VariationRow[]>`
    SELECT ${COLUMNS} FROM ${table(schema)}
    WHERE project_id = ${projectId} AND batch_id = ${batchId}::uuid
    ORDER BY batch_position ASC, id ASC`;
}

export async function findLatestBatchRow(
  schema: string,
  projectId: bigint,
  db: SqlClient = prisma
): Promise<VariationRow | null> {
  const rows = await db.$queryRaw<VariationRow[]>`
    SELECT ${COLUMNS} FROM ${table(schema)}
    WHERE project_id = ${projectId} AND batch_id IS NOT NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 1`;
  return rows[0] ?? null;
}

export type VariationListFilter = {
  projectId?: bigint;
  accessibleProjectIds?: bigint[];
  statuses?: string[];
  sourceMode?: string;
  creativeId?: bigint;
  batchId?: string;
};

function listWhere(filter: VariationListFilter): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filter.projectId !== undefined) {
    parts.push(Prisma.sql`project_id = ${filter.projectId}`);
  } else if (filter.accessibleProjectIds) {
    parts.push(
      filter.accessibleProjectIds.length
        ? Prisma.sql`(project_id IN (${idList(filter.accessibleProjectIds)}) OR project_id IS NULL)`
        : Prisma.sql`project_id IS NULL`
    );
  }
  if (filter.statuses?.length) {
    parts.push(Prisma.sql`status IN (${Prisma.join(filter.statuses)})`);
  }
  if (filter.sourceMode) {
    parts.push(Prisma.sql`source_mode = ${filter.sourceMode}`);
  }
  if (filter.creativeId !== undefined) {
    parts.push(Prisma.sql`creative_id = ${filter.creativeId}`);
  }
  if (filter.batchId) {
    parts.push(Prisma.sql`batch_id = ${filter.batchId}::uuid`);
  }
  return Prisma.join(parts, ' AND ');
}

export async function countVariations(
  schema: string,
  filter: VariationListFilter,
  db: SqlClient = prisma
): Promise<number> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM ${table(schema)}
    WHERE ${listWhere(filter)}`;
  return Number(rows[0]?.count ?? 0);
}

export async function listVariations(
  schema: string,
  filter: VariationListFilter,
  page: number,
  pageSize: number,
  db: SqlClient = prisma
): Promise<VariationRow[]> {
  const offset = (page - 1) * pageSize;
  return db.$queryRaw<VariationRow[]>`
    SELECT ${COLUMNS} FROM ${table(schema)}
    WHERE ${listWhere(filter)}
    ORDER BY created_at DESC, id DESC
    OFFSET ${offset} LIMIT ${pageSize}`;
}

export async function insertVariation(
  schema: string,
  row: VariationInsert,
  db: SqlClient = prisma
): Promise<VariationRow> {
  const now = new Date();
  const rows = await db.$queryRaw<VariationRow[]>`
    INSERT INTO ${table(schema)} (
      created_at, updated_at, is_deleted, source_mode, source_ref,
      hook, headline, description, cta, instruction, model_name, prompt_version,
      batch_id, batch_position, status, created_by_id, creative_id, project_id, slug
    ) VALUES (
      ${now}, ${now}, false, ${row.sourceMode}, ${row.sourceRef},
      ${row.hook}, ${row.headline}, ${row.description}, ${row.cta},
      ${row.instruction}, ${row.modelName}, ${row.promptVersion},
      ${row.batchId}::uuid, ${row.batchPosition}, ${row.status},
      ${row.createdById}, ${row.creativeId}, ${row.projectId}, ${row.slug}
    )
    RETURNING ${COLUMNS}`;
  return rows[0];
}

export async function insertVariations(
  schema: string,
  rows: VariationInsert[],
  db: SqlClient = prisma
): Promise<VariationRow[]> {
  const saved: VariationRow[] = [];
  for (const row of rows) {
    saved.push(await insertVariation(schema, row, db));
  }
  return saved;
}

export async function updateVariationFields(
  schema: string,
  id: bigint,
  patch: {
    hook?: string;
    headline?: string;
    description?: string;
    cta?: string;
    status?: string;
  },
  db: SqlClient = prisma
): Promise<VariationRow> {
  const sets: Prisma.Sql[] = [Prisma.sql`updated_at = ${new Date()}`];
  if (patch.hook !== undefined) sets.push(Prisma.sql`hook = ${patch.hook}`);
  if (patch.headline !== undefined) sets.push(Prisma.sql`headline = ${patch.headline}`);
  if (patch.description !== undefined) {
    sets.push(Prisma.sql`description = ${patch.description}`);
  }
  if (patch.cta !== undefined) sets.push(Prisma.sql`cta = ${patch.cta}`);
  if (patch.status !== undefined) sets.push(Prisma.sql`status = ${patch.status}`);

  const rows = await db.$queryRaw<VariationRow[]>`
    UPDATE ${table(schema)}
    SET ${Prisma.join(sets, ', ')}
    WHERE id = ${id}
    RETURNING ${COLUMNS}`;
  return rows[0];
}

export async function deleteVariationById(
  schema: string,
  id: bigint,
  db: SqlClient = prisma
): Promise<void> {
  await db.$executeRaw`DELETE FROM ${table(schema)} WHERE id = ${id}`;
}

export async function deleteVariationsByIds(
  schema: string,
  ids: bigint[],
  db: SqlClient = prisma
): Promise<number> {
  if (!ids.length) return 0;
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    WITH deleted AS (
      DELETE FROM ${table(schema)} WHERE id IN (${idList(ids)})
      RETURNING id
    )
    SELECT COUNT(*)::bigint AS count FROM deleted`;
  return Number(rows[0]?.count ?? 0);
}

export async function deleteVariationsForProjects(
  schema: string,
  projectIds: bigint[],
  db: SqlClient = prisma
): Promise<void> {
  if (!projectIds.length) return;
  await db.$executeRaw`
    DELETE FROM ${table(schema)} WHERE project_id IN (${idList(projectIds)})`;
}

export async function markReviewed(
  schema: string,
  projectId: bigint,
  ids: bigint[],
  db: SqlClient = prisma
): Promise<number> {
  if (!ids.length) return 0;
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    WITH updated AS (
      UPDATE ${table(schema)}
      SET status = 'reviewed', updated_at = ${new Date()}
      WHERE project_id = ${projectId} AND id IN (${idList(ids)})
      RETURNING id
    )
    SELECT COUNT(*)::bigint AS count FROM updated`;
  return Number(rows[0]?.count ?? 0);
}

export async function markBatchReviewed(
  schema: string,
  projectId: bigint,
  batchId: string,
  ids: bigint[],
  db: SqlClient = prisma
): Promise<number> {
  if (!ids.length) return 0;
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    WITH updated AS (
      UPDATE ${table(schema)}
      SET status = 'reviewed', updated_at = ${new Date()}
      WHERE project_id = ${projectId}
        AND batch_id = ${batchId}::uuid
        AND status = 'draft'
        AND id IN (${idList(ids)})
      RETURNING id
    )
    SELECT COUNT(*)::bigint AS count FROM updated`;
  return Number(rows[0]?.count ?? 0);
}

export async function deleteUnselectedBatchDrafts(
  schema: string,
  projectId: bigint,
  batchId: string,
  keepIds: bigint[],
  db: SqlClient = prisma
): Promise<number> {
  const keepClause = keepIds.length
    ? Prisma.sql`AND id NOT IN (${idList(keepIds)})`
    : Prisma.empty;
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    WITH deleted AS (
      DELETE FROM ${table(schema)}
      WHERE project_id = ${projectId}
        AND batch_id = ${batchId}::uuid
        AND status = 'draft'
        ${keepClause}
      RETURNING id
    )
    SELECT COUNT(*)::bigint AS count FROM deleted`;
  return Number(rows[0]?.count ?? 0);
}

export async function listSlugs(
  schema: string,
  db: SqlClient = prisma
): Promise<string[]> {
  const rows = await db.$queryRaw<{ slug: string }[]>`
    SELECT slug FROM ${table(schema)}`;
  return rows.map((row) => row.slug);
}

export async function setVariationStatus(
  schema: string,
  id: bigint,
  status: string,
  db: SqlClient = prisma
): Promise<void> {
  await db.$executeRaw`
    UPDATE ${table(schema)}
    SET status = ${status}, updated_at = ${new Date()}
    WHERE id = ${id}`;
}
