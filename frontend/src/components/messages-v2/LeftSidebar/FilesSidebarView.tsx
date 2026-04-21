import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FileText, Image as ImageIcon, Film, File, Download } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { listAccessibleChatFiles } from '@/lib/api/attachmentApi';
import type { ChatFileListItem } from '@/types/chat';

function getUploaderLabel(uploader: ChatFileListItem['uploader']): string {
  const fullName = `${uploader.first_name ?? ''} ${uploader.last_name ?? ''}`.trim();
  return fullName || uploader.username || uploader.email;
}

function getChatLabel(row: ChatFileListItem): string {
  if (!row.chat) return 'Unknown chat';
  if (row.chat.type === 'group') return `#${row.chat.name || 'channel'}`;
  return row.chat.name ? `DM • ${row.chat.name}` : 'DM';
}

function getFileIcon(row: ChatFileListItem) {
  if (row.file_type === 'image') return <ImageIcon className="w-4 h-4 text-gray-500" />;
  if (row.file_type === 'video') return <Film className="w-4 h-4 text-gray-500" />;
  if (row.mime_type?.includes('pdf')) return <FileText className="w-4 h-4 text-gray-500" />;
  return <File className="w-4 h-4 text-gray-500" />;
}

export default function FilesSidebarView({ selectedProjectId }: { selectedProjectId: number }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ChatFileListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listAccessibleChatFiles({ projectId: selectedProjectId, page: 1, pageSize: 50 });
        if (!cancelled) setRows(data.results ?? []);
      } catch (err: unknown) {
        if (cancelled) return;
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const data = err.response?.data as any;
          const backendMsg =
            (typeof data?.error === 'string' && data.error) ||
            (typeof data?.detail === 'string' && data.detail) ||
            (typeof data?.message === 'string' && data.message) ||
            null;
          setError(
            backendMsg
              ? `${backendMsg}${status ? ` (HTTP ${status})` : ''}`
              : `Could not load files${status ? ` (HTTP ${status})` : ''}`
          );
          return;
        }
        setError('Could not load files');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3CCED7]" />
        </div>
      );
    }
    if (error) {
      return <div className="p-4 text-sm text-gray-500">{error}</div>;
    }
    if (rows.length === 0) {
      return <div className="p-4 text-sm text-gray-500">No files yet</div>;
    }
    return (
      <div className="divide-y divide-gray-100">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => {
              // Jump to the chat that contains this file (and try to scroll to the specific message).
              if (!row.chat?.id) return;
              const params = new URLSearchParams();
              params.set('projectId', String(selectedProjectId));
              params.set('chatId', String(row.chat.id));
              if (row.message_id) params.set('messageId', String(row.message_id));
              router.push(`/messages-v2?${params.toString()}`);
            }}
            className="w-full text-left px-3 py-2 flex gap-2 hover:bg-gray-50"
          >
            <div className="mt-0.5">{getFileIcon(row)}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {row.original_filename || 'Untitled'}
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500 truncate">
                {getChatLabel(row)} • {getUploaderLabel(row.uploader)} •{' '}
                {row.created_at ? format(new Date(row.created_at), 'PP p') : 'Timestamp unavailable'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={row.file_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                aria-label="Download file"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
              <div className="text-[11px] text-gray-400 whitespace-nowrap">{row.file_size_display}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }, [error, isLoading, rows, router, selectedProjectId]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Files</div>
      <div className="flex-1 overflow-y-auto">{content}</div>
    </div>
  );
}

