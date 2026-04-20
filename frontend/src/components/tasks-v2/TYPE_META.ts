// Single source of truth for the 11 task types defined in backend bible §3.
// Matches /api/task-types/ exactly. Order is the kanban column order.
export interface TypeMeta {
  value: string;
  label: string;
  shortLabel: string;
  // Donut + column accent color (HSL preferred for legend tinting).
  hex: string;
}

export const TASK_TYPES: TypeMeta[] = [
  { value: 'budget',                  label: 'Budget',                  shortLabel: 'Budget',     hex: '#3CCED7' },
  { value: 'asset',                   label: 'Asset',                   shortLabel: 'Asset',      hex: '#A6E661' },
  { value: 'retrospective',           label: 'Retrospective',           shortLabel: 'Retro',      hex: '#8B5CF6' },
  { value: 'report',                  label: 'Report',                  shortLabel: 'Report',    hex: '#F59E0B' },
  { value: 'execution',               label: 'Execution',               shortLabel: 'Exec',      hex: '#10B981' },
  { value: 'scaling',                 label: 'Scaling',                 shortLabel: 'Scaling',   hex: '#EC4899' },
  { value: 'alert',                   label: 'Alert',                   shortLabel: 'Alert',     hex: '#EF4444' },
  { value: 'experiment',              label: 'Experiment',              shortLabel: 'Exp',       hex: '#6366F1' },
  { value: 'optimization',            label: 'Optimization',            shortLabel: 'Opt',       hex: '#14B8A6' },
  { value: 'communication',           label: 'Client Communication',    shortLabel: 'Comm',      hex: '#F97316' },
  { value: 'platform_policy_update',  label: 'Platform Policy Update',  shortLabel: 'Policy',    hex: '#64748B' },
];

export const STATUS_META: Record<string, { label: string; classes: string }> = {
  DRAFT:        { label: 'Draft',        classes: 'bg-gray-100 text-gray-700' },
  SUBMITTED:    { label: 'Submitted',    classes: 'bg-sky-50 text-sky-700' },
  UNDER_REVIEW: { label: 'In review',    classes: 'bg-amber-50 text-amber-700' },
  APPROVED:     { label: 'Approved',     classes: 'bg-emerald-50 text-emerald-700' },
  REJECTED:     { label: 'Rejected',     classes: 'bg-rose-50 text-rose-700' },
  LOCKED:       { label: 'Locked',       classes: 'bg-violet-50 text-violet-700' },
  CANCELLED:    { label: 'Cancelled',    classes: 'bg-gray-100 text-gray-500 line-through' },
};

export const STATUS_OPTIONS = Object.keys(STATUS_META);

export const PRIORITY_META: Record<string, { label: string; dot: string }> = {
  HIGHEST: { label: 'Highest', dot: 'bg-rose-500' },
  HIGH:    { label: 'High',    dot: 'bg-orange-500' },
  MEDIUM:  { label: 'Medium',  dot: 'bg-amber-400' },
  LOW:     { label: 'Low',     dot: 'bg-sky-400' },
  LOWEST:  { label: 'Lowest',  dot: 'bg-gray-300' },
};

export const PRIORITY_OPTIONS = Object.keys(PRIORITY_META);

export const formatDateShort = (iso?: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};
