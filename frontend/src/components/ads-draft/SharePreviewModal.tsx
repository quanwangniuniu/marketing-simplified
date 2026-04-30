'use client';

import { Check, Copy, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import BrandDialog from '@/components/tasks/detail/BrandDialog';
import type { Platform } from './types';

export type ShareDays = 7 | 14 | 30;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: Platform;
  onShare: (days?: ShareDays) => Promise<string>;
  title?: string;
  subtitle?: string;
}

const FACEBOOK_DAYS_OPTIONS: ShareDays[] = [7, 14, 30];

export default function SharePreviewModal({
  open,
  onOpenChange,
  platform,
  onShare,
  title = 'Share preview',
  subtitle = 'Public read-only link',
}: Props) {
  const showDays = platform === 'facebook_meta';
  const [days, setDays] = useState<ShareDays>(7);
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setLink('');
      setLoading(false);
      setError(null);
      setCopied(false);
      setDays(7);
    }
  }, [open]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onShare(showDays ? days : undefined);
      setLink(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate link';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [onShare, days, showDays]);

  const handleCopy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  }, [link]);

  const hasLink = link.length > 0;
  const expirationDays = showDays ? days : 7;

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      width="max-w-md"
    >
      <div className="space-y-4">
        {showDays && (
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Link duration
            </div>
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Link duration">
              {FACEBOOK_DAYS_OPTIONS.map((option) => {
                const selected = days === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDays(option)}
                    disabled={hasLink || loading}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? 'bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                        : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
                    {option} days
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Shareable link
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={loading ? 'Generating link…' : link}
              placeholder="Not generated yet"
              aria-busy={loading}
              className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
            />
            <button
              type="button"
              onClick={handleCopy}
              disabled={!hasLink || copied}
              aria-label="Copy link"
              title="Copy link"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-gray-600 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Link expires {expirationDays} days after generation.
          </p>
          {error && (
            <p role="alert" aria-live="polite" className="mt-2 text-xs text-rose-600">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="-mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || hasLink}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
          Generate link
        </button>
      </div>
    </BrandDialog>
  );
}
