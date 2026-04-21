'use client';

import { X } from 'lucide-react';
import type { MediaAsset } from '@/types/adVariation';

interface Props {
  label: string;
  accept: string;
  multiple?: boolean;
  assets: MediaAsset[];
  uploading: boolean;
  error: string | null;
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
}

export default function MediaDropZone({
  label,
  accept,
  multiple = false,
  assets,
  uploading,
  error,
  onFiles,
  onRemove,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      {assets.length > 0 && (
        <div className="grid grid-cols-3 gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
          {assets.map((asset, index) => {
            const isVideo = asset.fileType?.startsWith('video');
            return (
              <div key={`${asset.id}-${index}`} className="group relative">
                {isVideo ? (
                  <video
                    src={asset.fileUrl}
                    poster={asset.thumbnailUrl || undefined}
                    className="h-14 w-full rounded-md border border-gray-200 object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div
                    className="h-14 w-full rounded-md border border-gray-200 bg-white bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${asset.thumbnailUrl || asset.fileUrl})`,
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove ${label.toLowerCase()}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <label className="flex cursor-pointer flex-col gap-1 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600 transition hover:border-gray-400 hover:bg-gray-100 focus-within:border-[#3CCED7] focus-within:ring-2 focus-within:ring-[#3CCED7]/30">
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            onFiles(files);
          }}
          className="hidden"
        />
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
        <span>Click to upload</span>
        {uploading && <span className="text-[11px] text-gray-500">Uploading…</span>}
        {error && <span className="text-[11px] text-rose-500">{error}</span>}
      </label>
    </div>
  );
}
