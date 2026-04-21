'use client';

import { useState } from 'react';
import { ArchiveRestore, Archive, ChevronDown, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandButton from '../BrandButton';
import type { CampaignTemplate } from '@/types/campaign';

interface Props {
  template: CampaignTemplate;
  onUse: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  busy?: boolean;
}

export default function TemplateActionBar({
  template,
  onUse,
  onArchive,
  onUnarchive,
  onDelete,
  busy = false,
}: Props) {
  const [dangerOpen, setDangerOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <BrandButton size="sm" onClick={onUse} disabled={busy || template.is_archived}>
          <Play className="h-4 w-4" />
          Use Template
        </BrandButton>

        {template.is_archived ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onUnarchive}
            className="gap-2"
          >
            <ArchiveRestore className="h-4 w-4" />
            Unarchive
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onArchive}
            className="gap-2"
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        )}

        <button
          type="button"
          onClick={() => setDangerOpen((v) => !v)}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 transition hover:text-rose-600"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${dangerOpen ? 'rotate-180' : ''}`}
          />
          Danger zone
        </button>
      </div>

      {dangerOpen && (
        <div className="rounded-md border border-rose-200 bg-rose-50/50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-rose-900">
                Permanently delete this template
              </p>
              <p className="mt-0.5 text-xs text-rose-700">
                This action cannot be undone. Consider archiving instead.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onDelete}
              className="border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-800 gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete template
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
