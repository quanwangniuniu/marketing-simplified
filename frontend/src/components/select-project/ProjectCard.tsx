'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Activity, Trash2, Loader2 } from 'lucide-react';
import type { ProjectData } from '@/lib/api/projectApi';

interface ProjectCardProps {
  project: ProjectData;
  isDefault: boolean;
  onSetDefault: (id: number) => void;
  onSelect: (id: number) => void;
  onDelete: (id: number, name: string) => void;
  deleting?: boolean;
}

const platformColors: Record<string, string> = {
  meta: 'bg-[#3CCED7]',
  google_ads: 'bg-red-500',
  google: 'bg-red-500',
  tiktok: 'bg-gray-900',
  linkedin: 'bg-sky-700',
  snapchat: 'bg-yellow-400',
  twitter: 'bg-sky-400',
  pinterest: 'bg-rose-600',
  programmatic_dsp: 'bg-purple-600',
  reddit: 'bg-orange-500',
  other: 'bg-gray-400',
};

const humanize = (value: string): string =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '—';
  const diff = Date.now() - parsed.getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatBudget(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return `$${(numeric / 1000).toFixed(0)}k/mo`;
}

type KpiEntry = { target?: number | string | null; suggested_by?: string[] };

function summarizeKpis(kpis?: Record<string, KpiEntry> | null): string | null {
  if (!kpis || typeof kpis !== 'object') return null;
  const entries = Object.entries(kpis);
  if (entries.length === 0) return null;
  const [firstKey, firstValue] = entries[0];
  const targetText =
    firstValue && typeof firstValue === 'object' && firstValue.target != null
      ? ` (target ${firstValue.target})`
      : '';
  const suffix = entries.length > 1 ? ` +${entries.length - 1} more` : '';
  return `${firstKey.toUpperCase()}${targetText}${suffix}`;
}

function joinList(values?: string[] | null, limit = 3): string | null {
  if (!values || values.length === 0) return null;
  const shown = values.slice(0, limit).map(humanize).join(', ');
  const rest = values.length - limit;
  return rest > 0 ? `${shown} +${rest}` : shown;
}

export default function ProjectCard({ project, isDefault, onSetDefault, onSelect, onDelete, deleting }: ProjectCardProps) {
  const router = useRouter();
  // `is_active` is a membership / current-default flag (see 01_Projects bible §4.1),
  // not a project lifecycle status. Until a real status field lands, the label
  // distinguishes the user's current default from other available projects.
  const status = project.is_active
    ? { label: 'Current', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : { label: 'Available', className: 'bg-gray-100 text-gray-600 border-gray-200' };

  const platforms = project.advertising_platforms ?? [];
  const budgetLabel = formatBudget(project.total_monthly_budget);
  const memberCount = typeof project.member_count === 'number' ? project.member_count : 0;
  const projectTypeText = joinList(project.project_type);
  const workModelText = joinList(project.work_model);
  const objectivesText = joinList(project.objectives);
  const kpiSummary = summarizeKpis(project.kpis);
  const ownerName = project.owner?.name || project.owner?.email || null;
  const orgName = project.organization?.name || null;

  const metaRows: { label: string; value: string }[] = [];
  if (projectTypeText) metaRows.push({ label: 'Type', value: projectTypeText });
  if (workModelText) metaRows.push({ label: 'Work model', value: workModelText });
  if (objectivesText) metaRows.push({ label: 'Objectives', value: objectivesText });
  if (kpiSummary) metaRows.push({ label: 'KPIs', value: kpiSummary });
  if (project.target_kpi_value) metaRows.push({ label: 'Target', value: project.target_kpi_value });
  if (project.budget_management_type)
    metaRows.push({ label: 'Budget type', value: humanize(project.budget_management_type) });
  if (project.primary_audience_type)
    metaRows.push({ label: 'Audience', value: humanize(project.primary_audience_type) });

  const handleSelect = () => {
    onSelect(project.id);
    router.push('/overview');
  };

  return (
    <Card
      className="group relative cursor-pointer border-[0.5px] border-gray-200 hover:border-[#3CCED7]/40 hover:shadow-md transition-all duration-200 bg-white overflow-hidden"
      onClick={handleSelect}
    >
      <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />

      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-1 gap-2">
          <h3 className="text-base font-medium text-gray-900 group-hover:text-[#3CCED7] transition-colors line-clamp-1">
            {project.name}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={`text-[11px] ${status.className}`}>
              {status.label}
            </Badge>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project.id, project.name);
              }}
              disabled={!!deleting}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100 transition disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label="Delete project"
              title="Delete project"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {(orgName || ownerName) && (
          <p className="text-[12px] text-gray-400 mb-2 line-clamp-1">
            {orgName && <span>{orgName}</span>}
            {orgName && ownerName && <span className="mx-1">·</span>}
            {ownerName && <span>{ownerName}</span>}
          </p>
        )}

        <p className="text-[13px] text-gray-500 leading-5 line-clamp-2 mb-3 min-h-[40px]">
          {project.description || 'No description provided for this project yet.'}
        </p>

        {metaRows.length > 0 && (
          <dl className="mb-3 space-y-1 text-[11px] text-gray-500">
            {metaRows.map((row) => (
              <div key={row.label} className="flex gap-1.5">
                <dt className="text-gray-400 shrink-0">{row.label}:</dt>
                <dd className="text-gray-700 line-clamp-1">{row.value}</dd>
              </div>
            ))}
            {project.pacing_enabled && (
              <div className="flex items-center gap-1.5 text-[#3CCED7]">
                <Activity className="w-3 h-3" />
                <span>Pacing enabled</span>
              </div>
            )}
          </dl>
        )}

        {(platforms.length > 0 || budgetLabel) && (
          <div className="flex items-center gap-1.5 mb-4">
            {platforms.map((p) => (
              <div
                key={p}
                className={`w-5 h-5 rounded-full ${platformColors[p] || 'bg-gray-400'} flex items-center justify-center`}
                title={p}
              >
                <span className="text-white text-[8px] font-bold uppercase">{p[0]}</span>
              </div>
            ))}
            {budgetLabel && (
              <span className="text-[11px] text-gray-400 ml-1">
                {budgetLabel}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3 text-[12px] text-gray-400">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {memberCount}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatRelativeTime(project.updated_at || project.created_at)}
            </span>
          </div>

          <label
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-[#3CCED7] cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isDefault}
              onChange={() => onSetDefault(project.id)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-[#3CCED7] focus:ring-[#3CCED7]/30 accent-[#3CCED7]"
            />
            Default
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
