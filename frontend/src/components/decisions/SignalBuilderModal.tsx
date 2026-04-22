'use client';

import { useEffect, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import type {
  SignalComparison,
  SignalDeltaUnit,
  SignalMetric,
  SignalMovement,
  SignalPeriod,
  SignalScopeType,
} from '@/types/decision';

interface SignalBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  metric: SignalMetric | '';
  movement: SignalMovement | '';
  period: SignalPeriod | '';
  comparison: SignalComparison;
  scopeType: SignalScopeType | '';
  scopeValue: string;
  deltaValue: string;
  deltaUnit: SignalDeltaUnit | '';
  movementGroup: 'INCREASE' | 'DECREASE' | 'NO_CHANGE' | 'VOLATILE' | 'UNEXPECTED' | '';
  movementDetail: 'SLIGHT' | 'MODERATE' | 'SHARP' | 'SPIKE' | 'DROP' | '';
  overrideText: string;
  showResetAutoText: boolean;
  descriptionEditable: boolean;
  descriptionText: string;
  errorMessage: string | null;
  canSubmit: boolean;
  saving: boolean;
  onMetricChange: (value: SignalMetric | '') => void;
  onMovementGroupChange: (value: SignalBuilderModalProps['movementGroup']) => void;
  onMovementDetailChange: (value: SignalBuilderModalProps['movementDetail']) => void;
  onPeriodChange: (value: SignalPeriod | '') => void;
  onComparisonChange: (value: SignalComparison) => void;
  onScopeTypeChange: (value: SignalScopeType | '') => void;
  onScopeValueChange: (value: string) => void;
  onDeltaValueChange: (value: string) => void;
  onDeltaUnitChange: (value: SignalDeltaUnit | '') => void;
  onOverrideTextChange: (value: string) => void;
  onClearOverride: () => void;
  onDescriptionActivate: () => void;
  onSubmit: () => void;
  onCancelEdit?: () => void;
}

const metricOptions: SignalMetric[] = [
  'ROAS',
  'CPA',
  'CONVERSION_RATE',
  'REVENUE',
  'PURCHASES',
  'CTR',
  'CLICKS',
  'IMPRESSIONS',
  'CPC',
  'CPM',
  'AD_SPEND',
  'AOV',
];

const periodOptions: SignalPeriod[] = [
  'LAST_24_HOURS',
  'LAST_3_DAYS',
  'LAST_7_DAYS',
  'LAST_14_DAYS',
  'LAST_30_DAYS',
];

const comparisonOptions: SignalComparison[] = [
  'NONE',
  'PREVIOUS_PERIOD',
  'SAME_PERIOD_LAST_WEEK',
  'SINCE_LAUNCH',
];

const scopeOptions: SignalScopeType[] = [
  'CAMPAIGN',
  'AD_SET',
  'AD',
  'CHANNEL',
  'AUDIENCE',
  'REGION',
];

const deltaUnits: SignalDeltaUnit[] = ['PERCENT', 'CURRENCY', 'ABSOLUTE'];
const deltaUnitLabels: Record<SignalDeltaUnit, string> = {
  PERCENT: 'Percent',
  CURRENCY: 'Currency',
  ABSOLUTE: 'Absolute',
};

const metricLabels: Record<SignalMetric, string> = {
  ROAS: 'ROAS',
  CPA: 'CPA',
  CONVERSION_RATE: 'Conversion rate',
  REVENUE: 'Revenue',
  PURCHASES: 'Purchases',
  CTR: 'CTR',
  CLICKS: 'Clicks',
  IMPRESSIONS: 'Impressions',
  CPC: 'CPC',
  CPM: 'CPM',
  AD_SPEND: 'Ad spend',
  AOV: 'AOV',
};

const movementLabels: Record<SignalMovement, string> = {
  SHARP_INCREASE: 'a sharp increase',
  MODERATE_INCREASE: 'a moderate increase',
  SLIGHT_INCREASE: 'a slight increase',
  NO_SIGNIFICANT_CHANGE: 'no significant change',
  SLIGHT_DECREASE: 'a slight decrease',
  MODERATE_DECREASE: 'a moderate decrease',
  SHARP_DECREASE: 'a sharp decrease',
  VOLATILE: 'volatile movement',
  UNEXPECTED_SPIKE: 'an unexpected spike',
  UNEXPECTED_DROP: 'an unexpected drop',
};

const periodLabels: Record<SignalPeriod, string> = {
  LAST_24_HOURS: '24 hours',
  LAST_3_DAYS: '3 days',
  LAST_7_DAYS: '7 days',
  LAST_14_DAYS: '14 days',
  LAST_30_DAYS: '30 days',
};

const comparisonLabels: Record<SignalComparison, string> = {
  NONE: 'None',
  PREVIOUS_PERIOD: 'vs previous period',
  SAME_PERIOD_LAST_WEEK: 'vs same period last week',
  SINCE_LAUNCH: 'since launch',
};

const scopeLabels: Record<SignalScopeType, string> = {
  CAMPAIGN: 'Campaign',
  AD_SET: 'Ad set',
  AD: 'Ad',
  CHANNEL: 'Channel',
  AUDIENCE: 'Audience',
  REGION: 'Region',
};

const deltaSignForMovement = (movement?: SignalMovement) => {
  if (!movement) return '';
  if (
    movement === 'SLIGHT_INCREASE' ||
    movement === 'MODERATE_INCREASE' ||
    movement === 'SHARP_INCREASE' ||
    movement === 'UNEXPECTED_SPIKE'
  ) {
    return '+';
  }
  if (
    movement === 'SLIGHT_DECREASE' ||
    movement === 'MODERATE_DECREASE' ||
    movement === 'SHARP_DECREASE' ||
    movement === 'UNEXPECTED_DROP'
  ) {
    return '−';
  }
  return '';
};

export const buildSignalPreviewText = (payload: {
  metric?: SignalMetric;
  movement?: SignalMovement;
  period?: SignalPeriod;
  comparison?: SignalComparison;
  scopeType?: SignalScopeType;
  scopeValue?: string;
  deltaValue?: number | null;
  deltaUnit?: SignalDeltaUnit;
}) => {
  const { metric, movement, period, comparison, scopeType, scopeValue, deltaValue, deltaUnit } = payload;
  if (!metric || !movement || !period) return '';
  const comparisonSuffix = comparison && comparison !== 'NONE' ? ` ${comparisonLabels[comparison]}` : '';
  const scopeSuffix = scopeType
    ? scopeValue
      ? ` for ${scopeLabels[scopeType]} ${scopeValue}`
      : ` for ${scopeLabels[scopeType]}`
    : '';
  const deltaUnitText = deltaUnit ? deltaUnitLabels[deltaUnit].toLowerCase() : '';
  const deltaClause =
    deltaValue !== null && deltaValue !== undefined && deltaUnitText
      ? ` by ${deltaValue} ${deltaUnitText}`
      : '';
  return `${metricLabels[metric]} has ${movementLabels[movement]}${deltaClause} over ${periodLabels[period]}${comparisonSuffix}${scopeSuffix}.`;
};

const SignalBuilderModal = ({
  isOpen,
  onClose,
  mode,
  metric,
  movement,
  period,
  comparison,
  scopeType,
  scopeValue,
  deltaValue,
  deltaUnit,
  movementGroup,
  movementDetail,
  overrideText,
  showResetAutoText,
  descriptionEditable,
  descriptionText,
  errorMessage,
  canSubmit,
  saving,
  onMetricChange,
  onMovementGroupChange,
  onMovementDetailChange,
  onPeriodChange,
  onComparisonChange,
  onScopeTypeChange,
  onScopeValueChange,
  onDeltaValueChange,
  onDeltaUnitChange,
  onOverrideTextChange,
  onClearOverride,
  onDescriptionActivate,
  onSubmit,
  onCancelEdit,
}: SignalBuilderModalProps) => {
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (descriptionEditable) {
      descriptionRef.current?.focus();
    }
  }, [descriptionEditable]);
  const deltaSign = deltaSignForMovement(movement || undefined);
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'edit' ? 'Edit Signal' : 'Add Signal'}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Build a structured signal with metric movement and context.
          </p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="space-y-4 text-xs text-gray-600">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800">Metric</label>
              <div className="flex flex-wrap gap-2">
                {metricOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onMetricChange(option)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      metric === option
                        ? 'border-[#3CCED7] bg-[#3CCED7] text-white'
                        : 'border-[#3CCED7]/30 bg-white text-[#1a9ba3] hover:border-blue-300'
                    }`}
                  >
                    {metricLabels[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-800">Movement</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'INCREASE', label: 'Increase' },
                    { key: 'DECREASE', label: 'Decrease' },
                    { key: 'NO_CHANGE', label: 'No significant change' },
                    { key: 'VOLATILE', label: 'Volatile movement' },
                    { key: 'UNEXPECTED', label: 'Unexpected change' },
                  ].map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => onMovementGroupChange(group.key as SignalBuilderModalProps['movementGroup'])}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        movementGroup === group.key
                          ? 'border-[#3CCED7] bg-[#3CCED7] text-white'
                          : 'border-[#3CCED7]/30 bg-white text-[#1a9ba3] hover:border-blue-300'
                      }`}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
                {(movementGroup === 'INCREASE' || movementGroup === 'DECREASE') ? (
                  <>
                    <div className="h-px w-full bg-blue-200" />
                    {!movementDetail && (
                      <p className="text-[11px] text-amber-600 font-medium">Select intensity to continue →</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {['SLIGHT', 'MODERATE', 'SHARP'].map((detail) => (
                        <button
                          key={detail}
                          type="button"
                          onClick={() => onMovementDetailChange(detail as SignalBuilderModalProps['movementDetail'])}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            movementDetail === detail
                              ? 'border-[#3CCED7] bg-[#3CCED7] text-white'
                              : 'border-[#3CCED7]/30 bg-white text-[#1a9ba3] hover:border-blue-300'
                          }`}
                        >
                          {detail.charAt(0) + detail.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                {movementGroup === 'UNEXPECTED' ? (
                  <div className="h-px w-full bg-blue-200" />
                ) : null}
                {movementGroup === 'UNEXPECTED' && !movementDetail ? (
                  <p className="text-[11px] text-amber-600 font-medium">Select type to continue →</p>
                ) : null}
                {movementGroup === 'UNEXPECTED' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { key: 'SPIKE', label: 'Spike' },
                      { key: 'DROP', label: 'Drop' },
                    ].map((detail) => (
                      <button
                        key={detail.key}
                        type="button"
                        onClick={() => onMovementDetailChange(detail.key as SignalBuilderModalProps['movementDetail'])}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          movementDetail === detail.key
                            ? 'border-[#3CCED7] bg-[#3CCED7] text-white'
                            : 'border-[#3CCED7]/30 bg-white text-[#1a9ba3] hover:border-blue-300'
                        }`}
                      >
                        {detail.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-800">Period</label>
                <div className="text-[11px] text-gray-500">the last...</div>
                <div className="flex flex-wrap gap-2">
                  {periodOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onPeriodChange(option)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        period === option
                          ? 'border-[#3CCED7] bg-[#3CCED7] text-white'
                          : 'border-[#3CCED7]/30 bg-white text-[#1a9ba3] hover:border-blue-300'
                      }`}
                    >
                      {periodLabels[option]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-sm font-semibold text-gray-800">Delta</label>
                <div className="flex gap-2">
                  <div className="flex w-28 items-center gap-1 rounded-md border border-gray-200 px-2 py-1">
                    <span className="text-xs font-semibold text-gray-500">
                      {deltaSign || ' '}
                    </span>
                    <input
                      type="number"
                      value={deltaValue}
                      onChange={(event) =>
                        onDeltaValueChange(event.target.value.replace(/^[+-]/, ''))
                      }
                      step="0.01"
                      inputMode="decimal"
                      className="w-full border-none bg-transparent text-sm text-gray-700 focus:outline-none"
                      placeholder="Value"
                    />
                  </div>
                  <select
                    value={deltaUnit}
                    onChange={(event) => onDeltaUnitChange(event.target.value as SignalDeltaUnit)}
                    className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm"
                  >
                    <option value="">Unit</option>
                    {deltaUnits.map((option) => (
                      <option key={option} value={option}>
                        {deltaUnitLabels[option]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-semibold text-gray-800">Comparison</label>
                <select
                  value={comparison}
                  onChange={(event) => onComparisonChange(event.target.value as SignalComparison)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                >
                  {comparisonOptions.map((option) => (
                    <option key={option} value={option}>
                      {comparisonLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-semibold text-gray-800">Scope type</label>
              <select
                value={scopeType}
                onChange={(event) => onScopeTypeChange(event.target.value as SignalScopeType)}
                className="rounded-md border border-gray-200 px-2 py-1 text-sm"
              >
                <option value="">None</option>
                {scopeOptions.map((option) => (
                  <option key={option} value={option}>
                    {scopeLabels[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-semibold text-gray-800">
                Scope value {scopeType === 'CHANNEL' ? '(required)' : '(optional)'}
              </label>
              <input
                value={scopeValue}
                onChange={(event) => onScopeValueChange(event.target.value)}
                className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                placeholder={scopeType ? `Enter ${scopeLabels[scopeType]} value` : 'Optional'}
              />
            </div>

          </div>

          <div className="mt-4 rounded-lg border border-gray-200 p-3">
            <div className="font-semibold text-gray-700 text-xs">Description</div>
            <textarea
              ref={descriptionRef}
              value={descriptionText}
              readOnly={!descriptionEditable}
              onClick={() => {
                if (!descriptionEditable) onDescriptionActivate();
              }}
              onChange={(event) => onOverrideTextChange(event.target.value)}
              placeholder="Select metric, movement, and period."
              className={`mt-2 min-h-[96px] w-full rounded-md border px-2 py-2 text-sm ${
                descriptionEditable
                  ? 'border-blue-300 bg-white text-gray-800'
                  : 'border-gray-200 bg-gray-100 text-gray-500'
              }`}
            />
            {showResetAutoText ? (
              <button
                type="button"
                onClick={onClearOverride}
                className="mt-2 text-xs font-semibold text-[#3CCED7]"
              >
                Reset to auto text
              </button>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {errorMessage}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600"
          >
            Cancel
          </button>
          {mode === 'edit' && onCancelEdit ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600"
            >
              Reset
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || saving}
            className={`rounded-md px-3 py-2 text-xs font-semibold ${
              canSubmit && !saving
                ? 'bg-gray-900 text-white'
                : 'cursor-not-allowed bg-gray-200 text-gray-500'
            }`}
          >
            {saving ? 'Saving...' : mode === 'edit' ? 'Update Signal' : 'Add Signal'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SignalBuilderModal;
