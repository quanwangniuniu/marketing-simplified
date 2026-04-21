'use client';

import { Check, Loader2, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import BrandDialog from '@/components/tasks-v2/detail/BrandDialog';
import {
  getTiktokMaterials,
  uploadTiktokImage,
  uploadTiktokVideo,
  type TiktokMaterialItem,
} from '@/lib/api/tiktokApi';

type Tab = 'video' | 'image';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forceType?: Tab;
  initialPrimary?: TiktokMaterialItem | null;
  initialImages?: TiktokMaterialItem[];
  onConfirm: (payload: { primary: TiktokMaterialItem | null; images: TiktokMaterialItem[] }) => void;
}

const MAX_IMAGES = 35;
const SECTION_CLS =
  'rounded-md bg-white shadow-sm ring-1 ring-gray-100';

export default function MediaLibraryDialog({
  open,
  onOpenChange,
  forceType,
  initialPrimary,
  initialImages,
  onConfirm,
}: Props) {
  const [tab, setTab] = useState<Tab>(forceType ?? 'video');
  const [items, setItems] = useState<TiktokMaterialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [primary, setPrimary] = useState<TiktokMaterialItem | null>(initialPrimary ?? null);
  const [images, setImages] = useState<TiktokMaterialItem[]>(initialImages ?? []);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTab(forceType ?? 'video');
      setPrimary(initialPrimary ?? null);
      setImages(initialImages ?? []);
    }
  }, [open, forceType, initialPrimary, initialImages]);

  const loadMaterials = useCallback(async (type: Tab) => {
    try {
      setLoading(true);
      const response = await getTiktokMaterials({ page: 1, page_size: 60, type });
      setItems(response.results ?? []);
    } catch {
      toast.error('Failed to load media library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadMaterials(tab);
  }, [open, tab, loadMaterials]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      if (tab === 'video') {
        await uploadTiktokVideo(file);
      } else {
        await uploadTiktokImage(file);
      }
      toast.success(`${tab === 'video' ? 'Video' : 'Image'} uploaded`);
      await loadMaterials(tab);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const videoSelected = tab === 'video' ? primary : null;

  const isItemSelected = (item: TiktokMaterialItem) => {
    if (tab === 'video') return primary?.id === item.id;
    return images.some((entry) => entry.id === item.id);
  };

  const toggleItem = (item: TiktokMaterialItem) => {
    if (tab === 'video') {
      if (primary?.id === item.id) {
        setPrimary(null);
      } else {
        setPrimary(item);
        setImages([]);
      }
      return;
    }
    setImages((prev) => {
      if (prev.some((entry) => entry.id === item.id)) {
        return prev.filter((entry) => entry.id !== item.id);
      }
      if (prev.length >= MAX_IMAGES) {
        toast.error(`Up to ${MAX_IMAGES} images allowed`);
        return prev;
      }
      const next = [...prev, item];
      if (primary?.type === 'video') {
        setPrimary(item);
      } else if (!primary) {
        setPrimary(item);
      }
      return next;
    });
  };

  const accept = useMemo(() => (tab === 'video' ? 'video/mp4,video/quicktime' : 'image/*'), [tab]);

  const handleConfirm = () => {
    onConfirm({ primary, images });
    onOpenChange(false);
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Creative library"
      subtitle={
        tab === 'video'
          ? 'Pick a single video to feature as the primary creative.'
          : `Select up to ${MAX_IMAGES} images for a carousel layout.`
      }
      width="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-md bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => !forceType && setTab('video')}
              disabled={!!forceType && forceType !== 'video'}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                tab === 'video'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } disabled:cursor-not-allowed`}
            >
              Videos
            </button>
            <button
              type="button"
              onClick={() => !forceType && setTab('image')}
              disabled={!!forceType && forceType !== 'image'}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                tab === 'image'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } disabled:cursor-not-allowed`}
            >
              Images
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-3 w-3" aria-hidden="true" />
            )}
            Upload {tab === 'video' ? 'video' : 'image'}
          </button>
          <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleUpload} />
        </div>

        <div className={`${SECTION_CLS} max-h-[60vh] overflow-y-auto p-3`}>
          {loading ? (
            <div className="py-10 text-center text-xs text-gray-400">Loading materials…</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-500">
              No {tab}s yet. Upload one from the button above.
            </div>
          ) : (
            <ul className="grid grid-cols-4 gap-2 md:grid-cols-5">
              {items.map((item) => {
                const selected = isItemSelected(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleItem(item)}
                      className={`relative block w-full overflow-hidden rounded-md ring-1 transition ${
                        selected ? 'ring-2 ring-[#3CCED7]' : 'ring-gray-200 hover:ring-gray-300'
                      }`}
                    >
                      {item.type === 'video' ? (
                        <div className="flex aspect-square w-full items-center justify-center bg-gray-900 text-[10px] text-white">
                          <div className="flex flex-col items-center gap-1 p-2 text-center">
                            <span className="text-base">▶</span>
                            <span className="truncate">{item.title || 'Video'}</span>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={item.previewUrl || item.url}
                          alt={item.title ?? ''}
                          className="aspect-square w-full object-cover"
                        />
                      )}
                      {selected && (
                        <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white">
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="text-[11px] text-gray-500">
          {tab === 'video'
            ? videoSelected
              ? '1 video selected'
              : 'Select 1 video'
            : `${images.length} image${images.length === 1 ? '' : 's'} selected (max ${MAX_IMAGES})`}
        </div>
      </div>

      <div className="-mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-95"
        >
          Save selection
        </button>
      </div>
    </BrandDialog>
  );
}
