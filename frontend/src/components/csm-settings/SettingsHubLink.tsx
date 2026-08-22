'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SECONDARY_BUTTON_CLASS } from './constants';
import { useBuildUrl } from '@/lib/buildUrl';

interface Props {
  projectId: number;
}

export default function SettingsHubLink({ projectId }: Props) {
  const buildUrl = useBuildUrl();
  return (
    <Link
      href={buildUrl('/admin/csm/settings')}
      className={SECONDARY_BUTTON_CLASS}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Settings
    </Link>
  );
}
