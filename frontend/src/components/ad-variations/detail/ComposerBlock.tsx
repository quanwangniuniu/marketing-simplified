'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { AdVariationAPI } from '@/lib/api/adVariationApi';
import attachmentApi, { validateFile } from '@/lib/api/attachmentApi';
import type { AdVariation, MediaAsset } from '@/types/adVariation';
import { CREATIVE_FIELDS } from '../creativeFields';
import { buildUpdatePayload } from './variationPayload';

interface Props {
  variation: AdVariation;
  campaignId: number;
  onMutated: () => void | Promise<void>;
}

function normalizeAssets(raw: any[]): MediaAsset[] {
  return (raw || []).map((a) => ({
    id: a.id,
    fileUrl: a.fileUrl || a.file_url || '',
    thumbnailUrl: a.thumbnailUrl || a.thumbnail_url || null,
    fileType: a.fileType || a.file_type || '',
  }));
}

export default function ComposerBlock({ variation, campaignId, onMutated }: Props) {
  const fields = CREATIVE_FIELDS[variation.creativeType];
  const initialDrafts = variation.copyElements.reduce<Record<string, string>>((acc, elem) => {
    acc[elem.elementKey] = elem.value;
    return acc;
  }, {});

  const [copyDrafts, setCopyDrafts] = useState<Record<string, string>>(initialDrafts);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const lastSavedCopy = useRef<Record<string, string>>(initialDrafts);

  useEffect(() => {
    const nextDrafts = variation.copyElements.reduce<Record<string, string>>((acc, elem) => {
      acc[elem.elementKey] = elem.value;
      return acc;
    }, {});
    setCopyDrafts(nextDrafts);
    lastSavedCopy.current = nextDrafts;
  }, [variation.id, variation.updatedAt]);

  const mediaAssets = normalizeAssets((variation.formatPayload as any)?.mediaAssets);
  const logoAssets = normalizeAssets((variation.formatPayload as any)?.logoAssets);

  const accepts = variation.creativeType === 'video' ? 'video/*' : 'image/*';
  const multiple =
    variation.creativeType === 'carousel' || variation.creativeType === 'collection';

  const saveCopy = async (key: string) => {
    if (copyDrafts[key] === lastSavedCopy.current[key]) return;
    setSaving(true);
    try {
      await AdVariationAPI.updateVariation(
        campaignId,
        variation.id,
        buildUpdatePayload(variation, {}, copyDrafts),
      );
      lastSavedCopy.current = { ...copyDrafts };
      await onMutated();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Save failed');
      setCopyDrafts(lastSavedCopy.current);
    } finally {
      setSaving(false);
    }
  };

  const updateFormatPayload = async (nextFormat: Record<string, any>) => {
    try {
      await AdVariationAPI.updateVariation(
        campaignId,
        variation.id,
        buildUpdatePayload(variation, {
          formatPayload: { ...(variation.formatPayload || {}), ...nextFormat } as any,
        }),
      );
      await onMutated();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Upload save failed');
    }
  };

  const handleMediaFiles = async (files: File[], kind: 'media' | 'logo') => {
    setUploadError(null);
    if (!files.length) return;
    const invalid = files.find((file) => !validateFile(file).isValid);
    if (invalid) {
      setUploadError('Unsupported file type or size.');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map((file) =>
          attachmentApi.uploadAttachment(file).then((asset) => ({
            id: asset.id,
            fileUrl: asset.file_url,
            thumbnailUrl: asset.thumbnail_url,
            fileType: asset.file_type,
          })),
        ),
      );
      if (kind === 'media') {
        const next = multiple ? [...mediaAssets, ...uploaded] : uploaded;
        await updateFormatPayload({
          mediaAssets: next,
          previewUrl: next[0]?.thumbnailUrl || next[0]?.fileUrl || null,
        });
      } else {
        const next = [...logoAssets, ...uploaded];
        await updateFormatPayload({
          logoAssets: next,
          logoUrl: next[0]?.thumbnailUrl || next[0]?.fileUrl || null,
        });
      }
    } catch {
      setUploadError('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const removeAsset = async (kind: 'media' | 'logo', index: number) => {
    if (kind === 'media') {
      const next = mediaAssets.filter((_, i) => i !== index);
      await updateFormatPayload({
        mediaAssets: next,
        previewUrl: next[0]?.thumbnailUrl || next[0]?.fileUrl || null,
      });
    } else {
      const next = logoAssets.filter((_, i) => i !== index);
      await updateFormatPayload({
        logoAssets: next,
        logoUrl: next[0]?.thumbnailUrl || next[0]?.fileUrl || null,
      });
    }
  };

  const INPUT =
    'w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30';
  const DROP =
    'flex cursor-pointer flex-col gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-600 transition hover:border-gray-400 hover:bg-gray-100 focus-within:border-[#3CCED7] focus-within:ring-2 focus-within:ring-[#3CCED7]/30';

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
            Composer
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">Post copy + media assets</p>
        </div>
        {saving && <span className="text-[11px] text-gray-400">Saving…</span>}
      </div>

      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.key} className="grid grid-cols-[128px_1fr] items-start gap-3 py-1">
            <label className="pt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              {field.label}
            </label>
            {field.multiline ? (
              <textarea
                value={copyDrafts[field.key] || ''}
                onChange={(e) => setCopyDrafts((prev) => ({ ...prev, [field.key]: e.target.value }))}
                onBlur={() => saveCopy(field.key)}
                rows={3}
                className={`${INPUT} resize-y`}
                placeholder={`Enter ${field.label.toLowerCase()}`}
              />
            ) : (
              <input
                type="text"
                value={copyDrafts[field.key] || ''}
                onChange={(e) => setCopyDrafts((prev) => ({ ...prev, [field.key]: e.target.value }))}
                onBlur={() => saveCopy(field.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={INPUT}
                placeholder={`Enter ${field.label.toLowerCase()}`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          {mediaAssets.length > 0 && (
            <div className="grid grid-cols-3 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              {mediaAssets.map((asset, index) => {
                const isVideo = asset.fileType?.startsWith('video');
                return (
                  <div key={`${asset.id}-${index}`} className="group relative">
                    {isVideo ? (
                      <video
                        src={asset.fileUrl}
                        poster={asset.thumbnailUrl || undefined}
                        className="h-16 w-full rounded-md border border-gray-200 object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <div
                        className="h-16 w-full rounded-md border border-gray-200 bg-white bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${asset.thumbnailUrl || asset.fileUrl})`,
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeAsset('media', index)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove media"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <label className={DROP}>
            <input
              type="file"
              accept={accepts}
              multiple={multiple}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                void handleMediaFiles(files, 'media');
              }}
              className="hidden"
            />
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Upload media
            </span>
            <span>Click to upload image or video</span>
            {uploading && <span className="text-[11px] text-gray-500">Uploading…</span>}
            {uploadError && <span className="text-[11px] text-rose-500">{uploadError}</span>}
          </label>
        </div>

        <div className="flex flex-col gap-2">
          {logoAssets.length > 0 && (
            <div className="grid grid-cols-3 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              {logoAssets.map((asset, index) => (
                <div key={`${asset.id}-${index}`} className="group relative">
                  <div
                    className="h-16 w-full rounded-md border border-gray-200 bg-white bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${asset.thumbnailUrl || asset.fileUrl})`,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeAsset('logo', index)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove logo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className={DROP}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                void handleMediaFiles(files, 'logo');
              }}
              className="hidden"
            />
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Upload logo
            </span>
            <span>Click to upload logo image</span>
          </label>
        </div>
      </div>
    </section>
  );
}
