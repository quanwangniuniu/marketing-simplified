'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X, Clock, RotateCcw } from 'lucide-react';
import { NotionDraftAPI } from '@/lib/api/notionDraftApi';
import ConfirmDialog from '@/components/tasks/detail/ConfirmDialog';

interface RevisionItem {
  id: number;
  revision_number: number;
  title: string;
  status: string;
  change_summary: string;
  created_at: string;
  created_by_email?: string | null;
}

interface VersionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  draftId: number | null;
  onRestored: () => void;
}

const formatRelative = (iso: string) => {
  try {
    const d = new Date(iso);
    const delta = Date.now() - d.getTime();
    const minutes = Math.floor(delta / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hr ago`;
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
};

export default function VersionHistoryPanel({
  isOpen,
  onClose,
  draftId,
  onRestored,
}: VersionHistoryPanelProps) {
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRestoreId, setPendingRestoreId] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchRevisions = useCallback(async () => {
    if (!draftId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await NotionDraftAPI.listRevisions(draftId);
      const list: RevisionItem[] = Array.isArray(data?.revisions) ? data.revisions : [];
      setRevisions(list);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load versions.');
      setRevisions([]);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    if (isOpen && draftId) {
      fetchRevisions();
    }
  }, [isOpen, draftId, fetchRevisions]);

  const handleConfirmRestore = useCallback(async () => {
    if (!pendingRestoreId) return;
    setRestoring(true);
    try {
      await NotionDraftAPI.restoreRevision(pendingRestoreId);
      setPendingRestoreId(null);
      onRestored();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to restore version.');
    } finally {
      setRestoring(false);
    }
  }, [pendingRestoreId, onRestored, onClose]);

  const pendingRevision = revisions.find((r) => r.id === pendingRestoreId);

  return (
    <>
      <div
        className={`fixed inset-y-0 right-0 z-40 w-[360px] bg-white border-l border-gray-200 shadow-xl transform transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="h-12 flex items-center justify-between px-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#3CCED7]" />
            <span className="text-sm font-semibold text-gray-900">Version history</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close version history"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-[calc(100%-3rem)] overflow-y-auto p-3 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-md bg-gray-100 animate-pulse" />
            ))
          ) : error ? (
            <div className="p-4 text-sm text-red-600">
              {error}
              <button
                type="button"
                onClick={fetchRevisions}
                className="ml-2 underline text-[#3CCED7] hover:opacity-80"
              >
                Retry
              </button>
            </div>
          ) : revisions.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No versions yet. Save changes to create a version.
            </div>
          ) : (
            revisions.map((rev, idx) => (
              <div
                key={rev.id}
                className="rounded-lg border border-gray-100 px-3 py-2.5 hover:border-[#3CCED7]/30 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-900">
                      Rev {rev.revision_number}
                    </span>
                    {idx === 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#3CCED7]/10 text-[#3CCED7] border border-[#3CCED7]/20">
                        latest
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatRelative(rev.created_at)}
                  </span>
                </div>
                {rev.created_by_email ? (
                  <div className="mt-0.5 text-xs text-gray-500 truncate">
                    by {rev.created_by_email}
                  </div>
                ) : null}
                {rev.change_summary ? (
                  <div className="mt-1 text-xs text-gray-600 italic truncate">
                    &quot;{rev.change_summary}&quot;
                  </div>
                ) : null}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPendingRestoreId(rev.id)}
                    disabled={idx === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#3CCED7] border border-[#3CCED7]/30 rounded-md hover:bg-[#3CCED7]/8 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore this version
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <ConfirmDialog
        open={pendingRestoreId !== null}
        onOpenChange={(next) => {
          if (!next) setPendingRestoreId(null);
        }}
        title={`Restore to Rev ${pendingRevision?.revision_number || ''}?`}
        description="Current content becomes a new revision; you can still navigate back here to undo."
        confirmLabel={restoring ? 'Restoring…' : 'Restore'}
        busy={restoring}
        onConfirm={handleConfirmRestore}
      />
    </>
  );
}
