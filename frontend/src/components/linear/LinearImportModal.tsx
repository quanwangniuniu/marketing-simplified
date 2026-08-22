'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiErrorDetail } from '@/lib/api/errorMessage';
import { linearApi, type LinearIssueListItem, type LinearTeam } from '@/lib/api/linearApi';
import { useRouter } from 'next/navigation';
import { useBuildUrl } from '@/lib/buildUrl';

import { Id } from '@/types/common';

interface LinearImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: Id | null;
  onImported?: () => void | Promise<void>;
}

export default function LinearImportModal({
  isOpen,
  onClose,
  projectId,
  onImported,
}: LinearImportModalProps) {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [teamId, setTeamId] = useState<string>('');
  const [issues, setIssues] = useState<LinearIssueListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'teams' | 'issues'>('teams');

  const reset = useCallback(() => {
    setTeams([]);
    setTeamId('');
    setIssues([]);
    setSelected(new Set());
    setStep('teams');
    setConnected(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      reset();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await linearApi.getStatus();
        if (cancelled) return;
        setConnected(s.connected);
        if (!s.connected) return;
        setLoadingTeams(true);
        const { teams: t } = await linearApi.listTeams();
        if (cancelled) return;
        setTeams(t);
        if (t.length === 1) {
          setTeamId(t[0].id);
        }
      } catch (e) {
        if (!cancelled) {
          setConnected(false);
          toast.error(getApiErrorDetail(e, 'Could not load Linear status.'));
        }
      } finally {
        if (!cancelled) setLoadingTeams(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, reset]);

  const loadIssues = async () => {
    if (!teamId) {
      toast.error('Select a Linear team.');
      return;
    }
    setLoadingIssues(true);
    try {
      const { issues: list } = await linearApi.listTeamIssues(teamId);
      setIssues(list);
      setSelected(new Set());
      setStep('issues');
    } catch (e) {
      toast.error(getApiErrorDetail(e, 'Could not load Linear issues.'));
    } finally {
      setLoadingIssues(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runImport = async () => {
    if (!projectId) {
      toast.error('No project selected.');
      return;
    }
    if (!teamId || selected.size === 0) {
      toast.error('Select at least one issue.');
      return;
    }
    setImporting(true);
    try {
      const result = await linearApi.importIssues({
        project_id: projectId,
        team_id: teamId,
        issue_ids: Array.from(selected),
      });
      const n = result.created?.length ?? 0;
      if (n > 0) {
        toast.success(`Imported ${n} task${n === 1 ? '' : 's'} from Linear.`);
      }
      const skipped = result.skipped?.length ?? 0;
      if (skipped > 0) {
        toast(`${skipped} issue(s) skipped (already in project).`, { icon: 'ℹ️' });
      }
      const errN = result.errors?.length ?? 0;
      if (errN > 0) {
        toast.error(`${errN} issue(s) could not be imported.`);
      }
      await onImported?.();
      onClose();
    } catch (e) {
      toast.error(getApiErrorDetail(e, 'Import failed.'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-[#5E6AD2]" />
            Import from Linear
          </DialogTitle>
          <DialogDescription>
            Choose a Linear team and the issues to add as tasks in this project.
          </DialogDescription>
        </DialogHeader>

        {connected === false && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Connect Linear under{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                onClose();
                router.push(buildUrl('/integrations'));
              }}
            >
              Integrations
            </button>
            .
          </div>
        )}

        {connected && step === 'teams' && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-600">Team</label>
            {loadingTeams ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading teams…
              </div>
            ) : teams.length === 0 ? (
              <p className="text-sm text-gray-500">No teams found in your Linear workspace.</p>
            ) : (
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">Select a team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.key ? ` (${t.key})` : ''}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              disabled={!teamId || loadingTeams || loadingIssues}
              onClick={() => void loadIssues()}
              className="w-full rounded-lg bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loadingIssues ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading issues…
                </span>
              ) : (
                'Next: choose issues'
              )}
            </button>
          </div>
        )}

        {connected && step === 'issues' && (
          <div className="space-y-3">
            <button
              type="button"
              className="text-xs font-medium text-[#5E6AD2] hover:underline"
              onClick={() => setStep('teams')}
            >
              ← Change team
            </button>
            <p className="text-xs text-gray-500">
              Showing up to 100 issues. Select one or more to import as tasks (type: Execution).
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-100 p-2">
              {issues.length === 0 ? (
                <p className="text-sm text-gray-500">No issues in this team.</p>
              ) : (
                issues.map((issue) => (
                  <label
                    key={issue.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                      checked={selected.has(issue.id)}
                      onChange={() => toggle(issue.id)}
                    />
                    <span className="min-w-0 text-sm">
                      <span className="font-mono text-xs text-gray-400">
                        {issue.identifier ?? issue.id.slice(0, 8)}
                      </span>{' '}
                      <span className="text-gray-900">{issue.title ?? 'Untitled'}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={importing || selected.size === 0 || !projectId}
              onClick={() => void runImport()}
              className="w-full rounded-lg bg-gradient-to-br from-[#3CCED7] to-[#A6E661] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {importing ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing…
                </span>
              ) : (
                `Import ${selected.size} selected`
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
