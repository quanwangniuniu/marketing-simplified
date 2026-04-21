'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, ChevronRight, Copy, Share2, Trash2 } from 'lucide-react';
import AdVariationStatusPill from '@/components/ad-variations-v2/pills/AdVariationStatusPill';
import CreativeTypeBadge from '@/components/ad-variations-v2/pills/CreativeTypeBadge';
import { AdVariationAPI } from '@/lib/api/adVariationApi';
import type { AdGroup, AdVariation } from '@/types/adVariation';
import { buildUpdatePayload } from './variationPayload';
import FSMActionBar from './FSMActionBar';

interface Props {
  variation: AdVariation;
  adGroup: AdGroup | null;
  campaignId: number;
  onMutated: () => void | Promise<void>;
  onDelete: () => void;
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Share2;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition ${
        danger
          ? 'hover:bg-rose-50 hover:text-rose-600'
          : 'hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export default function VariationDetailHeader({
  variation,
  adGroup,
  campaignId,
  onMutated,
  onDelete,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(variation.name);
  const [saving, setSaving] = useState(false);
  const lastSaved = useRef(variation.name);

  useEffect(() => {
    setValue(variation.name);
    lastSaved.current = variation.name;
  }, [variation.id, variation.name]);

  const commit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === lastSaved.current) {
      if (!trimmed) setValue(lastSaved.current);
      return;
    }
    setSaving(true);
    try {
      await AdVariationAPI.updateVariation(
        campaignId,
        variation.id,
        buildUpdatePayload(variation, { name: trimmed }),
      );
      lastSaved.current = trimmed;
      await onMutated();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Save failed');
      setValue(lastSaved.current);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const copy = await AdVariationAPI.duplicateVariation(campaignId, variation.id);
      toast.success('Variation duplicated');
      router.push(`/variations/${copy.id}?cid=${campaignId}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Duplicate failed');
    }
  };

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-6 py-2">
        <nav className="flex items-center gap-2 text-xs text-gray-500">
          <Link
            href="/variations"
            title="Back to Variations"
            aria-label="Back to Variations"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <Link href="/overview" className="hover:text-gray-900">
            Overview
          </Link>
          <ChevronRight className="h-3 w-3 text-gray-300" />
          <Link href="/variations" className="hover:text-gray-900">
            Variations V2
          </Link>
          <ChevronRight className="h-3 w-3 text-gray-300" />
          <span className="font-semibold text-gray-900">V-{variation.id}</span>
        </nav>
        <div className="flex items-center gap-1">
          <IconBtn icon={Share2} label="Share" onClick={() => toast('Share — coming soon')} />
          <IconBtn icon={Copy} label="Duplicate variation" onClick={handleDuplicate} />
          <IconBtn icon={Trash2} label="Delete variation" danger onClick={onDelete} />
        </div>
      </div>

      <div className="px-6 py-5">
        {saving && <div className="mb-1 text-[11px] text-gray-400">Saving…</div>}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Variation name"
          className="-mx-1 w-[calc(100%+0.5rem)] rounded-md border-0 border-b-2 border-transparent bg-transparent px-1 py-1 text-[22px] font-semibold leading-tight text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-[#3CCED7]"
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <AdVariationStatusPill status={variation.status} />
          <CreativeTypeBadge type={variation.creativeType} />
          {adGroup && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-700">
              {adGroup.name}
            </span>
          )}
          {variation.budget !== null && variation.budget !== undefined && variation.budget !== '' && (
            <span className="text-[11px] text-gray-400">Budget: ${variation.budget}</span>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gray-50/40 px-6 py-3">
        <FSMActionBar variation={variation} campaignId={campaignId} onMutated={onMutated} />
      </div>
    </section>
  );
}
