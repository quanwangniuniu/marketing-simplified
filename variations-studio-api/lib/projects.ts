import { prisma } from '@/lib/prisma';

export async function resolveProjectId(raw: string | null): Promise<bigint | null> {
  if (!raw || !raw.trim()) return null;
  const value = raw.trim();
  if (/^\d+$/.test(value)) {
    const project = await prisma.project.findFirst({
      where: { id: BigInt(value), isDeleted: false },
      select: { id: true },
    });
    return project?.id ?? null;
  }
  const project = await prisma.project.findFirst({
    where: { slug: value, isDeleted: false },
    select: { id: true },
  });
  return project?.id ?? null;
}

export async function requireProjectForUser(
  userId: number,
  rawProjectId: string | null
): Promise<
  | { ok: true; projectId: bigint }
  | { ok: false; status: 400 | 403; error: string }
> {
  const projectId = await resolveProjectId(rawProjectId);
  if (!projectId) {
    return { ok: false, status: 400, error: 'project_id is required' };
  }
  const allowed = await isActiveProjectMember(userId, projectId);
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
  userId: number,
  projectId: bigint
): Promise<boolean> {
  const row = await prisma.projectMember.findFirst({
    where: {
      userId: BigInt(userId),
      projectId,
      isActive: true,
      isDeleted: false,
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function activeProjectIdsForUser(userId: number): Promise<bigint[]> {
  const rows = await prisma.projectMember.findMany({
    where: { userId: BigInt(userId), isActive: true, isDeleted: false },
    select: { projectId: true },
  });
  return rows.map((row) => row.projectId);
}

export function toJsonSafe(
  value: bigint | number | string | Date | null | undefined
): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  return value;
}
