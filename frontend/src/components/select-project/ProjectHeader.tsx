'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function ProjectHeader() {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-white">
      <Link href="/" className="flex items-center">
        <Image
          src="/marketing_simplified_logo.png"
          alt="Marketing Simplified Logo"
          width={170}
          height={80}
          className="h-16 w-auto"
          priority
        />
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">John S.</span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-[#3CCED7]/10 text-[#3CCED7] text-xs font-medium">
            JS
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
