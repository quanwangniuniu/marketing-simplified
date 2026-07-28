'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import CsmSettingsPageRoot, { CsmSettingsProjectGuard } from '@/components/csm-settings/CsmSettingsPageRoot';
import SettingsHubLink from '@/components/csm-settings/SettingsHubLink';
import { useProjectIdFromUrl } from '@/components/csm-settings/useProjectIdFromUrl';
import { PORTAL_SUBMIT_BUTTON_CLASS } from '@/components/ticket-form/constants';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AutomationRuleModal from '@/components/csm-settings/automation/AutomationRuleModal';
import { AutomationAPI, TRIGGER_EVENTS, type AutomationRule } from '@/lib/api/automationApi';
import { TicketStatusMachineAPI, type TicketStatus } from '@/lib/api/ticketStatusMachineApi';
import CsmAPI from '@/lib/api/csmApi';

const triggerLabel = (value: string) =>
  TRIGGER_EVENTS.find((t) => t.value === value)?.label ?? value;

export default function AutomationPage() {
  const { projectId, projectValid } = useProjectIdFromUrl();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [queues, setQueues] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AutomationRule | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    if (!projectValid) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [ruleList, machine, queueList] = await Promise.all([
        AutomationAPI.listRules(projectId),
        TicketStatusMachineAPI.get(projectId),
        CsmAPI.listProjectQueues(projectId),
      ]);
      setRules(ruleList);
      setStatuses(machine.statuses);
      setQueues(queueList.map((q) => ({ id: q.id, name: q.name })));
    } catch {
      setError('Failed to load automation rules.');
    } finally {
      setLoading(false);
    }
  }, [projectId, projectValid]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = () => {
    setModalOpen(false);
    setEditing(null);
    toast.success(editing ? 'Rule updated.' : 'Rule created.');
    load();
  };

  const toggleActive = async (rule: AutomationRule) => {
    try {
      await AutomationAPI.updateRule(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r)));
    } catch {
      toast.error('Could not update the rule.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await AutomationAPI.deleteRule(confirmDelete.id);
      toast.success('Rule deleted.');
      setConfirmDelete(null);
      load();
    } catch {
      toast.error('Could not delete the rule.');
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <CsmSettingsPageRoot>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Run actions automatically when a ticket event fires and your conditions hold — for example,
            escalate a ticket when its SLA is breached, or tag and route new tickets from a channel.
          </p>
        </div>
        {projectValid && (
          <div className="flex flex-wrap items-center gap-3">
            <SettingsHubLink projectId={projectId} />
            <button
              type="button"
              onClick={() => { setEditing(null); setModalOpen(true); }}
              className={`gap-2 ${PORTAL_SUBMIT_BUTTON_CLASS}`}
            >
              <Plus className="h-4 w-4" aria-hidden />
              New rule
            </button>
          </div>
        )}
      </div>

      {!projectValid ? (
        <CsmSettingsProjectGuard />
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
          <button onClick={load} className="ml-auto rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100">
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <LoadingSpinner />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* ── Rules ─────────────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Rules</h2>
            {rules.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 py-12 text-center">
                <Zap className="h-6 w-6 text-gray-300" aria-hidden />
                <p className="text-sm text-gray-500">No rules yet. Create one to automate ticket handling.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 divide-y divide-gray-100">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center gap-3 bg-white px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{rule.name}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        When {triggerLabel(rule.trigger_event)} · {rule.conditions.length} condition(s) ·{' '}
                        {rule.actions.length} action(s)
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <label className="mr-2 inline-flex cursor-pointer items-center gap-2" title="Active">
                        <input
                          type="checkbox"
                          checked={rule.is_active}
                          onChange={() => toggleActive(rule)}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[#3CCED7] focus:ring-[#3CCED7]"
                        />
                        <span className="text-xs text-gray-500">{rule.is_active ? 'Active' : 'Off'}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => { setEditing(rule); setModalOpen(true); }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(rule)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {projectValid && (
        <AutomationRuleModal
          isOpen={modalOpen}
          projectId={projectId}
          editing={editing}
          statuses={statuses}
          queues={queues}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      <ConfirmModal
        isOpen={confirmDelete !== null}
        type="danger"
        title="Delete rule?"
        message={confirmDelete ? `Delete “${confirmDelete.name}”? This can't be undone.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        loading={confirmBusy}
        onConfirm={handleDelete}
        onClose={() => { if (!confirmBusy) setConfirmDelete(null); }}
      />
    </CsmSettingsPageRoot>
  );
}
