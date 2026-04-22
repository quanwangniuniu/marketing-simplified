'use client';

import { useCallback } from 'react';
import {
  X,
  Table2,
  Plus,
  Trash2,
  Rows3,
  Columns3,
  Calculator,
  RefreshCw,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PivotConfig,
  PivotValueConfig,
  PivotDisplayMode,
  ColumnSortOrder,
  AggregationFunction,
  SourceColumn,
  normalizeColumnConfig,
} from '@/lib/spreadsheet/pivot';

interface PivotEditorPanelProps {
  config: PivotConfig;
  sourceSheetName: string;
  sourceColumns: SourceColumn[];
  sourceRowCount: number;
  onConfigChange: (config: PivotConfig) => void;
  onClose: () => void;
  onRefresh: () => void;
}

const AGGREGATION_OPTIONS: { value: AggregationFunction; label: string }[] = [
  { value: 'SUM', label: 'SUM' },
  { value: 'COUNT', label: 'COUNT' },
  { value: 'AVG', label: 'AVG' },
  { value: 'MIN', label: 'MIN' },
  { value: 'MAX', label: 'MAX' },
  { value: 'MEDIAN', label: 'MEDIAN' },
];

const DISPLAY_OPTIONS: { value: PivotDisplayMode; label: string }[] = [
  { value: 'VALUE', label: 'Value' },
  { value: 'ROW_PERCENT', label: '% of row total' },
  { value: 'COLUMN_PERCENT', label: '% of column total' },
  { value: 'TOTAL_PERCENT', label: '% of grand total' },
];

export function PivotEditorPanel({
  config,
  sourceSheetName,
  sourceColumns,
  sourceRowCount,
  onConfigChange,
  onClose,
  onRefresh,
}: PivotEditorPanelProps) {
  const normalizedColumns = normalizeColumnConfig(config.columns);
  const columnFields = normalizedColumns.map((c) => c.field);
  const usedFields = new Set([...config.rows, ...columnFields, ...config.values.map((v) => v.field)]);

  const availableFieldsForRows = sourceColumns.filter(
    (col) =>
      !columnFields.includes(col.header) && !config.values.some((v) => v.field === col.header)
  );

  const availableFieldsForColumns = sourceColumns.filter(
    (col) =>
      !config.rows.includes(col.header) && !config.values.some((v) => v.field === col.header)
  );

  const availableFieldsForValues = sourceColumns.filter(
    (col) => !config.rows.includes(col.header) && !columnFields.includes(col.header)
  );

  const handleAddRow = useCallback(
    (field: string) => {
      if (!field || field === '__add__') return;
      onConfigChange({
        ...config,
        rows: [...config.rows, field],
      });
    },
    [config, onConfigChange]
  );

  const handleRemoveRow = useCallback(
    (index: number) => {
      onConfigChange({
        ...config,
        rows: config.rows.filter((_, i) => i !== index),
      });
    },
    [config, onConfigChange]
  );

  const handleToggleGrandTotalRow = useCallback(() => {
    onConfigChange({
      ...config,
      showGrandTotalRow: !(config.showGrandTotalRow ?? true),
    });
  }, [config, onConfigChange]);

  const handleAddColumn = useCallback(
    (field: string) => {
      if (!field || field === '__add__') return;
      onConfigChange({
        ...config,
        columns: [...normalizedColumns, { field, sort: 'asc' as ColumnSortOrder }],
      });
    },
    [config, normalizedColumns, onConfigChange]
  );

  const handleRemoveColumn = useCallback(
    (index: number) => {
      const next = normalizedColumns.filter((_, i) => i !== index);
      onConfigChange({
        ...config,
        columns: next,
      });
    },
    [config, normalizedColumns, onConfigChange]
  );

  const handleColumnSortChange = useCallback(
    (index: number, sort: ColumnSortOrder) => {
      const next = normalizedColumns.map((col, i) =>
        i === index ? { ...col, sort } : col
      );
      onConfigChange({
        ...config,
        columns: next,
      });
    },
    [config, normalizedColumns, onConfigChange]
  );

  const handleAddValue = useCallback(
    (field: string) => {
      if (!field || field === '__add__') return;
      onConfigChange({
        ...config,
        values: [...config.values, { field, aggregation: 'SUM', display: 'VALUE' }],
      });
    },
    [config, onConfigChange]
  );

  const handleRemoveValue = useCallback(
    (index: number) => {
      onConfigChange({
        ...config,
        values: config.values.filter((_, i) => i !== index),
      });
    },
    [config, onConfigChange]
  );

  const handleValueAggregationChange = useCallback(
    (index: number, aggregation: AggregationFunction) => {
      const newValues = [...config.values];
      newValues[index] = { ...newValues[index], aggregation };
      onConfigChange({
        ...config,
        values: newValues,
      });
    },
    [config, onConfigChange]
  );

  const handleValueDisplayChange = useCallback(
    (index: number, display: PivotDisplayMode) => {
      const newValues = [...config.values];
      newValues[index] = { ...newValues[index], display };
      onConfigChange({
        ...config,
        values: newValues,
      });
    },
    [config, onConfigChange]
  );

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-green-50 to-blue-50">
        <div className="flex items-center gap-2">
          <Table2 className="h-5 w-5 text-green-600" />
          <span className="font-semibold text-gray-900">Pivot Table Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            title="Refresh pivot table"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3 border-b bg-gray-50">
          <div className="text-xs font-medium text-gray-500 mb-0.5">Source Data</div>
          <div className="text-sm font-medium text-gray-900">{sourceSheetName}</div>
          <div className="text-xs text-gray-500">
            {sourceRowCount} rows × {sourceColumns.length} columns
          </div>
        </div>

        <div className="p-3 space-y-4">
          {/* Rows Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Rows3 className="h-4 w-4 text-[#3CCED7]" />
              <span className="text-sm font-semibold text-gray-700">Rows</span>
            </div>
            <div className="space-y-1.5">
              {config.rows.map((field, index) => (
                <div
                  key={`row-${index}`}
                  className="flex items-center gap-2 p-2 bg-[#3CCED7]/10 rounded border border-[#3CCED7]/20"
                >
                  <span className="flex-1 text-sm text-gray-800 truncate">{field}</span>
                  <button
                    onClick={() => handleRemoveRow(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Select value="__add__" onValueChange={handleAddRow}>
                <SelectTrigger className="w-full h-8 text-sm border-dashed">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add row field</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableFieldsForRows
                    .filter((col) => !config.rows.includes(col.header))
                    .map((col) => (
                      <SelectItem key={col.index} value={col.header}>
                        {col.header}
                      </SelectItem>
                    ))}
                  {availableFieldsForRows.filter((col) => !config.rows.includes(col.header)).length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-gray-500">No fields available</div>
                  )}
                </SelectContent>
              </Select>
              <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-gray-300 text-[#3CCED7] focus:ring-[#3CCED7]"
                  checked={config.showGrandTotalRow ?? true}
                  onChange={handleToggleGrandTotalRow}
                />
                <span>Show grand total row</span>
              </label>
            </div>
          </div>

          {/* Columns Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Columns3 className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold text-gray-700">Columns</span>
              <span className="text-xs text-gray-400">(optional)</span>
            </div>
            <div className="space-y-1.5">
              {normalizedColumns.map((col, index) => (
                <div
                  key={`col-${index}`}
                  className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-100"
                >
                  <span className="flex-1 text-sm text-gray-800 truncate min-w-0">{col.field}</span>
                  <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label={`Sort ${col.field}`}>
                    <button
                      type="button"
                      onClick={() => handleColumnSortChange(index, 'asc')}
                      className={`p-1 rounded transition-colors ${
                        col.sort === 'asc'
                          ? 'text-purple-600 bg-purple-100'
                          : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                      }`}
                      title="Sort ascending"
                    >
                      <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleColumnSortChange(index, 'desc')}
                      className={`p-1 rounded transition-colors ${
                        col.sort === 'desc'
                          ? 'text-purple-600 bg-purple-100'
                          : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                      }`}
                      title="Sort descending"
                    >
                      <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveColumn(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    aria-label={`Remove ${col.field}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Select value="__add__" onValueChange={handleAddColumn}>
                <SelectTrigger className="w-full h-8 text-sm border-dashed">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add column field</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableFieldsForColumns
                    .filter((col) => !columnFields.includes(col.header))
                    .map((col) => (
                      <SelectItem key={col.index} value={col.header}>
                        {col.header}
                      </SelectItem>
                    ))}
                  {availableFieldsForColumns.filter((col) => !columnFields.includes(col.header))
                    .length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-gray-500">No fields available</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Values Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-gray-700">Values</span>
            </div>
            <div className="space-y-1.5">
              {config.values.map((valueConfig, index) => (
                <div
                  key={`val-${index}`}
                  className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-100"
                >
                  <Select
                    value={valueConfig.aggregation}
                    onValueChange={(v) => handleValueAggregationChange(index, v as AggregationFunction)}
                  >
                    <SelectTrigger className="w-20 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGGREGATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={valueConfig.display ?? 'VALUE'}
                    onValueChange={(v) => handleValueDisplayChange(index, v as PivotDisplayMode)}
                  >
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPLAY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="flex-1 text-sm text-gray-800 truncate">of {valueConfig.field}</span>
                  <button
                    onClick={() => handleRemoveValue(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Select value="__add__" onValueChange={handleAddValue}>
                <SelectTrigger className="w-full h-8 text-sm border-dashed">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add value field</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableFieldsForValues
                    .filter((col) => !config.values.some((v) => v.field === col.header))
                    .map((col) => (
                      <SelectItem key={col.index} value={col.header}>
                        {col.header}
                      </SelectItem>
                    ))}
                  {availableFieldsForValues.filter((col) => !config.values.some((v) => v.field === col.header)).length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-gray-500">No fields available</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t bg-gray-50 p-3">
        <div className="text-xs text-gray-500 text-center">
          {config.rows.length === 0 && config.values.length === 0 ? (
            <span className="text-amber-600">Add at least one row and one value field</span>
          ) : config.rows.length === 0 ? (
            <span className="text-amber-600">Add at least one row field</span>
          ) : config.values.length === 0 ? (
            <span className="text-amber-600">Add at least one value field</span>
          ) : (
            <span className="text-green-600">Pivot table will update automatically</span>
          )}
        </div>
      </div>
    </div>
  );
}
