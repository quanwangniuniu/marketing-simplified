import type { DecisionOptionDraft, DecisionRiskLevel } from '@/types/decision';

const FIELD_ORDER = [
  'title',
  'contextSummary',
  'signals',
  'options',
  'selectedOption',
  'reasoning',
  'riskLevel',
  'confidenceScore',
] as const;

const FIELD_ID_MAP: Record<string, string> = {
  title: 'decision-field-title',
  contextSummary: 'decision-field-contextSummary',
  signals: 'decision-field-signals',
  options: 'decision-field-options',
  selectedOption: 'decision-field-options',
  reasoning: 'decision-field-reasoning',
  riskLevel: 'decision-field-riskConfidence',
  confidenceScore: 'decision-field-riskConfidence',
};

export function scrollToFirstError(errors: Record<string, string>): void {
  const firstKey = FIELD_ORDER.find((key) => Boolean(errors[key]));
  if (!firstKey) return;
  const id = FIELD_ID_MAP[firstKey] ?? null;
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export interface DecisionDraftFields {
  title: string;
  contextSummary: string;
  reasoning: string;
  riskLevel: DecisionRiskLevel | null;
  confidenceScore: number;
  options: DecisionOptionDraft[];
}

export function validateDecisionDraft(
  fields: DecisionDraftFields,
  signalCount: number,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!fields.title.trim()) errors.title = 'Title is required.';
  if (!fields.contextSummary.trim()) errors.contextSummary = 'Context summary is required.';
  if (signalCount <= 0) errors.signals = 'At least one signal is required.';
  if (!fields.reasoning.trim()) errors.reasoning = 'Reasoning is required.';
  const nonEmptyOptions = fields.options.filter((o) => (o.text || '').trim().length > 0);
  if (nonEmptyOptions.length < 2) errors.options = 'At least two non-empty options are required.';
  const selectedCount = fields.options.filter((o) => o.isSelected).length;
  if (selectedCount !== 1) errors.selectedOption = 'Select exactly one option.';
  if (!fields.riskLevel) errors.riskLevel = 'Risk level is required.';
  if (!(fields.confidenceScore >= 1 && fields.confidenceScore <= 5))
    errors.confidenceScore = 'Confidence must be between 1 and 5.';
  return errors;
}
