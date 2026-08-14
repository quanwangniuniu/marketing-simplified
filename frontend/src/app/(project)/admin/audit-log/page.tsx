'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminAuditLogAPI } from '@/lib/api/auditLogApi';
import type { AdminAuditEvent, PaginatedAdminAuditEvents } from '@/types/audit';
import {
  ShieldCheck,
  UserCog,
  Users,
  FolderOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  'role.created':             'created role',
  'role.updated':             'updated role',
  'role.deleted':             'deleted role',
  'role.permissions_updated': 'updated permissions for',
  'role.permissions_copied':  'copied permissions to',
  'user_role.assigned':       'assigned role to',
  'user_role.removed':        'removed role from',
  'project.updated':          'updated project',
  'project.deleted':          'deleted project',
  'project.labels_updated':   'updated labels for',
  'org.slug_updated':         'updated org slug',
  'org.deleted':              'deleted org',
  'org.admin_assigned':       'assigned org admin',
  'org.admin_removed':        'removed org admin',
};

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All actions' },
  { value: 'role.created', label: 'Role Created' },
  { value: 'role.updated', label: 'Role Updated' },
  { value: 'role.deleted', label: 'Role Deleted' },
  { value: 'role.permissions_updated', label: 'Permissions Updated' },
  { value: 'role.permissions_copied', label: 'Permissions Copied' },
  { value: 'user_role.assigned', label: 'Role Assigned' },
  { value: 'user_role.removed', label: 'Role Removed' },
  { value: 'project.updated', label: 'Project Updated' },
  { value: 'project.deleted', label: 'Project Deleted' },
  { value: 'org.slug_updated', label: 'Org Slug Updated' },
  { value: 'org.deleted', label: 'Org Deleted' },
  { value: 'org.admin_assigned', label: 'Admin Assigned' },
  { value: 'org.admin_removed', label: 'Admin Removed' },
];

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actionIcon(action: string) {
  if (action.startsWith('role.')) return { Icon: UserCog, colors: 'text-purple-500 bg-purple-50' };
  if (action.startsWith('user_role.')) return { Icon: Users, colors: 'text-blue-500 bg-blue-50' };
  if (action.startsWith('project.')) return { Icon: FolderOpen, colors: 'text-teal-500 bg-teal-50' };
  return { Icon: Building2, colors: 'text-amber-500 bg-amber-50' };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Diff View ────────────────────────────────────────────────────────────────

// Fields that are purely technical and add no value for non-technical readers.
const SKIP_FIELDS = new Set([
  'id', 'owner', 'organization', 'org_id', 'user_id',
  'is_deleted', 'created_at', 'updated_at',
  'budget_config', 'kpis', 'audience_targeting',
  'pacing_enabled', 'budget_management_type', 'target_kpi_value',
  'primary_audience_type', 'advertising_platforms',
]);

const KEY_LABEL: Record<string, string> = {
  name:                'Name',
  description:         'Description',
  project_type:        'Project Type',
  objectives:          'Objectives',
  work_model:          'Work Model',
  total_monthly_budget:'Monthly Budget',
  level:               'Permission Level',
  role_name:           'Role',
  role_id:             'Role ID',
  team_id:             'Team',
  valid_from:          'Valid From',
  valid_to:            'Valid To',
  email:               'Email',
  title:               'Label Title',
  topic:               'Topic',
  slug:                'Slug',
  permissions:         'Permissions',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '(none)';
    return value.join(', ');
  }
  if (typeof value === 'object') {
    // Render plain objects as "key: value" pairs on separate lines
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '(empty)';
    return entries.map(([k, v]) => `${k}: ${v ?? '—'}`).join(' · ');
  }
  return String(value);
}

function labelFor(key: string): string {
  return KEY_LABEL[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface ChangeItem {
  key: string;
  before: unknown;
  after: unknown;
}

function getChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): ChangeItem[] {
  const allKeys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const changes: ChangeItem[] = [];
  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key)) continue;
    const bVal = before?.[key] ?? null;
    const aVal = after?.[key]  ?? null;
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changes.push({ key, before: bVal, after: aVal });
    }
  }
  // When nothing changed, surface all visible fields so the user can at least
  // see what was recorded (e.g. permissions_updated with an empty list).
  if (changes.length === 0) {
    const data = after ?? before;
    for (const key of Object.keys(data ?? {})) {
      if (SKIP_FIELDS.has(key)) continue;
      changes.push({ key, before: null, after: data![key] });
    }
  }
  return changes;
}

function DiffView({ before, after, action }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null; action?: string }) {
  if (!before && !after) {
    return <p className="text-xs text-gray-400 italic">No change data recorded.</p>;
  }

  // Special rendering for permissions_copied
  if (action === 'role.permissions_copied') {
    const perms: string[] = (after as any)?.permissions ?? (before as any)?.permissions ?? [];
    return (
      <p className="text-xs text-gray-600 leading-relaxed flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="font-medium text-gray-800 rounded px-1.5 py-0.5 bg-gray-100">Copied Permissions</span>
        <span>:</span>
        {perms.length > 0
          ? perms.map((p: string) => (
              <span key={p} className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">{p}</span>
            ))
          : <span className="text-gray-400 italic">(none)</span>
        }
      </p>
    );
  }

  const changes = getChanges(before, after);

  return (
    <div className="space-y-1.5">
      {changes.map(({ key, before: bVal, after: aVal }) => {
        const label = labelFor(key);
        const hasBefore = before !== null && bVal !== null;
        const hasAfter  = after  !== null && aVal !== null;
        return (
          <p key={key} className="text-xs text-gray-600 leading-relaxed flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {hasBefore && hasAfter ? (
              <>
                <span>Changed <span className="font-medium text-gray-800 rounded px-1.5 py-0.5 bg-gray-100">{label}</span> from</span>
                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600">{formatValue(bVal)}</span>
                <span>to</span>
                <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">{formatValue(aVal)}</span>
              </>
            ) : hasAfter ? (
              <>
                <span>Set <span className="font-medium text-gray-800 rounded px-1.5 py-0.5 bg-gray-100">{label}</span> to</span>
                <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">{formatValue(aVal)}</span>
              </>
            ) : (
              <>
                <span>Removed <span className="font-medium text-gray-800 rounded px-1.5 py-0.5 bg-gray-100">{label}</span></span>
                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600">{formatValue(bVal)}</span>
              </>
            )}
          </p>
        );
      })}
    </div>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

// Actions whose label already tells the full story — no need to expand a diff.
const NO_DIFF_ACTIONS = new Set([
  'role.created',
  'role.deleted',
  'user_role.assigned',
  'user_role.removed',
  'org.admin_assigned',
  'org.admin_removed',
  'project.deleted',
]);

function EventRow({ event }: { event: AdminAuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  const { Icon, colors } = actionIcon(event.action);
  const label = ACTION_LABEL[event.action] ?? event.action;
  const actor = event.actor_name || event.actor_email || 'Unknown';
  const hasDiff = !NO_DIFF_ACTIONS.has(event.action) && (event.before !== null || event.after !== null);

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${hasDiff ? 'cursor-pointer' : ''}`}
        onClick={() => hasDiff && setExpanded(v => !v)}
      >
        <td className="px-4 py-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${colors}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm text-gray-800">
            <span className="font-medium text-gray-900">{actor}</span>{' '}
            {label}
            {event.target_name && (
              <span className="font-medium text-gray-900"> {event.target_name}</span>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{event.action}</p>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
          {formatDateTime(event.timestamp)}
        </td>
        <td className="px-4 py-3 text-center">
          {hasDiff && (
            <span className="text-gray-400">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
          )}
        </td>
      </tr>

      {expanded && hasDiff && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={4} className="px-6 py-4">
            <DiffView before={event.before} after={event.after} action={event.action} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: PAGE_SIZE,
      };
      if (actionFilter) params.action = actionFilter;

      const res = await AdminAuditLogAPI.list(params as any);
      const data = res.data as PaginatedAdminAuditEvents;
      setEvents(data.results ?? []);
      setTotal(data.count ?? 0);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filter changes
  const handleFilterChange = (value: string) => {
    setActionFilter(value);
    setPage(1);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-gray-400" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Admin Action Log</h1>
                <p className="text-sm text-gray-500">Full history of administrative actions</p>
              </div>
            </div>

            {/* Filter */}
            <select
              value={actionFilter}
              onChange={e => handleFilterChange(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30"
            >
              {ACTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-none">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-6 h-6 border-2 border-[#3CCED7] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-48 text-sm text-red-500">{error}</div>
            ) : events.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-gray-400">
                No audit events found.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 w-10" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Time</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => <EventRow key={ev.id} event={ev} />)}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!loading && total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                {total} events · page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
