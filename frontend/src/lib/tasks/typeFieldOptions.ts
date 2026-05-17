/**
 * Dynamic option loaders referenced by FieldDef.optionsLoader.
 * Hooks can call loadFieldOptions(key, context) and cache the result per page mount.
 */

import api from '@/lib/api';
import type { FieldOption } from './typeFieldSchemas';

export interface LoaderContext {
  projectId?: number | null;
}

type Loader = (ctx?: LoaderContext) => Promise<FieldOption[]>;

const normalize = (rows: any[]): FieldOption[] =>
  (rows || [])
    .filter((r) => r && typeof r === 'object' && r.value != null)
    .map((r) => ({ value: String(r.value), label: String(r.label ?? r.value) }));

let policyChoicesCache: { platforms: FieldOption[]; change_types: FieldOption[] } | null = null;

const loadPolicyChoices = async (
  key: 'platforms' | 'change_types',
): Promise<FieldOption[]> => {
  if (!policyChoicesCache) {
    const res = await api.get('/api/policy/policy-choices/');
    const data = (res?.data ?? {}) as any;
    policyChoicesCache = {
      platforms: normalize(data.platforms ?? []),
      change_types: normalize(data.policy_change_types ?? []),
    };
  }
  return policyChoicesCache[key];
};

const loadProjectMembers = async (ctx?: LoaderContext): Promise<FieldOption[]> => {
  if (!ctx?.projectId) return [];
  const res = await api.get(`/api/core/projects/${ctx.projectId}/members/`);
  const data = res?.data ?? {};
  const members: any[] = Array.isArray(data) ? data : (data.results ?? data.members ?? []);
  return members.map((m: any) => {
    const user = m.user ?? m;
    const name = user.username || user.name || `User ${user.id}`;
    const label = user.email ? `${name} · ${user.email}` : name;
    return { value: String(user.id), label };
  });
};

const loadBudgetPools = async (ctx?: LoaderContext): Promise<FieldOption[]> => {
  const params: Record<string, any> = { page_size: 200 };
  if (ctx?.projectId) params.project_id = ctx.projectId;
  const res = await api.get('/api/budgets/pools/', { params });
  const rows: any[] = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
  return rows.map((p) => {
    const channelName = p.ad_channel_name ?? `Channel ${p.ad_channel}`;
    const available = p.available_amount != null ? Number(p.available_amount).toLocaleString() : '?';
    const namePart = p.name ? ` · ${p.name}` : '';
    const label = `${channelName}${namePart} – ${p.currency} (available: ${available})`;
    // Composite value encodes all three fields needed by the payload builder
    const value = `${p.id}:${p.ad_channel}:${p.currency}`;
    return { value, label };
  });
};

export const OPTION_LOADERS: Record<string, Loader> = {
  'policy.platforms': () => loadPolicyChoices('platforms'),
  'policy.change_types': () => loadPolicyChoices('change_types'),
  'budget.pools': (ctx) => loadBudgetPools(ctx),
  'project.members': (ctx) => loadProjectMembers(ctx),
};

export async function loadFieldOptions(loaderKey: string, ctx?: LoaderContext): Promise<FieldOption[]> {
  const loader = OPTION_LOADERS[loaderKey];
  if (!loader) return [];
  try {
    return await loader(ctx);
  } catch {
    return [];
  }
}
