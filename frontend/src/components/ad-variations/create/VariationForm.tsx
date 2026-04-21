'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import InlineSelect from '@/components/tasks-v2/detail/InlineSelect';
import { AdVariationAPI } from '@/lib/api/adVariationApi';
import attachmentApi, { validateFile } from '@/lib/api/attachmentApi';
import type {
  AdGroup,
  CreativeType,
  MediaAsset,
  VariationStatus,
} from '@/types/adVariation';
import { CREATIVE_FIELDS } from '../creativeFields';
import CreativeTypePicker from './CreativeTypePicker';
import BudgetPicker from './BudgetPicker';
import MediaDropZone from './MediaDropZone';

interface Props {
  campaignId: number;
  adGroups: AdGroup[];
  onCancel: () => void;
  onComplete: () => void | Promise<void>;
}

const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-gray-400';
const FIELD_LABEL = 'block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1';
const INPUT =
  'w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30';
const UNASSIGNED_AD_SET = '__noadset__';

const STATUS_OPTIONS: VariationStatus[] = ['Draft', 'Testing', 'Live', 'Winner', 'Loser', 'Paused'];
const DELIVERY_OPTIONS = ['Active', 'Learning', 'Limited', 'Paused'];
const BID_OPTIONS = ['Lowest Cost', 'Cost Cap', 'Bid Cap', 'ROAS'];

const acceptMap: Record<CreativeType, string> = {
  image: 'image/*',
  video: 'video/*',
  carousel: 'image/*',
  collection: 'image/*',
  email: '',
};

const FIELD_ERROR_LABELS: Record<string, string> = {
  name: 'Please enter a name.',
  creativeType: 'Please choose a creative type.',
  status: 'Please choose a status.',
  tags: 'Please check your tags.',
  notes: 'Please check your notes.',
  adGroupId: 'Please select an ad set.',
  delivery: 'Please check delivery.',
  bidStrategy: 'Please check bid strategy.',
  budget: 'Please check budget.',
  formatPayload: 'Please add required media assets.',
  copyElements: 'Please complete all copy fields.',
};

function formatServerError(error: any): string {
  const data = error?.response?.data;
  if (!data) return 'Create variation failed. Please check required fields.';
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.join(', ');
  if (data.detail) return String(data.detail);
  const parts = Object.entries(data).map(([key, value]) => {
    const label = FIELD_ERROR_LABELS[key] ? key : key;
    if (Array.isArray(value)) return `${label}: ${value.join(', ')}`;
    return `${label}: ${String(value)}`;
  });
  return parts.length
    ? `Please check: ${parts.join('; ')}`
    : 'Create variation failed. Please check required fields.';
}

const VariationForm = forwardRef<HTMLInputElement, Props>(function VariationForm(
  { campaignId, adGroups, onCancel, onComplete }: Props,
  externalNameRef,
) {
  const internalNameRef = useRef<HTMLInputElement | null>(null);
  const nameRefCallback = (node: HTMLInputElement | null) => {
    internalNameRef.current = node;
    if (typeof externalNameRef === 'function') externalNameRef(node);
    else if (externalNameRef) externalNameRef.current = node;
  };

  const [name, setName] = useState('');
  const [creativeType, setCreativeType] = useState<CreativeType>('image');
  const [status, setStatus] = useState<VariationStatus>('Draft');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [adGroupId, setAdGroupId] = useState<number | null>(null);
  const [delivery, setDelivery] = useState('Active');
  const [bidStrategy, setBidStrategy] = useState('Lowest Cost');
  const [budgetChoice, setBudgetChoice] = useState('100');
  const [budgetCustom, setBudgetCustom] = useState('');
  const [copyEntries, setCopyEntries] = useState<Record<string, string>>({});

  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [logoAssets, setLogoAssets] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [copyErrors, setCopyErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => internalNameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const nextCopyErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Please enter a name.';
    CREATIVE_FIELDS[creativeType].forEach((field) => {
      const value = copyEntries[field.key] || '';
      if (!value.trim()) nextCopyErrors[field.key] = 'This field is required.';
    });
    if (Object.keys(nextCopyErrors).length) {
      nextErrors.copyElements = 'Please complete all copy fields.';
    }
    setFormErrors(nextErrors);
    setCopyErrors(nextCopyErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const applyServerErrors = (data: any) => {
    const nextErrors: Record<string, string> = {};
    const nextCopyErrors: Record<string, string> = {};
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'copyElements' || key === 'copy_elements') {
          nextErrors.copyElements = FIELD_ERROR_LABELS.copyElements;
          if (Array.isArray(value)) {
            value.forEach((item: any) => {
              const fieldKey = item?.elementKey;
              const message = Array.isArray(item?.value) ? item.value.join(', ') : item?.value;
              if (fieldKey && message) nextCopyErrors[fieldKey] = String(message);
            });
          }
          return;
        }
        nextErrors[key] = FIELD_ERROR_LABELS[key] || 'Please check this field.';
      });
    }
    setFormErrors(nextErrors);
    setCopyErrors(nextCopyErrors);
  };

  const uploadFiles = async (files: File[], kind: 'media' | 'logo') => {
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
        const multiple = creativeType === 'carousel' || creativeType === 'collection';
        setMediaAssets((prev) => (multiple ? [...prev, ...uploaded] : uploaded));
      } else {
        setLogoAssets((prev) => [...prev, ...uploaded]);
      }
    } catch {
      setUploadError('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (uploading || submitting) return;
    if (!validateForm()) {
      setTopError('Please fix the highlighted fields.');
      return;
    }
    setTopError(null);
    const budgetValue = budgetChoice === 'custom' ? budgetCustom : budgetChoice;
    const budgetNumber = budgetValue ? Number.parseFloat(budgetValue) : NaN;
    const copyElements = CREATIVE_FIELDS[creativeType].map((field, index) => ({
      elementKey: field.key,
      value: copyEntries[field.key] || '',
      position:
        creativeType === 'carousel' || creativeType === 'collection' ? index + 1 : undefined,
    }));

    setSubmitting(true);
    try {
      await AdVariationAPI.createVariation(campaignId, {
        name: name.trim(),
        creativeType,
        status,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes,
        adGroupId: adGroupId ?? null,
        delivery,
        bidStrategy,
        budget: Number.isFinite(budgetNumber) ? budgetNumber : null,
        formatPayload: {
          mediaAssets,
          logoAssets,
          previewUrl: mediaAssets[0]?.thumbnailUrl || mediaAssets[0]?.fileUrl || null,
          logoUrl: logoAssets[0]?.thumbnailUrl || logoAssets[0]?.fileUrl || null,
        },
        copyElements,
      });
      toast.success('Variation created');
      await onComplete();
    } catch (error: any) {
      applyServerErrors(error?.response?.data);
      const msg = formatServerError(error);
      setTopError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex max-h-[calc(90vh-120px)] flex-col">
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {topError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {topError}
          </div>
        )}

        <div className="space-y-6">
          <section>
            <div className={`${SECTION_LABEL} mb-2`}>Basics</div>
            <input
              ref={nameRefCallback}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Variation name"
              className="w-full border-0 border-b-2 border-transparent bg-transparent py-1 text-[22px] font-semibold text-gray-900 outline-none transition placeholder:font-medium placeholder:text-gray-300 focus:border-[#3CCED7]"
            />
            {formErrors.name && (
              <p className="mt-1 text-[11px] text-rose-600">{formErrors.name}</p>
            )}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add some details"
              rows={2}
              className="mt-2 w-full resize-none border-0 bg-transparent py-1 text-[14px] leading-5 text-gray-700 outline-none placeholder:text-gray-400"
            />
          </section>

          <section className="space-y-3">
            <div className={SECTION_LABEL}>Creative</div>
            <div>
              <label className={FIELD_LABEL}>Format</label>
              <CreativeTypePicker value={creativeType} onChange={setCreativeType} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Ad set</label>
              <InlineSelect
                value={adGroupId ? String(adGroupId) : UNASSIGNED_AD_SET}
                onValueChange={(v) =>
                  setAdGroupId(v === UNASSIGNED_AD_SET ? null : Number(v))
                }
                options={[
                  { value: UNASSIGNED_AD_SET, label: 'No ad set' },
                  ...adGroups.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
              />
            </div>
            {CREATIVE_FIELDS[creativeType].map((field) => (
              <div key={field.key}>
                <label className={FIELD_LABEL}>{field.label}</label>
                <input
                  type="text"
                  value={copyEntries[field.key] || ''}
                  onChange={(e) =>
                    setCopyEntries((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className={INPUT}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                />
                {copyErrors[field.key] && (
                  <p className="mt-1 text-[11px] text-rose-600">{copyErrors[field.key]}</p>
                )}
              </div>
            ))}
            <div>
              <label className={FIELD_LABEL}>Tags (comma separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={INPUT}
                placeholder="spring, hero"
              />
            </div>
          </section>

          {acceptMap[creativeType] && (
            <section className="space-y-3">
              <div className={SECTION_LABEL}>Media</div>
              <div className="grid gap-3 md:grid-cols-2">
                <MediaDropZone
                  label="Upload media"
                  accept={acceptMap[creativeType]}
                  multiple={creativeType === 'carousel' || creativeType === 'collection'}
                  assets={mediaAssets}
                  uploading={uploading}
                  error={uploadError}
                  onFiles={(files) => void uploadFiles(files, 'media')}
                  onRemove={(index) =>
                    setMediaAssets((prev) => prev.filter((_, i) => i !== index))
                  }
                />
                <MediaDropZone
                  label="Upload logo"
                  accept="image/*"
                  assets={logoAssets}
                  uploading={uploading}
                  error={uploadError}
                  onFiles={(files) => void uploadFiles(files, 'logo')}
                  onRemove={(index) =>
                    setLogoAssets((prev) => prev.filter((_, i) => i !== index))
                  }
                />
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className={SECTION_LABEL}>Schedule</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className={FIELD_LABEL}>Status</label>
                <InlineSelect
                  value={status}
                  onValueChange={(v) => setStatus(v as VariationStatus)}
                  options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Delivery</label>
                <InlineSelect
                  value={delivery}
                  onValueChange={setDelivery}
                  options={DELIVERY_OPTIONS.map((o) => ({ value: o, label: o }))}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Bid strategy</label>
                <InlineSelect
                  value={bidStrategy}
                  onValueChange={setBidStrategy}
                  options={BID_OPTIONS.map((o) => ({ value: o, label: o }))}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Budget</label>
                <BudgetPicker
                  choice={budgetChoice}
                  custom={budgetCustom}
                  onChange={(c, cu) => {
                    setBudgetChoice(c);
                    setBudgetCustom(cu);
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="-mx-5 -mb-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || uploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitting ? 'Creating…' : 'Create variation'}
        </button>
      </div>
    </div>
  );
});

export default VariationForm;
