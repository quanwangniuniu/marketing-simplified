'use client';

import { Image as ImageIcon, Video, LayoutGrid, Grid3x3, Mail } from 'lucide-react';
import type { CreativeType } from '@/types/adVariation';

interface Props {
  value: CreativeType;
  onChange: (value: CreativeType) => void;
}

const TYPES: { value: CreativeType; label: string; Icon: typeof ImageIcon }[] = [
  { value: 'image', label: 'Image', Icon: ImageIcon },
  { value: 'video', label: 'Video', Icon: Video },
  { value: 'carousel', label: 'Carousel', Icon: LayoutGrid },
  { value: 'collection', label: 'Collection', Icon: Grid3x3 },
  { value: 'email', label: 'Email', Icon: Mail },
];

export default function CreativeTypePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TYPES.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition ${
              active
                ? 'border-transparent bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                : 'border-transparent bg-gray-100 text-gray-700 hover:border-[#3CCED7]/40 hover:bg-white'
            }`}
          >
            <t.Icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
