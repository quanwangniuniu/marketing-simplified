'use client';

import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ActionBarVariant } from './types';

export interface ActionSpec {
  label: string;
  variant: ActionBarVariant;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  loading?: boolean;
  icon?: LucideIcon;
}

interface Props {
  actions: ActionSpec[];
  className?: string;
}

const VARIANT_CLASSES: Record<ActionBarVariant, string> = {
  primary:
    'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm hover:opacity-95 disabled:opacity-50',
  ghost:
    'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 disabled:opacity-50',
  danger:
    'bg-white text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50',
};

export default function AdDraftActionBar({ actions, className = '' }: Props) {
  if (actions.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {actions.map((action, index) => {
        const isDisabled = action.disabled || action.loading;
        const Icon = action.icon;

        return (
          <button
            key={`${action.label}-${index}`}
            type="button"
            onClick={action.onClick}
            disabled={isDisabled}
            title={action.title}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed ${VARIANT_CLASSES[action.variant]}`}
          >
            {action.loading ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
            ) : Icon ? (
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : null}
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
