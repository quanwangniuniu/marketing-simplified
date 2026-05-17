'use client';

import { Plus } from 'lucide-react';

interface Props {
  onCreate: () => void;
  canCreate: boolean;
}

export default function DecisionsEmptyState({ onCreate, canCreate }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16">
      <h3 className="text-base font-semibold text-gray-900">No decisions yet</h3>
      <p className="mt-1 max-w-md text-sm text-gray-500">
        Create your first decision to map context, options, signals, and outcomes into a traceable tree.
      </p>
      {canCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Create your first decision
        </button>
      )}
    </div>
  );
}
