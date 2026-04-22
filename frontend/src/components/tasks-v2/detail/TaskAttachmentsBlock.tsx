'use client';

import { useEffect, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskAttachment } from '@/types/task';
import AddAttachmentDialog from './AddAttachmentDialog';
import ConfirmDialog from './ConfirmDialog';
import toast from 'react-hot-toast';

const SCAN_TOKEN: Record<TaskAttachment['scan_status'], { label: string; cls: string }> = {
  pending: { label: 'Scanning…', cls: 'bg-amber-50 text-amber-700' },
  scanning: { label: 'Scanning…', cls: 'bg-amber-50 text-amber-700' },
  clean: { label: 'Clean', cls: 'bg-emerald-50 text-emerald-700' },
  infected: { label: 'Infected', cls: 'bg-rose-50 text-rose-700' },
  error_scanning: { label: 'Scan error', cls: 'bg-gray-100 text-gray-500' },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function TaskAttachmentsBlock({
  taskId,
  readOnly,
}: {
  taskId: number;
  readOnly: boolean;
}) {
  const [items, setItems] = useState<TaskAttachment[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    TaskAPI.getAttachments(taskId)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, localKey]);

  const doDownload = async (att: TaskAttachment) => {
    try {
      const data: any = await TaskAPI.downloadAttachment(taskId, att.id);
      const url = data?.download_url || data?.url || att.file;
      if (url) window.open(url, '_blank');
      else toast.error('No download URL returned');
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Download failed');
    }
  };

  const [confirmAtt, setConfirmAtt] = useState<TaskAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    if (!confirmAtt) return;
    setDeleting(true);
    try {
      await TaskAPI.deleteAttachment(taskId, confirmAtt.id);
      setConfirmAtt(null);
      setLocalKey((k) => k + 1);
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Attachments
          {items && items.length > 0 && (
            <span className="ml-2 text-[11px] font-medium normal-case text-gray-400">
              {items.length}
            </span>
          )}
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Upload
          </button>
        )}
      </div>

      {items === null && <p className="text-xs text-gray-400">Loading…</p>}
      {items && items.length === 0 && (
        <p className="text-xs text-gray-400">No attachments yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {items.map((a) => {
            const scan = SCAN_TOKEN[a.scan_status];
            return (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900">{a.original_filename}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {formatSize(a.file_size)} · {a.uploaded_by?.username || 'unknown'}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${scan.cls}`}>
                  {scan.label}
                </span>
                <button
                  type="button"
                  onClick={() => doDownload(a)}
                  title="Download"
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-900"
                  disabled={a.scan_status === 'infected'}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setConfirmAtt(a)}
                    title="Delete"
                    className="rounded p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AddAttachmentDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        taskId={taskId}
        onAdded={() => setLocalKey((k) => k + 1)}
      />

      <ConfirmDialog
        open={confirmAtt !== null}
        onOpenChange={(o) => !o && setConfirmAtt(null)}
        title="Delete attachment"
        description={confirmAtt ? `"${confirmAtt.original_filename}" will be permanently deleted.` : ''}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={doDelete}
      />
    </section>
  );
}
