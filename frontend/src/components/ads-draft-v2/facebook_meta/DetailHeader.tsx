'use client';

import { Share2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AdDraftActionBar, { type ActionSpec } from '../AdDraftActionBar';
import AdDraftStatusPill from '../pills/AdDraftStatusPill';
import PlatformBadge from '../PlatformBadge';
import type { FacebookStatus } from '../types';

const STATUS_LABEL: Record<FacebookStatus, string> = {
  ACTIVE: 'Active',
  IN_PROCESS: 'In process',
  WITH_ISSUES: 'With issues',
  DELETED: 'Deleted',
};

interface Props {
  id: string;
  name: string;
  status: FacebookStatus | string | null;
  onNameCommit: (value: string) => Promise<void> | void;
  onShareClick: () => void;
  onDeleteClick: () => void;
  saving?: boolean;
}

export default function DetailHeader({
  id,
  name,
  status,
  onNameCommit,
  onShareClick,
  onDeleteClick,
  saving,
}: Props) {
  const [draftName, setDraftName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  const commit = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === name) {
      setDraftName(name);
      return;
    }
    if (trimmed.length > 100) {
      setDraftName(name);
      return;
    }
    await onNameCommit(trimmed);
  };

  const actions: ActionSpec[] = [
    { label: 'Share', variant: 'ghost', onClick: onShareClick, icon: Share2 },
    { label: 'Delete', variant: 'danger', onClick: onDeleteClick, icon: Trash2 },
  ];

  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <PlatformBadge platform="facebook_meta" />
            <span className="text-[11px] font-mono text-gray-400">ID {id}</span>
            <AdDraftStatusPill
              platform="facebook_meta"
              status={status ?? undefined}
              statusLabel={
                status ? STATUS_LABEL[status as FacebookStatus] ?? String(status) : undefined
              }
            />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                inputRef.current?.blur();
              } else if (event.key === 'Escape') {
                setDraftName(name);
                inputRef.current?.blur();
              }
            }}
            maxLength={100}
            disabled={saving}
            aria-label="Creative name"
            className="w-full min-w-0 rounded-md bg-transparent px-1 py-1 text-[22px] font-semibold tracking-tight text-gray-900 outline-none transition hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#3CCED7]/30"
          />
        </div>
        <AdDraftActionBar actions={actions} className="shrink-0" />
      </div>
    </section>
  );
}
