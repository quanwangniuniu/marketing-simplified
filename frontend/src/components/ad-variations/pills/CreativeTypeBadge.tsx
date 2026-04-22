'use client';

import { Image as ImageIcon, Video, LayoutGrid, Grid3x3, Mail } from 'lucide-react';
import type { CreativeType } from '@/types/adVariation';

interface Props {
  type: CreativeType;
  className?: string;
}

const META: Record<CreativeType, { label: string; Icon: typeof ImageIcon; classes: string }> = {
  image: {
    label: 'Image',
    Icon: ImageIcon,
    classes: 'bg-slate-50 text-slate-700 ring-1 ring-slate-200',
  },
  video: {
    label: 'Video',
    Icon: Video,
    classes: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  },
  carousel: {
    label: 'Carousel',
    Icon: LayoutGrid,
    classes: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  },
  collection: {
    label: 'Collection',
    Icon: Grid3x3,
    classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  email: {
    label: 'Email',
    Icon: Mail,
    classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
};

export default function CreativeTypeBadge({ type, className = '' }: Props) {
  const meta = META[type];
  if (!meta) return null;
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.classes} ${className}`}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
