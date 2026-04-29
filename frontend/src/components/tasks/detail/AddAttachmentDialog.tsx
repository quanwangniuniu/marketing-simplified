'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload, FileIcon } from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import BrandDialog from './BrandDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: number;
  onAdded: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AddAttachmentDialog({
  open,
  onOpenChange,
  taskId,
  onAdded,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setDragOver(false);
    }
  }, [open]);

  const upload = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      await TaskAPI.createAttachment(taskId, file);
      onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload attachment"
      subtitle="Drop a file or browse. Virus scan runs automatically."
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${
          dragOver
            ? 'border-[#3CCED7] bg-[#3CCED7]/5'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        }`}
      >
        <Upload className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-700">
          <span className="font-medium">Click to browse</span> or drag and drop a file
        </p>
        <p className="text-[11px] text-gray-400">Single file. Any format.</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />
      </div>

      {file && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
          <FileIcon className="h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-gray-900">{file.name}</p>
            <p className="text-[11px] text-gray-500">{formatSize(file.size)}</p>
          </div>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-rose-600"
            onClick={() => setFile(null)}
          >
            Remove
          </button>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
          className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={upload}
          disabled={submitting || !file}
          className="inline-flex h-9 items-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </BrandDialog>
  );
}
