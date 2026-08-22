'use client';

import Link from 'next/link';
import { useBuildUrl } from '@/lib/buildUrl';
import type { TicketFormField, FormOptionsHint } from '@/types/ticketForm';
import { BUILDER_CONTROL_CLASS, MAX_FILE_SIZE_MB, PORTAL_INPUT_CLASS } from './constants';
import FormFieldCard from './FormFieldCard';
import PortalFieldGroup from './portal/PortalFieldGroup';
import PortalSelect, { type PortalSelectOption } from './portal/PortalSelect';
import PortalMultiSelect from './portal/PortalMultiSelect';
import PortalDatePicker from './portal/PortalDatePicker';
import PortalFileAttachment from './portal/PortalFileAttachment';
import FileAttachmentField from './FileAttachmentField';
import LabelsField from './LabelsField';
import PeopleFieldPicker from './PeopleFieldPicker';

export type DynamicFormFieldVariant = 'default' | 'portal';

interface Props {
  field: TicketFormField;
  value: string;
  numberValue: string;
  values: string[];
  peopleIds: number[];
  files: File[];
  maxTotalFiles: number;
  options: FormOptionsHint;
  projectId?: number;
  error?: string;
  disabled?: boolean;
  variant?: DynamicFormFieldVariant;
  onTextChange: (v: string) => void;
  onNumberChange: (v: string) => void;
  onMultiChange: (v: string[]) => void;
  onPeopleChange: (ids: number[]) => void;
  onFilesChange: (files: File[]) => void;
  onFileSizeError?: (message: string | null) => void;
}

export default function DynamicFormField({
  field,
  value,
  numberValue,
  values,
  peopleIds,
  files,
  maxTotalFiles,
  options,
  projectId,
  error,
  disabled,
  variant = 'default',
  onTextChange,
  onNumberChange,
  onMultiChange,
  onPeopleChange,
  onFilesChange,
  onFileSizeError,
}: Props) {
  const buildUrl = useBuildUrl();
  const inputId = `field-${field.field_key}`;
  const config = field.field_config ?? {};
  const inputClass = variant === 'portal' ? PORTAL_INPUT_CLASS : BUILDER_CONTROL_CLASS;
  const isPortal = variant === 'portal';

  const wrap = (children: React.ReactNode) =>
    isPortal ? (
      <PortalFieldGroup field={field} error={error}>
        {children}
      </PortalFieldGroup>
    ) : (
      <FormFieldCard field={field} error={error}>
        {children}
      </FormFieldCard>
    );

  const renderSelect = (selectOptions: PortalSelectOption[]) => {
    if (isPortal) {
      return (
        <PortalSelect
          id={inputId}
          value={value}
          disabled={disabled}
          options={selectOptions}
          onChange={onTextChange}
        />
      );
    }

    return (
      <select
        id={inputId}
        value={value}
        disabled={disabled}
        onChange={(e) => onTextChange(e.target.value)}
        className={inputClass}
      >
        <option value="">Select...</option>
        {selectOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  switch (field.field_type) {
    case 'system_summary':
    case 'short_text':
      return wrap(
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={disabled}
          maxLength={config.max_length ?? 255}
          onChange={(e) => onTextChange(e.target.value)}
          className={inputClass}
        />,
      );

    case 'system_description':
    case 'paragraph':
      return wrap(
        <textarea
          id={inputId}
          value={value}
          disabled={disabled}
          rows={4}
          onChange={(e) => onTextChange(e.target.value)}
          className={`${inputClass} resize-none`}
        />,
      );

    case 'timestamp':
      return wrap(
        <input
          id={inputId}
          type="datetime-local"
          value={value}
          disabled={disabled}
          onChange={(e) => onTextChange(e.target.value)}
          className={inputClass}
        />,
      );

    case 'system_project':
      return wrap(
        options.support_projects.length === 0 ? (
          <div>
            <p className="text-xs italic text-gray-400">No support projects configured.</p>
            {projectId ? (
              <Link
                href={buildUrl("/admin/csm/settings/support-projects")}
                className="text-xs text-indigo-600 hover:underline not-italic"
              >
                Configure in Settings
              </Link>
            ) : null}
          </div>
        ) : (
          renderSelect(
            options.support_projects.map((p) => ({
              value: String(p.id),
              label: p.name,
            })),
          )
        ),
      );

    case 'system_work_type':
      return wrap(
        options.work_types.length === 0 ? (
          <div>
            <p className="text-xs italic text-gray-400">No work types configured.</p>
            {projectId ? (
              <Link
                href={buildUrl("/admin/csm/settings/work-types")}
                className="text-xs text-indigo-600 hover:underline not-italic"
              >
                Configure in Settings
              </Link>
            ) : null}
          </div>
        ) : (
          renderSelect(
            options.work_types.map((w) => ({
              value: String(w.id),
              label: w.name,
            })),
          )
        ),
      );

    case 'dropdown':
      return wrap(
        renderSelect(
          (field.options ?? []).map((opt) => ({
            value: opt.value,
            label: opt.label,
          })),
        ),
      );

    case 'labels':
      return wrap(
        <LabelsField
          options={field.options ?? []}
          selected={values}
          disabled={disabled}
          onChange={onMultiChange}
        />,
      );

    case 'checkbox':
      if (isPortal) {
        return wrap(
          <PortalMultiSelect
            id={inputId}
            values={values}
            disabled={disabled}
            options={(field.options ?? []).map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
            onChange={onMultiChange}
          />,
        );
      }

      return wrap(
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {(field.options ?? []).map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    const next = checked
                      ? values.filter((v) => v !== opt.value)
                      : [...values, opt.value];
                    onMultiChange(next);
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>,
      );

    case 'date':
      if (isPortal) {
        return wrap(
          <PortalDatePicker
            id={inputId}
            value={value}
            disabled={disabled}
            onChange={onTextChange}
          />,
        );
      }

      return wrap(
        <input
          id={inputId}
          type="date"
          value={value}
          disabled={disabled}
          onChange={(e) => onTextChange(e.target.value)}
          className={inputClass}
        />,
      );

    case 'number':
      return wrap(
        <input
          id={inputId}
          type="number"
          value={numberValue}
          disabled={disabled}
          min={config.min ?? undefined}
          max={config.max ?? undefined}
          step={config.integer_only ? 1 : 'any'}
          onChange={(e) => onNumberChange(e.target.value)}
          className={inputClass}
        />,
      );

    case 'people':
      return wrap(
        <PeopleFieldPicker
          members={options.project_members ?? []}
          allowMultiple={Boolean(config.allow_multiple)}
          selectedIds={peopleIds}
          disabled={disabled}
          onChange={onPeopleChange}
        />,
      );

    case 'url':
      return wrap(
        <input
          id={inputId}
          type="url"
          value={value}
          disabled={disabled}
          placeholder="https://"
          onChange={(e) => onTextChange(e.target.value)}
          className={inputClass}
        />,
      );

    case 'file':
      return wrap(
        isPortal ? (
          <PortalFileAttachment
            inputId={inputId}
            files={files}
            disabled={disabled}
            maxTotalFiles={maxTotalFiles}
            maxFileSizeMb={field.max_file_size_mb ?? MAX_FILE_SIZE_MB}
            onChange={onFilesChange}
            onSizeError={onFileSizeError}
          />
        ) : (
          <FileAttachmentField
            embedded
            inputId={inputId}
            files={files}
            disabled={disabled}
            maxTotalFiles={maxTotalFiles}
            onChange={onFilesChange}
          />
        ),
      );

    default:
      return null;
  }
}
