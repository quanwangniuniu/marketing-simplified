'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/button/Button';
import UserAvatar from '@/people/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfileHeaderProps {
  readonly user: {
    username?: string;
    email?: string;
    avatar?: string;
    first_name?: string;
    last_name?: string;
  };
  readonly onEditClick: () => void;
  readonly loading?: boolean;
}

export default function ProfileHeader({
  user,
  onEditClick,
  loading = false,
}: ProfileHeaderProps) {
  const [cover, setCover] = useState('/bg-gradient.svg');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverObjectUrl = useRef<string | null>(null);
  const avatarObjectUrl = useRef<string | null>(null);

  const displayName = user?.first_name && user?.last_name
    ? `${user.first_name} ${user.last_name}`
    : user?.username || 'User';

  const handleCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (coverObjectUrl.current) URL.revokeObjectURL(coverObjectUrl.current);
    const nextUrl = URL.createObjectURL(file);
    coverObjectUrl.current = nextUrl;
    setCover(nextUrl);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (avatarObjectUrl.current) URL.revokeObjectURL(avatarObjectUrl.current);
    const nextUrl = URL.createObjectURL(file);
    avatarObjectUrl.current = nextUrl;
    setAvatarUrl(nextUrl);
  };

  return (
    <div className="flex items-center justify-between border-b border-gray-200 pb-6">
      <section className="rounded-lg border border-gray-200 bg-white flex-1 mr-6">
        <div className="relative group">
          <div className="overflow-hidden rounded-t-lg">
            <div className="h-36 w-full bg-cover bg-center" style={{ backgroundImage: `url(${cover})` }} />
            <div className="pointer-events-none absolute inset-0 rounded-t-lg bg-black/0 transition-colors duration-200 group-hover:bg-black/30" />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => coverInputRef.current?.click()}
            disabled={loading}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent text-white opacity-0 transition-opacity duration-200 hover:bg-white/10 group-hover:opacity-100"
          >
            Change cover
          </Button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverChange}
            className="hidden"
          />

          <div className="absolute left-20 -bottom-12 flex items-end gap-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={loading}
              className="relative rounded-full border-4 border-white bg-gray-100 shadow-md disabled:cursor-default"
              aria-label="Change avatar"
            >
              {loading ? (
                <Skeleton className="h-24 w-24 rounded-full" />
              ) : (
                <UserAvatar
                  user={{ name: displayName, avatar: avatarUrl || user?.avatar, email: user?.email }}
                  size="xl"
                  className="h-24 w-24 text-4xl"
                />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
        </div>

        <div className="pb-6 pt-16">
          <div className="flex items-start justify-between gap-4 pl-20 pr-6">
            <div className="w-24 text-center">
              {loading ? (
                <>
                  <Skeleton className="mx-auto h-6 w-24" />
                  <Skeleton className="mx-auto mt-2 h-4 w-32" />
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-gray-900 truncate">{displayName}</p>
                  {user?.email && (
                    <p className="text-sm text-gray-500 mt-1">{user.email}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

// Simple page header (back link + title) - exported for reuse
export function PageHeader({ title, backHref = '/tasks' }: { title: string; backHref?: string }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center space-x-4">
        <Link href={backHref} className="text-indigo-600 hover:text-indigo-800 font-medium">
          ← Back to Tasks
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>
    </div>
  );
}
