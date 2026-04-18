'use client';

import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

export default function CreateProjectCard() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push('/onboarding')}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border-[1.5px] border-dashed border-gray-300 hover:border-[#3CCED7]/50 bg-gray-50/50 hover:bg-[#3CCED7]/5 transition-all duration-200 p-5 min-h-[220px] cursor-pointer group"
    >
      <div className="w-10 h-10 rounded-full border-[1.5px] border-dashed border-gray-300 group-hover:border-[#3CCED7]/50 flex items-center justify-center transition-colors">
        <Plus className="w-5 h-5 text-gray-400 group-hover:text-[#3CCED7] transition-colors" />
      </div>
      <span className="text-sm font-medium text-gray-400 group-hover:text-[#3CCED7] transition-colors">
        New Project
      </span>
    </button>
  );
}
