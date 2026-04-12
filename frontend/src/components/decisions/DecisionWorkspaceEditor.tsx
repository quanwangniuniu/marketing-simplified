'use client';

import type { DecisionOptionDraft, DecisionRiskLevel } from '@/types/decision';

interface DecisionWorkspaceEditorProps {
  contextSummary: string;
  reasoning: string;
  riskLevel: DecisionRiskLevel | '';
  confidenceScore: number;
  options: DecisionOptionDraft[];
  errors: Record<string, string | undefined>;
  onChange: (field: string, value: any) => void;
  onOptionsChange: (nextOptions: DecisionOptionDraft[]) => void;
  focusMode?: boolean;
}

const riskOptions: DecisionRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
const riskHeights = ['h-2', 'h-2', 'h-2'];
const riskColors = ['bg-emerald-400', 'bg-amber-400', 'bg-rose-500'];

const DecisionWorkspaceEditor = ({
  contextSummary,
  reasoning,
  riskLevel,
  confidenceScore,
  options,
  errors,
  onChange,
  onOptionsChange,
  focusMode = false,
}: DecisionWorkspaceEditorProps) => {
  const handleOptionTextChange = (index: number, value: string) => {
    const next = options.map((option, idx) =>
      idx === index ? { ...option, text: value } : option
    );
    onOptionsChange(next);
  };

  const handleSelectOption = (index: number) => {
    const next = options.map((option, idx) => ({
      ...option,
      isSelected: idx === index,
    }));
    onOptionsChange(next);
  };

  const handleAddOption = () => {
    const next = [
      ...options,
      {
        text: '',
        isSelected: options.length === 0,
        order: options.length,
      },
    ];
    onOptionsChange(next);
  };

  const handleRemoveOption = (index: number) => {
    const next = options.filter((_, idx) => idx !== index);
    if (!next.some((option) => option.isSelected) && next.length > 0) {
      next[0].isSelected = true;
    }
    onOptionsChange(next.map((option, idx) => ({ ...option, order: idx })));
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-6">
      <section
        id="decision-field-contextSummary"
        className={`space-y-2 transition-all ${
          focusMode && errors.contextSummary
            ? 'rounded-lg bg-white p-3 ring-2 ring-red-500 shadow-[0_0_24px_rgba(239,68,68,0.45)]'
            : focusMode
            ? 'opacity-30'
            : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Context Summary</h3>
          {errors.contextSummary ? (
            <span className="text-xs font-medium text-red-500">
              {errors.contextSummary}
            </span>
          ) : null}
        </div>
        <textarea
          value={contextSummary}
          onChange={(event) => onChange('contextSummary', event.target.value)}
          placeholder="Summarize the decision context and constraints."
          className="min-h-[120px] w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
        />
      </section>

      <section
        id="decision-field-options"
        className={`space-y-3 transition-all ${
          focusMode && (errors.options || errors.selectedOption)
            ? 'rounded-lg bg-white p-3 ring-2 ring-red-500 shadow-[0_0_24px_rgba(239,68,68,0.45)]'
            : focusMode
            ? 'opacity-30'
            : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Options</h3>
          {errors.options || errors.selectedOption ? (
            <span className="text-xs font-medium text-red-500">
              {errors.options || errors.selectedOption}
            </span>
          ) : null}
        </div>
        <div className="space-y-3">
          {options.map((option, index) => (
            <div
              key={`option-${index}`}
              className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-3"
            >
              <input
                type="radio"
                checked={option.isSelected}
                onChange={() => handleSelectOption(index)}
                className="mt-1 h-4 w-4 text-blue-600"
              />
              <input
                type="text"
                value={option.text}
                onChange={(event) => handleOptionTextChange(index, event.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1 border-none bg-transparent text-sm text-gray-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleRemoveOption(index)}
                disabled={options.length <= 2}
                className={`text-xs font-semibold ${
                  options.length <= 2
                    ? 'cursor-not-allowed text-gray-300'
                    : 'text-gray-400 hover:text-red-500'
                }`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddOption}
          className="w-fit rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300 hover:text-gray-800"
        >
          Add option
        </button>
      </section>

      <section
        id="decision-field-reasoning"
        className={`space-y-2 transition-all ${
          focusMode && errors.reasoning
            ? 'rounded-lg bg-white p-3 ring-2 ring-red-500 shadow-[0_0_24px_rgba(239,68,68,0.45)]'
            : focusMode
            ? 'opacity-30'
            : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Reasoning</h3>
          {errors.reasoning ? (
            <span className="text-xs font-medium text-red-500">{errors.reasoning}</span>
          ) : null}
        </div>
        <textarea
          value={reasoning}
          onChange={(event) => onChange('reasoning', event.target.value)}
          placeholder="Explain why the selected option is the right call."
          className="min-h-[140px] w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
        />
      </section>

      <section
        id="decision-field-riskConfidence"
        className={`grid gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-all ${
          focusMode && (errors.riskLevel || errors.confidenceScore)
            ? 'ring-2 ring-red-500 shadow-[0_0_24px_rgba(239,68,68,0.45)]'
            : focusMode
            ? 'opacity-30'
            : ''
        }`}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Risk Level</h3>
              {errors.riskLevel ? (
                <span className="text-xs font-medium text-red-500">
                  {errors.riskLevel}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {riskOptions.map((level, index) => {
                  const active = riskLevel === level;
                  const selectedIndex = riskOptions.indexOf(riskLevel as any);
                  const leftBarActive =
                    riskLevel && selectedIndex >= 0
                      ? riskColors[selectedIndex]
                      : 'bg-gray-200';
                  const barColor =
                    riskLevel === 'HIGH'
                      ? riskColors[2]
                      : index === 0
                      ? leftBarActive
                      : active
                      ? riskColors[index]
                      : 'bg-gray-200';
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onChange('riskLevel', level)}
                      className="w-10"
                      aria-label={`Set risk ${level}`}
                    >
                      <span
                        className={`block w-full rounded-sm ${riskHeights[index]} ${barColor}`}
                      />
                    </button>
                  );
                })}
              </div>
              <span
                className={`text-sm font-semibold ${
                  riskLevel === 'LOW'
                    ? 'text-emerald-600'
                    : riskLevel === 'MEDIUM'
                    ? 'text-amber-600'
                    : riskLevel === 'HIGH'
                    ? 'text-rose-600'
                    : 'text-gray-400'
                }`}
              >
                {riskLevel
                  ? riskLevel.charAt(0) + riskLevel.slice(1).toLowerCase()
                  : 'Unselected'}
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Confidence</h3>
              {errors.confidenceScore ? (
                <span className="text-xs font-medium text-red-500">
                  {errors.confidenceScore}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onChange('confidenceScore', Math.max(1, confidenceScore - 1))}
                className="h-8 w-8 rounded-md border border-gray-200 text-lg font-semibold text-gray-600 hover:border-gray-300"
              >
                -
              </button>
              <span className="min-w-[32px] text-center text-sm font-semibold text-gray-700">
                {confidenceScore}
              </span>
              <button
                type="button"
                onClick={() => onChange('confidenceScore', Math.min(5, confidenceScore + 1))}
                className="h-8 w-8 rounded-md border border-gray-200 text-lg font-semibold text-gray-600 hover:border-gray-300"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DecisionWorkspaceEditor;
