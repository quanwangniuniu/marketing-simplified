'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import InlineSelect from '@/components/tasks-v2/detail/InlineSelect';
import AdVariationStatusPill from '@/components/ad-variations-v2/pills/AdVariationStatusPill';
import { AdVariationAPI } from '@/lib/api/adVariationApi';
import type { AdGroup, AdVariation } from '@/types/adVariation';
import { buildUpdatePayload } from './variationPayload';

interface Props {
  variation: AdVariation;
  adGroups: AdGroup[];
  campaignId: number;
  onMutated: () => void | Promise<void>;
}

const LABEL = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';
const ROW = 'grid grid-cols-[96px_1fr] items-start gap-3 py-2';
const INPUT =
  'w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30';

const DELIVERY_OPTIONS = ['Active', 'Learning', 'Limited', 'Paused'];
const BID_OPTIONS = ['Lowest Cost', 'Cost Cap', 'Bid Cap', 'ROAS'];
const UNASSIGNED_DELIVERY = '__delivery_none__';
const UNASSIGNED_BID = '__bid_none__';
const UNASSIGNED_AD_SET = '__noadset__';

function TagInput({
  value,
  onCommit,
}: {
  value: string[];
  onCommit: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setDraft('');
      return;
    }
    onCommit([...value, trimmed]);
    setDraft('');
  };

  const remove = (tag: string) => onCommit(value.filter((t) => t !== tag));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => remove(tag)}
            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-900"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onCommit(value.slice(0, -1));
          }
        }}
        onBlur={submit}
        placeholder={value.length ? '' : 'Add tag'}
        className="min-w-[80px] flex-1 bg-transparent text-[12px] text-gray-900 placeholder:text-gray-400 outline-none"
      />
    </div>
  );
}

export default function PropertiesAside({ variation, adGroups, campaignId, onMutated }: Props) {
  const [budgetLocal, setBudgetLocal] = useState(
    variation.budget !== null && variation.budget !== undefined ? String(variation.budget) : '',
  );
  const [notesLocal, setNotesLocal] = useState(variation.notes || '');
  const [saving, setSaving] = useState(false);
  const lastBudget = useRef(budgetLocal);
  const lastNotes = useRef(notesLocal);

  useEffect(() => {
    const next =
      variation.budget !== null && variation.budget !== undefined ? String(variation.budget) : '';
    setBudgetLocal(next);
    lastBudget.current = next;
  }, [variation.id, variation.budget]);

  useEffect(() => {
    const next = variation.notes || '';
    setNotesLocal(next);
    lastNotes.current = next;
  }, [variation.id, variation.notes]);

  const patch = async (data: Partial<AdVariation>) => {
    setSaving(true);
    try {
      await AdVariationAPI.updateVariation(
        campaignId,
        variation.id,
        buildUpdatePayload(variation, data),
      );
      await onMutated();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Properties
        </h3>
        {saving && <span className="text-[11px] text-gray-400">Saving…</span>}
      </div>

      <div className={ROW}>
        <span className={LABEL}>Status</span>
        <div>
          <AdVariationStatusPill status={variation.status} />
        </div>
      </div>

      <div className={ROW}>
        <span className={LABEL}>Delivery</span>
        <InlineSelect
          value={variation.delivery || UNASSIGNED_DELIVERY}
          onValueChange={(v) => patch({ delivery: v === UNASSIGNED_DELIVERY ? null : v })}
          options={[
            { value: UNASSIGNED_DELIVERY, label: 'Unset' },
            ...DELIVERY_OPTIONS.map((x) => ({ value: x, label: x })),
          ]}
          placeholder="Unset"
        />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Bid Strategy</span>
        <InlineSelect
          value={variation.bidStrategy || UNASSIGNED_BID}
          onValueChange={(v) => patch({ bidStrategy: v === UNASSIGNED_BID ? null : v })}
          options={[
            { value: UNASSIGNED_BID, label: 'Unset' },
            ...BID_OPTIONS.map((x) => ({ value: x, label: x })),
          ]}
          placeholder="Unset"
        />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Budget</span>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={budgetLocal}
            onChange={(e) => setBudgetLocal(e.target.value)}
            onBlur={() => {
              if (budgetLocal === lastBudget.current) return;
              lastBudget.current = budgetLocal;
              void patch({ budget: budgetLocal === '' ? null : budgetLocal });
            }}
            className={`${INPUT} pl-5`}
          />
        </div>
      </div>

      <div className={ROW}>
        <span className={LABEL}>Ad Set</span>
        <InlineSelect
          value={variation.adGroupId ? String(variation.adGroupId) : UNASSIGNED_AD_SET}
          onValueChange={(v) =>
            patch({ adGroupId: v === UNASSIGNED_AD_SET ? null : Number(v) })
          }
          options={[
            { value: UNASSIGNED_AD_SET, label: 'No ad set' },
            ...adGroups.map((g) => ({ value: String(g.id), label: g.name })),
          ]}
          placeholder="No ad set"
        />
      </div>

      <div className="my-2 border-t border-gray-100" />

      <div className={ROW}>
        <span className={LABEL}>Tags</span>
        <TagInput
          value={variation.tags || []}
          onCommit={(next) => void patch({ tags: next })}
        />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Description</span>
        <textarea
          value={notesLocal}
          onChange={(e) => setNotesLocal(e.target.value)}
          onBlur={() => {
            if (notesLocal === lastNotes.current) return;
            lastNotes.current = notesLocal;
            void patch({ notes: notesLocal });
          }}
          rows={3}
          placeholder="Add a short description"
          className={`${INPUT} resize-y`}
        />
      </div>
    </section>
  );
}
