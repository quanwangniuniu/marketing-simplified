'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MeetingsAPI } from '@/lib/api/meetingsApi';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-300',
  planned: 'bg-blue-100 text-blue-700 border-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  completed: 'bg-green-100 text-green-700 border-green-300',
  archived: 'bg-gray-100 text-gray-500 border-gray-300',
};

interface MeetingLifecyclePanelProps {
  projectId: number;
  meetingId: number;
  /** Called after a successful transition so parent can refresh meeting data. */
  onStatusChanged?: (newStatus: string) => void;
}

export function MeetingLifecyclePanel({
  projectId,
  meetingId,
  onStatusChanged,
}: MeetingLifecyclePanelProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [availableTransitions, setAvailableTransitions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLifecycle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await MeetingsAPI.getLifecycle(projectId, meetingId);
      setStatus(data.status);
      setAvailableTransitions(data.available_transitions);
    } catch {
      setError('Could not load lifecycle state.');
    } finally {
      setLoading(false);
    }
  }, [projectId, meetingId]);

  useEffect(() => {
    void loadLifecycle();
  }, [loadLifecycle]);

  const handleTransition = async (toState: string) => {
    if (transitioning) return;
    setTransitioning(toState);
    setError(null);
    try {
      const data = await MeetingsAPI.executeTransition(projectId, meetingId, toState);
      setStatus(data.status);
      setAvailableTransitions(data.available_transitions);
      onStatusChanged?.(data.status);
      toast.success(`Status updated to ${STATUS_LABELS[data.status] ?? data.status}`);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Transition failed.';
      setError(detail);
      toast.error(detail);
    } finally {
      setTransitioning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        Loading status...
      </div>
    );
  }

  if (error && status === null) {
    return <p className="py-2 text-sm text-red-600">{error}</p>;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Lifecycle status
      </h3>

      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            STATUS_COLORS[status ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-300'
          }`}
        >
          {STATUS_LABELS[status ?? ''] ?? status}
        </Badge>
        {status === 'archived' && (
          <span className="text-xs text-gray-400">Terminal state</span>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      {availableTransitions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-gray-400">Move to:</p>
          <div className="flex flex-wrap gap-2">
            {availableTransitions.map((target) => (
              <Button
                key={target}
                type="button"
                size="sm"
                variant="outline"
                disabled={transitioning !== null}
                onClick={() => void handleTransition(target)}
                className="text-xs"
              >
                {transitioning === target ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : null}
                {STATUS_LABELS[target] ?? target}
              </Button>
            ))}
          </div>
        </div>
      )}

      {availableTransitions.length === 0 && status !== null && (
        <p className="text-xs text-gray-400">No further transitions available.</p>
      )}
    </section>
  );
}