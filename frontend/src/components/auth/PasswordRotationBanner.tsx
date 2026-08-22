'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/authStore';
import { authApi } from '@/lib/api/authApi';
import type { PasswordRotationStatus } from '@/types/auth';

export default function PasswordRotationBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const storePasswordRotation = useAuthStore((state) => state.user?.password_rotation);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);
  const [fetchedPasswordRotation, setFetchedPasswordRotation] = useState<PasswordRotationStatus | null>(null);
  const [hasFetchedLatestStatus, setHasFetchedLatestStatus] = useState(false);
  const passwordRotation = storePasswordRotation ?? fetchedPasswordRotation;

  useEffect(() => {
    if ((!isAuthenticated && !user) || hasFetchedLatestStatus) {
      return;
    }

    let cancelled = false;
    setHasFetchedLatestStatus(true);

    authApi
      .getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        setUser(user);
        setFetchedPasswordRotation(user.password_rotation ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedPasswordRotation(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasFetchedLatestStatus, isAuthenticated, setUser, user]);

  useEffect(() => {
    if (passwordRotation?.required && pathname !== '/set-password') {
      router.replace('/set-password?rotation=1');
    }
  }, [passwordRotation?.required, pathname, router]);

  if (!passwordRotation?.warning || passwordRotation.required) {
    return null;
  }

  const days = passwordRotation.days_until_expiry ?? passwordRotation.warning_days;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-900">
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span className="truncate">
          Your elevated account password expires in {days} {days === 1 ? 'day' : 'days'}.
        </span>
      </div>
      <button
        type="button"
        onClick={() => router.push('/set-password?rotation=1')}
        className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
      >
        Change password
      </button>
    </div>
  );
}
