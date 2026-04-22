'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import { ProjectAPI } from '@/lib/api/projectApi';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import toast from 'react-hot-toast';
import StatusChangeSidebar from './StatusChangeSidebar';
import type { StatusOptionForSidebar } from './StatusChangeSidebar';

interface BulkActionBarProps {
  selectedIds: number[];
  selectedTasks: Array<{ id: number; status: string }>;
  onSuccess: () => void;
  projectId?: number;
}

type ActionType = 'submit' | 'assign_approver' | 'change_status' | null;
type StatusOption = {
  value:
    | 'DRAFT'
    | 'APPROVED'
    | 'REJECTED'
    | 'LOCKED'
    | 'UNLOCK'
    | 'CANCELLED';
  label: string;
  disabled: boolean;
  hint: string;
};

const BulkActionBar = ({
  selectedIds,
  selectedTasks,
  onSuccess,
  projectId,
}: BulkActionBarProps) => {
  const [pendingAction, setPendingAction] = useState<ActionType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [approverId, setApproverId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [members, setMembers] = useState<ProjectMemberData[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setHoveredStatus(null);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const allDraft = selectedTasks.every((t) => t.status === 'DRAFT');

  const statusOptions = useMemo((): StatusOption[] => {
    const normalize = (s: string) => s.toUpperCase().trim();
    const statuses = selectedTasks.map((t) => normalize(t.status));

    // DRAFT: requires ALL tasks to be REJECTED or CANCELLED
    const canDraft = statuses.length > 0 && statuses.every((s) =>
      ['REJECTED', 'CANCELLED'].includes(s)
    );

    // APPROVED: requires ALL tasks to be UNDER_REVIEW
    const canApprove = statuses.length > 0 && statuses.every((s) =>
      s === 'UNDER_REVIEW'
    );

    // REJECTED: requires ALL tasks to be UNDER_REVIEW
    const canReject = statuses.length > 0 && statuses.every((s) =>
      s === 'UNDER_REVIEW'
    );

    // LOCKED: requires ALL tasks to be APPROVED
    const canLock = statuses.length > 0 && statuses.every((s) =>
      s === 'APPROVED'
    );

    const canUnlock = statuses.length > 0 && statuses.every((s) => s === 'LOCKED');

    // CANCELLED: requires ALL tasks to be in a cancellable state
    // (matches backend FSM: source=[SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED])
    const canCancel = statuses.length > 0 && statuses.every((s) =>
      ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(s)
    );

    return [
      { value: 'DRAFT',        label: 'Draft',        disabled: !canDraft,       hint: !canDraft       ? 'All tasks must be Rejected or Cancelled' : '' },
      { value: 'APPROVED',     label: 'Approved',     disabled: !canApprove,     hint: !canApprove     ? 'All tasks must be Under Review' : '' },
      { value: 'REJECTED',     label: 'Rejected',     disabled: !canReject,      hint: !canReject      ? 'All tasks must be Under Review' : '' },
      { value: 'LOCKED',       label: 'Locked',       disabled: !canLock,       hint: !canLock        ? 'All tasks must be Approved' : '' },
      { value: 'UNLOCK',      label: 'Unlock',       disabled: !canUnlock,     hint: !canUnlock     ? 'All tasks must be Locked' : '' },
      { value: 'CANCELLED',    label: 'Cancelled',    disabled: !canCancel,     hint: !canCancel      ? 'Only available for Submitted, Under Review, Approved or Rejected tasks' : '' },
    ];
  }, [selectedTasks]);

  const hasAnyValidStatus = statusOptions.some((o) => !o.disabled);
  const uniqueStatuses = [...new Set(
    selectedTasks.map((t) => t.status.toUpperCase().trim())
  )];
  const hasMixedStatuses = uniqueStatuses.length > 1;
  const count = selectedIds.length;

  // Map UI target status to its single-task API call.
  // Backend has no bulk dispatcher endpoint, so each task is dispatched
  // individually via Promise.allSettled and results are aggregated below.
  // Reject path supplies a placeholder comment because the backend serializer
  // requires a non-empty comment when action='reject'.
  const statusToApi: Record<string, (id: number) => Promise<unknown>> = {
    DRAFT:     (id) => TaskAPI.revise(id),
    APPROVED:  (id) => TaskAPI.makeApproval(id, { action: 'approve' }),
    REJECTED:  (id) => TaskAPI.makeApproval(id, { action: 'reject', comment: 'Bulk reject (no comment provided)' }),
    LOCKED:    (id) => TaskAPI.lock(id),
    UNLOCK:    (id) => TaskAPI.unlock(id),
    CANCELLED: (id) => TaskAPI.cancelTask(id),
  };

  const extractErrorMessage = (raw: unknown): string => {
    const err = raw as {
      response?: { data?: { error?: string; detail?: string; [k: string]: unknown } };
      message?: string;
    };
    const data = err?.response?.data;
    if (data?.error) return data.error;
    if (data?.detail) return data.detail;
    if (data && typeof data === 'object') {
      // DRF field-level errors: take the first message we find
      const firstKey = Object.keys(data).find((k) => k !== 'error' && k !== 'detail');
      if (firstKey) {
        const val = data[firstKey];
        if (Array.isArray(val) && val.length > 0) return `${firstKey}: ${val[0]}`;
        if (typeof val === 'string') return `${firstKey}: ${val}`;
      }
    }
    return err?.message || 'Unknown error';
  };

  const handleConfirm = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    if (!pendingAction) { isSubmittingRef.current = false; return; }
    setIsSubmitting(true);
    setProgress(0);

    const intervals: ReturnType<typeof setInterval>[] = [];
    setProgress(25);

    const stage2 = setInterval(() => {
      setProgress((prev) => { if (prev >= 60) { clearInterval(stage2); return prev; } return prev + 3; });
    }, 60);

    const stage3Timer = setTimeout(() => {
      const stage3 = setInterval(() => {
        setProgress((prev) => { if (prev >= 80) { clearInterval(stage3); return prev; } return prev + 1; });
      }, 300);
      intervals.push(stage3);
    }, 800);

    intervals.push(stage2);
    const timeoutIds = [stage3Timer];

    try {
      let dispatch: (id: number) => Promise<unknown>;

      if (pendingAction === 'submit') {
        dispatch = (id) => TaskAPI.submitTask(id);
      } else if (pendingAction === 'assign_approver') {
        const approver = parseInt(approverId, 10);
        if (Number.isNaN(approver)) {
          throw new Error('Approver id is required');
        }
        dispatch = (id) => TaskAPI.updateTask(id, { current_approver_id: approver });
      } else if (pendingAction === 'change_status') {
        const fn = statusToApi[newStatus];
        if (!fn) {
          throw new Error(`Unsupported target status: ${newStatus}`);
        }
        dispatch = fn;
      } else {
        throw new Error(`Unknown action: ${pendingAction}`);
      }

      const settled = await Promise.allSettled(
        selectedIds.map((id) => dispatch(id))
      );

      timeoutIds.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      setProgress(100);

      const succeeded: number[] = [];
      const failed: { task_id: number; reason: string }[] = [];
      settled.forEach((res, idx) => {
        const taskId = selectedIds[idx];
        if (res.status === 'fulfilled') {
          succeeded.push(taskId);
        } else {
          failed.push({
            task_id: taskId,
            reason: extractErrorMessage(res.reason),
          });
        }
      });

      if (succeeded.length > 0) toast.success(`${succeeded.length} task(s) updated successfully`);
      if (failed.length > 0) {
        const reasons = failed.map((f) => `• Task #${f.task_id}: ${f.reason}`).join('\n');
        toast.error(`${failed.length} task(s) failed:\n${reasons}`, { duration: 6000 });
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
      setPendingAction(null);
      setApproverId('');
      setNewStatus('');
      setProgress(0);
      setDropdownOpen(false);
      onSuccess();
    } catch (error: unknown) {
      timeoutIds.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      setProgress(0);
      toast.error(extractErrorMessage(error) || 'Bulk action failed');
    } finally {
      timeoutIds.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const selectedLabel = newStatus ? statusOptions.find((o) => o.value === newStatus)?.label : null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700">
        <span className="text-sm font-medium text-gray-300">{count} task{count > 1 ? 's' : ''} selected</span>
        <div className="w-px h-5 bg-gray-600" />
        <button type="button" onClick={async () => { setPendingAction('assign_approver'); if (projectId && members.length === 0 && !loadingMembers) { try { setLoadingMembers(true); const data = await ProjectAPI.getProjectMembers(projectId); setMembers(data); } catch { toast.error('Failed to load project members'); } finally { setLoadingMembers(false); } } }} className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Assign Approver</button>
        <button type="button" onClick={() => setPendingAction('submit')} disabled={!allDraft} title={!allDraft ? 'Some selected tasks are not in DRAFT status' : ''} className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Submit for Review</button>
        <button
          type="button"
          onClick={() => {
            if (hasMixedStatuses) {
              toast(
                `Tasks have inconsistent statuses: ${uniqueStatuses.map((s) => s.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')).join(', ')}. Only valid transitions will be available.`,
                {
                  duration: 5000,
                  style: {
                    background: '#FEF3C7',
                    color: '#92400E',
                    border: '1px solid #F59E0B',
                    fontWeight: '500',
                  },
                  icon: '⚠️',
                }
              );
            }
            setPendingAction('change_status');
          }}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Change Status
        </button>
        <div className="w-px h-5 bg-gray-600" />
        <button type="button" onClick={onSuccess} className="text-gray-400 hover:text-white transition-colors text-sm">✕ Clear</button>
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">

            {pendingAction === 'submit' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Submit {count} task{count > 1 ? 's' : ''} for review?</h3>
                <p className="text-sm text-gray-500 mb-6">This will change status from <span className="font-medium">Draft → Submitted</span>.</p>
              </>
            )}

            {pendingAction === 'assign_approver' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Assign approver to {count} task{count > 1 ? 's' : ''}</h3>
                <div className="mb-6">
                  <label htmlFor="bulk-approver-id" className="block text-sm font-medium text-gray-700 mb-1">Approver</label>
                  <select id="bulk-approver-id" value={approverId} onChange={(e) => setApproverId(e.target.value)} disabled={loadingMembers || !projectId} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                    <option value="">{loadingMembers ? 'Loading members...' : 'Select approver...'}</option>
                    {members.map((m) => (<option key={m.user.id} value={m.user.id}>{m.user.username ?? m.user.name ?? `User ${m.user.id}`}{m.user.email ? ` (${m.user.email})` : ''}</option>))}
                  </select>
                </div>
              </>
            )}

            {pendingAction === 'change_status' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Change status for {count} task{count > 1 ? 's' : ''}</h3>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                  <div ref={dropdownRef} className="relative">
                    <button type="button" onClick={() => setDropdownOpen((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <span className={selectedLabel ? 'text-gray-900' : 'text-gray-400'}>{selectedLabel ?? 'Select status...'}</span>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 z-[200] bg-white border border-gray-200 rounded-lg shadow-xl flex" style={{ minWidth: '100%' }}>
                        <div className="flex-1 py-1">
                          {statusOptions.map((opt) => (
                            <button key={opt.value} type="button" disabled={opt.disabled} onMouseEnter={() => setHoveredStatus(opt.value)} onMouseLeave={() => setHoveredStatus(null)} onClick={() => { if (!opt.disabled) { setNewStatus(opt.value); setDropdownOpen(false); setHoveredStatus(null); } }} className={`w-full text-left flex flex-col px-3 py-2 ${opt.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-indigo-50 cursor-pointer'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm font-medium ${opt.disabled ? 'text-gray-400' : 'text-gray-900'}`}>{opt.label}</span>
                                <div className="flex items-center gap-1">
                                  {opt.value === 'LOCKED' && opt.disabled && (<span className="text-xs text-gray-300" title="Cannot transition to Locked">🚫</span>)}
                                  {newStatus === opt.value && (<Check className="h-4 w-4 text-indigo-600" />)}
                                </div>
                              </div>
                              {opt.disabled && opt.hint && (<span className="text-xs text-gray-400 mt-0.5 leading-relaxed">{opt.hint}</span>)}
                            </button>
                          ))}
                        </div>
                        <StatusChangeSidebar hoveredOption={hoveredStatus} statusOptions={statusOptions as StatusOptionForSidebar[]} selectedCount={selectedIds.length} />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {isSubmitting && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#1a9ba3]">Processing...</span>
                  <span className="text-xs font-medium text-[#1a9ba3]">{progress}%</span>
                </div>
                <div className="w-full bg-[#3CCED7]/15 rounded-full h-2">
                  <div className="bg-[#3CCED7] h-2 rounded-full transition-all duration-200 ease-out" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setPendingAction(null); setDropdownOpen(false); }} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleConfirm} disabled={isSubmitting || (pendingAction === 'assign_approver' && !approverId) || (pendingAction === 'change_status' && !newStatus)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Processing...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkActionBar;
