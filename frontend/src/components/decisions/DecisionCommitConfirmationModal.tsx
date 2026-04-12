'use client';

import Modal from '@/components/ui/Modal.js';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { DecisionOptionDraft, DecisionSignal } from '@/types/decision';

interface DecisionCommitConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  signals?: Array<Pick<DecisionSignal, 'id' | 'displayText'>>;
  contextSummary?: string;
  reasoning?: string;
  options?: DecisionOptionDraft[];
  riskLevel?: string | null;
  confidenceScore?: number | null;
  confirmations: Record<string, boolean>;
  onToggleConfirmation: (key: string) => void;
  confirming?: boolean;
}

const DecisionCommitConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  signals = [],
  contextSummary,
  reasoning,
  options = [],
  riskLevel,
  confidenceScore,
  confirmations,
  onToggleConfirmation,
  confirming = false,
}: DecisionCommitConfirmationModalProps) => {
  const selectedOption = options.find((option) => option.isSelected);
  const abandonedOptions = options.filter((option) => !option.isSelected);
  const riskLabel = (riskLevel || '').toUpperCase();
  const riskStyle =
    riskLabel === 'LOW'
      ? 'text-emerald-700'
      : riskLabel === 'MEDIUM'
        ? 'text-amber-700'
        : riskLabel === 'HIGH'
          ? 'text-red-700'
          : 'text-gray-700';
  const confirmDisabled =
    confirming || !Object.values(confirmations).every(Boolean);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Confirm commitment</h2>
          <p className="mt-1 text-sm text-gray-500">
            Core fields will become read-only after you commit.
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="text-sm text-gray-500">Loading decision summary...</div>
          ) : (
            <div className="space-y-5">
              <section>
                <h3 className="text-sm font-semibold text-gray-700">Signals</h3>
                <div className="mt-2 space-y-2">
                  {signals.length > 0 ? (
                    signals.map((signal) => (
                      <div
                        key={signal.id}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                      >
                        {signal.displayText || '—'}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No signals added.</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700">Context summary</h3>
                <p className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  {contextSummary || '—'}
                </p>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700">Selected option</h3>
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{selectedOption?.text || '—'}</span>
                  </div>
                </div>
                {abandonedOptions.length > 0 ? (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-red-500">
                      Abandoned options
                    </h4>
                    <div className="mt-2 space-y-2">
                      {abandonedOptions.map((option, index) => (
                        <div
                          key={`abandoned-${index}`}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                        >
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span>{option.text || `Option ${index + 1}`}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700">Reasoning</h3>
                <p className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  {reasoning || '—'}
                </p>
              </section>

              <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Risk level</h4>
                  <p className={`mt-2 text-sm font-semibold ${riskStyle}`}>
                    {riskLevel || '—'}
                    {riskLabel === 'HIGH' ? (
                      <span className="ml-2 text-xs font-normal text-red-500">
                        *Requires approval
                      </span>
                    ) : null}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Confidence</h4>
                  <p className="mt-2 text-sm text-gray-700">{confidenceScore ?? '—'}</p>
                </div>
              </section>
            </div>
          )}

          <div className="mt-6 space-y-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Please confirm:</p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmations.alternatives}
                onChange={() => onToggleConfirmation('alternatives')}
              />
              <span>I considered alternatives.</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmations.risk}
                onChange={() => onToggleConfirmation('risk')}
              />
              <span>I accept this risk level.</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmations.review}
                onChange={() => onToggleConfirmation('review')}
              />
              <span>I commit to review the outcome.</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              confirmDisabled
                ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            {confirming ? 'Committing...' : 'Confirm commit'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DecisionCommitConfirmationModal;
