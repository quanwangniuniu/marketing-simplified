'use client';

export default function TypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
      {type}
    </span>
  );
}
