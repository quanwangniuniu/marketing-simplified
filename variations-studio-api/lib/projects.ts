import { prisma } from '@/lib/prisma';
import { tenantTable } from '@/lib/tenant';

// core_project and core_projectmember are tenant-scoped: each org schema holds
// its own copy. Raw SQL keeps the schema explicit; Prisma models would silently
// read `public`.

export async function resolveProjectId(
  schema: string,
  raw: string | null
): Promise<bigint | null> {
  if (!raw || !raw.trim()) return null;
  const value = raw.trim();
  const table = tenantTable(schema, 'core_project');

  const rows = /^\d+$/.test(value)
    ? await prisma.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM ${table}
        WHERE id = ${BigInt(value)} AND is_deleted = false
        LIMIT 1`
    : await prisma.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM ${table}
        WHERE slug = ${value} AND is_deleted = false
        LIMIT 1`;

  return rows[0]?.id ?? null;
}

export async function requireProjectForUser(
  schema: string,
  userId: number,
  rawProjectId: string | null
): Promise<
  | { ok: true; projectId: bigint }
  | { ok: false; status: 400 | 403; error: string }
> {
  const projectId = await resolveProjectId(schema, rawProjectId);
  if (!projectId) {
    return { ok: false, status: 400, error: 'project_id is required' };
  }
  const allowed = await isActiveProjectMember(schema, userId, projectId);
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: 'You are not a member of this project.',
    };
  }
  return { ok: true, projectId };
}

export async function isActiveProjectMember(
  schema: string,
  userId: number,
  projectId: bigint
): Promise<boolean> {
  const table = tenantTable(schema, 'core_projectmember');
  const rows = await prisma.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM ${table}
    WHERE user_id = ${BigInt(userId)}
      AND project_id = ${projectId}
      AND is_active = true
      AND is_deleted = false
    LIMIT 1`;
  return rows.length > 0;
}

export async function activeProjectIdsForUser(
  schema: string,
  userId: number
): Promise<bigint[]> {
  const table = tenantTable(schema, 'core_projectmember');
  const rows = await prisma.$queryRaw<{ project_id: bigint }[]>`
    SELECT project_id FROM ${table}
    WHERE user_id = ${BigInt(userId)}
      AND is_active = true
      AND is_deleted = false`;
  return rows.map((row) => row.project_id);
}

export function toJsonSafe(
  value: bigint | number | string | Date | null | undefined
): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  return value;
}
