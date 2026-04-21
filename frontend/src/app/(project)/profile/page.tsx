'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  Building2,
  Check,
  ClipboardList,
  Mail,
  MapPin,
  Network,
  Pencil,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import Button from '@/components/button/Button';
import OrganizationContent from '@/components/stripe_meta/OrganizationContent';
import { TextInput } from '@/components/input/InputPrimitives';
import { Skeleton } from '@/components/ui/skeleton';

type ProfileFields = {
  job: string;
  department: string;
  organization: string;
  location: string;
};

type SectionKey = 'dashboard' | 'organization';

const SECTIONS: Array<{ id: SectionKey; label: string }> = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'organization', label: 'Organization' },
];

const getInitials = (name?: string | null): string => {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

function ProfileV2Skeleton() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="p-6 bg-white rounded-lg border border-gray-200 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <div className="flex items-start gap-6 pt-4">
            <div className="w-[30%] min-w-[280px] space-y-4">
              <Skeleton className="h-64 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <Skeleton className="flex-1 h-80 rounded-lg" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ProfileV2Content() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionKey>('dashboard');

  const userAny = user as { job?: string; department?: string; location?: string } | null;
  const [organizationName, setOrganizationName] = useState<string>(
    user?.organization?.name || ''
  );
  const [activeField, setActiveField] = useState<keyof ProfileFields | null>(null);
  const aboutSectionRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<ProfileFields>({
    job: userAny?.job ?? '',
    department: userAny?.department ?? '',
    organization: (organizationName || user?.organization?.name) ?? '',
    location: userAny?.location ?? '',
  });

  const initialValues = useMemo<ProfileFields>(
    () => ({
      job: userAny?.job ?? '',
      department: userAny?.department ?? '',
      organization: (organizationName || user?.organization?.name) ?? '',
      location: userAny?.location ?? '',
    }),
    [
      organizationName,
      user?.organization?.name,
      userAny?.department,
      userAny?.job,
      userAny?.location,
    ]
  );
  const [fields, setFields] = useState<ProfileFields>(initialValues);

  useEffect(() => {
    if (user?.organization?.name) setOrganizationName(user.organization.name);
  }, [user?.organization?.name]);

  useEffect(() => {
    savedRef.current = { ...savedRef.current, ...initialValues };
    setFields((prev) => (activeField ? prev : initialValues));
  }, [activeField, initialValues]);

  const saveField = (field: keyof ProfileFields) => {
    savedRef.current = { ...savedRef.current, [field]: fields[field] };
  };
  const handleSaveActive = () => {
    if (!activeField) return;
    saveField(activeField);
    if (activeField === 'organization') setOrganizationName(fields.organization);
    setActiveField(null);
  };
  const cancelField = (field: keyof ProfileFields) => {
    setFields((prev) => ({ ...prev, [field]: savedRef.current[field] }));
    setActiveField(null);
  };
  const handleCancelActive = () => {
    if (activeField) cancelField(activeField);
  };
  const handleSelectField = (field: keyof ProfileFields) => {
    if (activeField && activeField !== field) saveField(activeField);
    setActiveField(field);
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!activeField) return;
      const target = event.target as Node;
      if (aboutSectionRef.current?.contains(target)) return;
      cancelField(activeField);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeField]);

  const displayName = useMemo(() => {
    if (!user) return 'User';
    const full = [user.first_name as string | undefined, user.last_name as string | undefined]
      .filter(Boolean)
      .join(' ')
      .trim();
    return full || user.username || user.email?.split('@')[0] || 'User';
  }, [user]);

  const primaryRole = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? (user!.roles as string[]) : [];
    return roles[0] ?? null;
  }, [user]);

  const transformUserForOrg = () => {
    if (!user) {
      return {
        username: undefined,
        email: undefined,
        first_name: undefined,
        last_name: undefined,
        organization: null,
        roles: [],
      };
    }
    return {
      username: user.username,
      email: user.email,
      first_name: (user as { first_name?: string }).first_name,
      last_name: (user as { last_name?: string }).last_name,
      organization: user.organization
        ? { id: user.organization.id, name: user.organization.name }
        : null,
      roles: user.roles || [],
    };
  };

  const fieldRows = [
    { key: 'job' as const, icon: Briefcase, label: 'Role', placeholder: 'Add your role' },
    { key: 'department' as const, icon: Network, label: 'Department', placeholder: 'Add your department' },
    { key: 'organization' as const, icon: Building2, label: 'Organization', placeholder: 'Add your organization' },
    { key: 'location' as const, icon: MapPin, label: 'Location', placeholder: 'Add your location' },
  ];

  const renderOverview = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Account
        </h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Display name</div>
            <div className="text-sm text-gray-900">{displayName}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Email</div>
            <div className="text-sm text-gray-900 break-all">{user?.email ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Username</div>
            <div className="text-sm text-gray-900">{user?.username ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Primary role</div>
            <div className="text-sm text-gray-900">{primaryRole ?? '—'}</div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Recent Activity
        </h2>
        <div className="mt-3 rounded-lg border border-dashed border-gray-200 py-10 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <ClipboardList className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No recent activity yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Your recent tasks and decisions will show up here.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Brand header strip (slim, brand gradient) */}
          <div className="h-16 bg-gradient-to-r from-[#3CCED7]/20 via-white to-[#A6E661]/20" />

          <div className="px-8 pb-8">
            {/* Identity header: avatar + name/email, overlaps the strip */}
            <div className="-mt-8 flex items-end justify-between gap-4 flex-wrap">
              <div className="flex items-end gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#3CCED7] to-[#A6E661] flex items-center justify-center shadow-sm ring-4 ring-white">
                  <span className="text-white text-lg font-semibold">{getInitials(displayName)}</span>
                </div>
                <div className="pb-1">
                  <div className="text-lg font-semibold text-gray-900 leading-tight">{displayName}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{user?.email ?? ''}</div>
                </div>
              </div>
              {primaryRole && (
                <span className="inline-flex items-center rounded-full border border-[#3CCED7]/30 bg-[#3CCED7]/5 px-2.5 py-0.5 text-xs font-medium text-[#3CCED7]">
                  {primaryRole}
                </span>
              )}
            </div>

            <div className="mt-8 flex items-start gap-6 w-full">
              {/* LEFT: About + Sign Out */}
              <div className="w-[30%] min-w-[280px] max-w-[380px] flex flex-col gap-3 shrink-0">
                <section className="w-full rounded-lg border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      About
                    </h3>
                    <Pencil className="w-3.5 h-3.5 text-gray-300" aria-hidden />
                  </div>

                  <div ref={aboutSectionRef} className="mt-4 space-y-1">
                    {fieldRows.map(({ key, icon: Icon, label, placeholder }) => {
                      const isActive = activeField === key;
                      const hasValue = !!fields[key]?.trim();
                      return (
                        <div
                          key={key}
                          className={`group rounded-md transition-colors ${
                            isActive ? 'bg-[#3CCED7]/5' : 'hover:bg-gray-50'
                          }`}
                        >
                          {isActive ? (
                            <div className="flex items-center gap-2 p-2">
                              <Icon className="h-4 w-4 text-[#3CCED7] shrink-0" />
                              <TextInput
                                label=""
                                value={fields[key]}
                                placeholder={placeholder}
                                onChange={(e) =>
                                  setFields((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                className="flex-1"
                              />
                              <Button variant="ghost" size="sm" onClick={handleSaveActive} aria-label={`Save ${label}`}>
                                <Check className="h-4 w-4 text-[#3CCED7]" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={handleCancelActive} aria-label={`Cancel ${label}`}>
                                <X className="h-4 w-4 text-gray-400" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectField(key)}
                              className="w-full flex items-center gap-3 px-2 py-2 text-left"
                              aria-label={`Edit ${label}`}
                            >
                              <Icon className="h-4 w-4 text-gray-400 group-hover:text-[#3CCED7] shrink-0 transition-colors" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] uppercase tracking-wider text-gray-400">
                                  {label}
                                </div>
                                <div className={`text-sm truncate ${hasValue ? 'text-gray-900' : 'text-gray-400'}`}>
                                  {fields[key] || placeholder}
                                </div>
                              </div>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Contact</div>
                    <div className="flex items-center gap-3 px-2 py-1.5 text-sm text-gray-700">
                      <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="truncate">{user?.email ?? 'Your email'}</span>
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] text-gray-400 italic">
                    Role / department / location are local-only for now and will not be saved.
                  </p>
                </section>
              </div>

              {/* RIGHT: sections */}
              <div className="flex-1 min-w-0">
                <div className="rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-200">
                    <nav className="flex gap-6 px-5" aria-label="Profile sections">
                      {SECTIONS.map((section) => {
                        const active = activeSection === section.id;
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => setActiveSection(section.id)}
                            className={`py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                              active
                                ? 'border-[#3CCED7] text-[#3CCED7]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                            aria-current={active ? 'page' : undefined}
                          >
                            {section.label}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                  <div className="p-6">
                    {activeSection === 'dashboard' ? renderOverview() : <OrganizationContent user={transformUserForOrg()} />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ProfileV2Page() {
  return (
    <ProtectedRoute loadingComponent={<ProfileV2Skeleton />}>
      <Suspense fallback={<ProfileV2Skeleton />}>
        <ProfileV2Content />
      </Suspense>
    </ProtectedRoute>
  );
}
