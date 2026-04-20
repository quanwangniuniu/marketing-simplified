/**
 * Dynamic option loaders referenced by FieldDef.optionsLoader.
 * Hooks can call loadFieldOptions(key) and cache the result per page mount.
 */

import api from '@/lib/api';
import type { FieldOption } from './typeFieldSchemas';

type Loader = () => Promise<FieldOption[]>;

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

export const OPTION_LOADERS: Record<string, Loader> = {
  'policy.platforms': () => loadPolicyChoices('platforms'),
  'policy.change_types': () => loadPolicyChoices('change_types'),
};

export async function loadFieldOptions(loaderKey: string): Promise<FieldOption[]> {
  const loader = OPTION_LOADERS[loaderKey];
  if (!loader) return [];
  try {
    return await loader();
  } catch {
    return [];
  }
}
