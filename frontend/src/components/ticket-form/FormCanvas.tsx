'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useBuildUrl } from '@/lib/buildUrl';
import type { BuilderFieldRow } from '@/types/ticketForm';
import SortableFieldRow from './SortableFieldRow';
import FormFieldError from './FormFieldError';
import FormCanvasMenu from './FormCanvasMenu';
import {
  BUILDER_FIELD_ROW_SELECTED_DIVIDER_CLASS,
  CANVAS_CUSTOM_DROP_ID,
  rowErrorKey,
} from './constants';

interface Props {
  formId: number | string;
  projectId: number;
  formName: string;
  formDescription: string;
  onFormNameChange: (name: string) => void;
  onFormDescriptionChange: (description: string) => void;
  onSaveMetadata: () => void;
  rows: BuilderFieldRow[];
  selectedFieldKey: string | null;
  onSelectField: (fieldKey: string) => void;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  fieldErrors: Record<string, string>;
  saving: boolean;
  isPaletteDragActive: boolean;
  onPatchRow: (clientId: string, patch: Partial<BuilderFieldRow>) => void;
  onRemoveRow: (clientId: string) => void;
  onSaveForm: () => void;
  onDeleteForm: () => void;
}

function FieldsDropZone({
  children,
  isPaletteDragActive,
}: {
  children: React.ReactNode;
  isPaletteDragActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_CUSTOM_DROP_ID });

  return (
    <div
      ref={setNodeRef}
      className={`-mx-4 flex min-h-[48px] flex-col sm:-mx-8 ${
        isPaletteDragActive && isOver ? 'bg-[#3CCED7]/5 ring-2 ring-[#3CCED7]/30' : ''
      }`}
    >
      {children}
    </div>
  );
}

export default function FormCanvas({
  formId,
  projectId,
  formName,
  formDescription,
  onFormNameChange,
  onFormDescriptionChange,
  onSaveMetadata,
  rows,
  selectedFieldKey,
  onSelectField,
  rowRefs,
  fieldErrors,
  saving,
  isPaletteDragActive,
  onPatchRow,
  onRemoveRow,
  onSaveForm,
  onDeleteForm,
}: Props) {
  const buildUrl = useBuildUrl();
  const assignmentsHref = buildUrl(`/admin/ticket-forms/${formId}/assignments`);
  const titleInputClass =
    'mt-2 w-full border-0 bg-transparent p-0 text-xl font-semibold leading-tight text-gray-900 outline-none placeholder:text-gray-300 focus:border-b-2 focus:border-[#3CCED7] sm:text-[22px]';

  const descriptionInputClass =
    'mt-3 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-gray-700 outline-none placeholder:text-gray-300';

  const firstRowKey = rows[0] ? rowErrorKey(rows[0]) : null;
  const firstRowSelected = firstRowKey !== null && selectedFieldKey === firstRowKey;

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <div
        className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]"
        aria-hidden
      />

      <div className="relative px-4 pb-2 pt-5 sm:px-8 sm:pt-7">
        <div className="absolute right-4 top-4 z-10 sm:right-8 sm:top-7">
          <FormCanvasMenu
            assignmentsHref={assignmentsHref}
            saving={saving}
            onSaveForm={onSaveForm}
            onDeleteForm={onDeleteForm}
          />
        </div>

        <input
          value={formName}
          onChange={(e) => onFormNameChange(e.target.value)}
          onBlur={onSaveMetadata}
          className={titleInputClass}
          placeholder="Form title"
          aria-label="Form title"
        />
        <textarea
          value={formDescription}
          onChange={(e) => onFormDescriptionChange(e.target.value)}
          onBlur={onSaveMetadata}
          rows={2}
          className={descriptionInputClass}
          placeholder="Description (optional)"
          aria-label="Form description"
        />
      </div>

      <div
        className={`my-2 border-t ${
          firstRowSelected ? BUILDER_FIELD_ROW_SELECTED_DIVIDER_CLASS : 'border-gray-100'
        }`}
      />

      <div className="px-4 sm:px-8">
        <FieldsDropZone isPaletteDragActive={isPaletteDragActive}>
          <SortableContext
            items={rows.map((r) => r.clientId)}
            strategy={verticalListSortingStrategy}
          >
            {rows.length === 0 && (
              <p className="px-4 py-5 text-sm italic text-gray-400 sm:px-8">
                Drag a field from the palette to add it to the form.
              </p>
            )}
            {rows.map((row, index) => {
              const fieldKey = rowErrorKey(row);
              const prevKey = index > 0 ? rowErrorKey(rows[index - 1]) : null;
              return (
                <SortableFieldRow
                  key={row.clientId}
                  row={row}
                  onChange={onPatchRow}
                  onRemove={row.isSystem ? undefined : onRemoveRow}
                  onSelect={() => onSelectField(fieldKey)}
                  error={fieldErrors[fieldKey]}
                  selected={selectedFieldKey === fieldKey}
                  isFirst={index === 0}
                  prevSelected={prevKey !== null && selectedFieldKey === prevKey}
                  rowRef={(el) => {
                    rowRefs.current[fieldKey] = el;
                  }}
                />
              );
            })}
          </SortableContext>
        </FieldsDropZone>

        <FormFieldError message={fieldErrors.fields} />
      </div>
    </div>
  );
}
