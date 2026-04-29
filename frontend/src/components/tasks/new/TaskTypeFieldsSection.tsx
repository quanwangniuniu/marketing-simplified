'use client';

import { useEffect, useState } from 'react';
import type { FieldDef, FieldOption, TypeSchema } from '@/lib/tasks/typeFieldSchemas';
import { loadFieldOptions } from '@/lib/tasks/typeFieldOptions';

interface Props {
  schema: TypeSchema;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export const fieldId = (schemaType: string, key: string) =>
  `task-field-${schemaType}-${key}`;

export default function TaskTypeFieldsSection({ schema, values, onChange }: Props) {
  const [optionsByKey, setOptionsByKey] = useState<Record<string, FieldOption[]>>({});

  useEffect(() => {
    let cancelled = false;
    const loaderKeys = new Set<string>();
    schema.fields.forEach((f) => {
      if (f.optionsLoader) loaderKeys.add(f.optionsLoader);
    });
    (async () => {
      const entries = await Promise.all(
        Array.from(loaderKeys).map(async (key) => [key, await loadFieldOptions(key)] as const),
      );
      if (cancelled) return;
      const next: Record<string, FieldOption[]> = {};
      for (const [loaderKey, opts] of entries) {
        for (const f of schema.fields) {
          if (f.optionsLoader === loaderKey) next[f.key] = opts;
        }
      }
      setOptionsByKey(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [schema]);

  return (
    <div className="space-y-5">
      {schema.fields.map((field) => (
        <FieldRow
          key={field.key}
          schemaType={schema.type}
          field={field}
          value={values[field.key] ?? ''}
          options={field.options ?? optionsByKey[field.key] ?? []}
          onChange={(v) => onChange(field.key, v)}
        />
      ))}
    </div>
  );
}

const INPUT_BASE =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30';

function FieldRow({
  schemaType,
  field,
  value,
  options,
  onChange,
}: {
  schemaType: string;
  field: FieldDef;
  value: string;
  options: FieldOption[];
  onChange: (v: string) => void;
}) {
  const id = fieldId(schemaType, field.key);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-gray-500">
        {field.label}
        {field.required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {renderControl(id, field, value, options, onChange)}
      {field.helpText && (
        <p className="mt-1 text-[11px] text-gray-400">{field.helpText}</p>
      )}
    </div>
  );
}

function renderControl(
  id: string,
  field: FieldDef,
  value: string,
  options: FieldOption[],
  onChange: (v: string) => void,
) {
  switch (field.kind) {
    case 'textarea':
      return (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows ?? 3}
          className={`${INPUT_BASE} resize-y`}
        />
      );
    case 'select':
      return (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_BASE}
        >
          <option value="" disabled>
            {field.placeholder ?? 'Select…'}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case 'date':
      return (
        <input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_BASE}
        />
      );
    case 'url':
      return (
        <input
          id={id}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={INPUT_BASE}
        />
      );
    case 'number':
      return (
        <input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={INPUT_BASE}
        />
      );
    case 'tags':
      return (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={2}
          className={`${INPUT_BASE} resize-y`}
        />
      );
    case 'text':
    default:
      return (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={INPUT_BASE}
        />
      );
  }
}
