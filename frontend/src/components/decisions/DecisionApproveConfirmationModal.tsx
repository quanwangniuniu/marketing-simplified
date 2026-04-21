'use client';

import Modal from '@/components/ui/Modal.js';
import { CheckCircle2 } from 'lucide-react';
import type { DecisionCommittedResponse, DecisionOptionDraft } from '@/types/decision';

interface DecisionApproveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  decision?: DecisionCommittedResponse | null;
  confirmations: Record<string, boolean>;
  onToggleConfirmation: (key: string) => void;
  confirming?: boolean;
}

const DecisionApproveConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  decision,
  confirmations,
  onToggleConfirmation,
  confirming = false,
}: DecisionApproveConfirmationModalProps) => {
  const options = (decision?.options || []) as DecisionOptionDraft[];
  const selectedOption = options.find((option) => option.isSelected);
  const confirmDisabled =
    confirming || !Object.values(confirmations).every(Boolean);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Approve decision</h2>
          <p className="mt-1 text-sm text-gray-500">
            Approval makes this decision official and ready for execution.
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {!decision ? (
            <div className="text-sm text-gray-500">Decision details unavailable.</div>
          ) : (
            <div className="space-y-5">
              <section>
                <h3 className="text-sm font-semibold text-gray-700">Signals</h3>
                <div className="mt-2 space-y-2">
                  {decision.signals && decision.signals.length > 0 ? (
                    decision.signals.map((signal) => (
                      <div
                        key={signal.id}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                      >
                        {signal.description || '—'}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No signals recorded.</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700">Context summary</h3>
                <p className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  {decision.contextSummary || '—'}
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
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700">Reasoning</h3>
                <p className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  {decision.reasoning || '—'}
                </p>
              </section>

              <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Risk level</h4>
                  <p className="mt-2 text-sm text-gray-700">
                    {decision.riskLevel || '—'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Confidence</h4>
                  <p className="mt-2 text-sm text-gray-700">
                    {decision.confidenceScore ?? '—'}
                  </p>
                </div>
              </section>
            </div>
          )}

          <div className="mt-6 space-y-3 rounded-lg border border-[#3CCED7]/20 bg-[#3CCED7]/10 px-4 py-3 text-sm text-[#0f757a]">
            <p className="font-semibold">Please confirm:</p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmations.reviewed}
                onChange={() => onToggleConfirmation('reviewed')}
              />
              <span>I reviewed the decision details.</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmations.ready}
                onChange={() => onToggleConfirmation('ready')}
              />
              <span>I agree this decision should proceed.</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmations.accountable}
                onChange={() => onToggleConfirmation('accountable')}
              />
              <span>I will follow up after execution.</span>
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
                : 'bg-[#3CCED7] text-white hover:bg-[#2AB5BD]'
            }`}
          >
            {confirming ? 'Approving...' : 'Confirm approval'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DecisionApproveConfirmationModal;
