'use client';

interface Props {
  kind?: 'normal' | 'pivot' | null;
  className?: string;
}

const STYLES: Record<'normal' | 'pivot', { label: string; classes: string }> = {
  normal: {
    label: 'Normal',
    classes: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200',
  },
  pivot: {
    label: 'Pivot',
    classes: 'bg-[#3CCED7]/10 text-[#0E8A96] ring-1 ring-[#3CCED7]/30',
  },
};

export default function SheetKindPill({ kind, className = '' }: Props) {
  const meta = STYLES[kind === 'pivot' ? 'pivot' : 'normal'];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.classes} ${className}`}
    >
      {meta.label}
    </span>
  );
}
