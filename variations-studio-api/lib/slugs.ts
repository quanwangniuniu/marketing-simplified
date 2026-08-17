import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function makeSlug(sourceValue: string, used: Set<string>): string {
  let base = slugify(sourceValue || '');
  if (!base) {
    base = `adcopyvariation-${randomUUID().slice(0, 8)}`;
  } else if (/^\d+$/.test(base)) {
    base = `adcopyvariation-${base}`;
  }
  base = base.slice(0, 200);

  let slug = base;
  let counter = 1;
  while (used.has(slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  used.add(slug);
  return slug;
}

export async function allocateSlugs(headlines: string[]): Promise<string[]> {
  const rows = await prisma.adCopyVariation.findMany({ select: { slug: true } });
  const used = new Set(rows.map((row) => row.slug));
  return headlines.map((headline) => makeSlug(headline, used));
}
