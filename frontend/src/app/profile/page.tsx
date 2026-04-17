"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Briefcase,
  Building2,
  Check,
  LogOut,
  Mail,
  MapPin,
  Network,
  X,
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Button from "@/components/button/Button";
import ProfileHeader from "@/components/stripe_meta/ProfileHeader";
import DashboardContent from "@/components/stripe_meta/DashboardContent";
import OrganizationContent from "@/components/stripe_meta/OrganizationContent";
import PlansSection from "@/components/plans/PlansSection";
import { TextInput } from "@/components/input/InputPrimitives";
import { Skeleton } from "@/components/ui/skeleton";

type ProfileFields = {
  job: string;
  department: string;
  organization: string;
  location: string;
};

const PROFILE_SKELETON_DELAY_MS = 2500;

function ProfileValueSkeleton({
  width,
  className = "",
}: {
  width: string;
  className?: string;
}) {
  return <Skeleton className={`h-4 ${width} ${className}`.trim()} />;
}

function ProfilePageSkeleton() {
  return (
    <Layout user={{ name: "", email: "" }}>
      <div className="p-6">
        <div className="space-y-4 profile-header"></div>
        <div className="profile-content rounded-lg">
          <div className="profile-content-wrapper pt-12">
            <div className="profile-content-inner p-6 bg-white rounded-lg shadow-xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 pb-6">
                <section className="relative rounded-lg border border-gray-200 bg-white flex-1 mr-6 overflow-hidden">
                  <div className="h-36 w-full bg-gray-100" />
                  <div className="absolute left-20 top-24">
                    <Skeleton className="h-24 w-24 rounded-full border-4 border-white" />
                  </div>
                  <div className="pb-6 pt-16">
                    <div className="flex items-start justify-between gap-4 pl-20 pr-6">
                      <div className="w-24 text-center">
                        <Skeleton className="mx-auto h-6 w-24" />
                        <Skeleton className="mx-auto mt-2 h-4 w-32" />
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-6 flex items-start gap-6 w-full">
                <div className="w-[30%] min-w-[280px] max-w-[420px] flex flex-col gap-4 shrink-0">
                  <section className="w-full space-y-4 rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="text-lg font-semibold text-gray-900">About</h3>
                    <div className="space-y-3 text-sm text-gray-700">
                      <div className="flex items-center gap-3 p-2">
                        <Briefcase className="h-4 w-4 text-gray-500 shrink-0" />
                        <ProfileValueSkeleton width="w-32" />
                      </div>
                      <div className="flex items-center gap-3 p-2">
                        <Network className="h-4 w-4 text-gray-500 shrink-0" />
                        <ProfileValueSkeleton width="w-36" />
                      </div>
                      <div className="flex items-center gap-3 p-2">
                        <Building2 className="h-4 w-4 text-gray-500 shrink-0" />
                        <ProfileValueSkeleton width="w-40" />
                      </div>
                      <div className="flex items-center gap-3 p-2">
                        <MapPin className="h-4 w-4 text-gray-500 shrink-0" />
                        <ProfileValueSkeleton width="w-28" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">
                        Contact
                      </h4>
                      <div className="mt-2 flex items-center gap-3 text-sm text-gray-700 p-2">
                        <Mail className="h-4 w-4 text-gray-500 shrink-0" />
                        <ProfileValueSkeleton width="w-40" />
                      </div>
                    </div>
                  </section>

                  <button
                    disabled
                    className="flex items-center gap-3 w-full p-3 text-sm font-medium text-red-600 rounded-lg border border-gray-200 bg-white opacity-70"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>

                <div className="flex flex-col gap-6 flex-1 min-w-0">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="border-b border-gray-200 mb-4">
                      <nav className="-mb-px flex gap-6">
                        <button
                          type="button"
                          className="pb-3 text-sm font-medium border-b-2 border-blue-500 text-blue-600"
                        >
                          Dashboard
                        </button>
                        <button
                          type="button"
                          className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500"
                        >
                          My Organization
                        </button>
                        <button
                          type="button"
                          className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500"
                        >
                          Subscription
                        </button>
                      </nav>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold">Dashboard</div>
                        <div className="text-sm text-gray-500">
                          <span className="inline-flex items-center gap-2">
                            <span>Last updated:</span>
                            <Skeleton className="h-4 w-20" />
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={`profile-skeleton-card-${index}`}
                            className="border border-gray-200 rounded-xl p-6"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <Skeleton className="h-6 w-28" />
                            </div>
                            <div className="space-y-3">
                              <Skeleton className="h-10 w-full rounded-lg" />
                              <Skeleton className="h-10 w-full rounded-lg" />
                              <Skeleton className="h-10 w-full rounded-lg" />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border border-gray-200 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-lg font-semibold text-gray-800">
                            Recent Activity
                          </div>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" />
                        </div>
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg
                              className="w-8 h-8 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              />
                            </svg>
                          </div>
                          <p className="text-gray-500 text-sm">
                            No recent activity to display
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ProfilePageContent() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");

  const userAny = user as {
    job?: string;
    department?: string;
    location?: string;
  } | null;
  const [organizationName, setOrganizationName] = useState<string>(
    user?.organization?.name || "",
  );
  const [activeField, setActiveField] = useState<keyof ProfileFields | null>(
    null,
  );
  const aboutSectionRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<ProfileFields>({
    job: userAny?.job ?? "Your job title",
    department: userAny?.department ?? "Your department",
    organization:
      (organizationName || user?.organization?.name) ?? "Your organization",
    location: userAny?.location ?? "Your location",
  });

  const initialValues = useMemo<ProfileFields>(
    () => ({
      job: userAny?.job ?? "Your job title",
      department: userAny?.department ?? "Your department",
      organization:
        (organizationName || user?.organization?.name) ?? "Your organization",
      location: userAny?.location ?? "Your location",
    }),
    [
      organizationName,
      user?.organization?.name,
      userAny?.department,
      userAny?.job,
      userAny?.location,
    ],
  );
  const [fields, setFields] = useState<ProfileFields>(initialValues);

  useEffect(() => {
    if (user?.organization?.name) {
      setOrganizationName(user.organization.name);
    }
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
    if (activeField === "organization") {
      setOrganizationName(fields.organization);
    }
    setActiveField(null);
  };

  const cancelField = (field: keyof ProfileFields) => {
    setFields((prev) => ({ ...prev, [field]: savedRef.current[field] }));
    setActiveField(null);
  };

  const handleCancelActive = () => {
    if (!activeField) return;
    cancelField(activeField);
  };

  const handleSelectField = (field: keyof ProfileFields) => {
    if (activeField && activeField !== field) {
      saveField(activeField);
    }
    setActiveField(field);
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!activeField) return;
      const target = event.target as Node;
      if (aboutSectionRef.current?.contains(target)) return;
      cancelField(activeField);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activeField]);

  const layoutUser = user
    ? {
        name: user.username || "User",
        email: user.email || "",
        roles: user.roles || [],
        avatar: (user as { avatar?: string }).avatar || undefined,
        first_name: (user as { first_name?: string }).first_name || "",
        last_name: (user as { last_name?: string }).last_name || "",
      }
    : undefined;

  const handleUserAction = async (action: string) => {
    if (action === "settings") {
      router.push("/profile/settings");
    } else if (action === "logout") {
      await logout();
    }
  };

  const handleEditProfile = () => {
    // Current implementation uses inline editing for individual fields
    // This handler can be expanded for a modal-based editing if needed
    console.log("Edit profile clicked");
  };

  const handleProfileUpdate = async () => {
    // Refresh user data after profile update
    await refreshUser();
  };

  const transformUserForProfileHeader = () => {
    if (!user) {
      return {
        username: undefined,
        email: undefined,
        avatar: undefined,
        first_name: undefined,
        last_name: undefined,
      };
    }
    return {
      username: user.username,
      email: user.email,
      avatar: (user as { avatar?: string }).avatar,
      first_name: (user as { first_name?: string }).first_name,
      last_name: (user as { last_name?: string }).last_name,
    };
  };

  const transformUserForComponents = () => {
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
        ? {
            id: user.organization.id,
            name: user.organization.name,
          }
        : null,
      roles: user.roles || [],
    };
  };

  const renderContent = () => {
    const transformedUser = transformUserForComponents();
    switch (activeTab) {
      case "dashboard":
        return <DashboardContent user={transformedUser} />;
      case "organization":
        return <OrganizationContent user={transformedUser} />;
      case "subscription":
        return (
          <div className="bg-white rounded-lg">
            <PlansSection showHeader={false} />
          </div>
        );
      default:
        return <DashboardContent user={transformedUser} />;
    }
  };

  return (
    <Layout user={layoutUser} onUserAction={handleUserAction}>
      <div className="p-6">
        <div className="space-y-4 profile-header"></div>
        <div className="profile-content rounded-lg">
          <div className="profile-content-wrapper pt-12">
            <div className="profile-content-inner p-6 bg-white rounded-lg shadow-xl border border-gray-200">
              {/* Header */}
              <ProfileHeader
                user={transformUserForProfileHeader()}
                onEditClick={handleEditProfile}
              />

              {/* Two columns: left sidebar (About + Contact) + right (tabs content) */}
              <div className="mt-6 flex items-start gap-6 w-full">
                {/* Left: About + Contact - ~30% */}
                <div className="w-[30%] min-w-[280px] max-w-[420px] flex flex-col gap-4 shrink-0">
                  <section className="w-full space-y-4 rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      About
                    </h3>
                    <div
                      ref={aboutSectionRef}
                      className="space-y-3 text-sm text-gray-700"
                    >
                      <div className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-gray-100 transition-colors duration-150">
                        <Briefcase className="h-4 w-4 text-gray-500 shrink-0" />
                        {activeField === "job" ? (
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <TextInput
                              label=""
                              value={fields.job}
                              placeholder="Your job title"
                              onChange={(e) =>
                                setFields((prev) => ({
                                  ...prev,
                                  job: e.target.value,
                                }))
                              }
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSaveActive}
                              aria-label="Save job title"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelActive}
                              aria-label="Cancel job title"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectField("job")}
                            className="rounded-md px-2 py-1 text-left flex-1"
                            aria-label="Edit job title"
                          >
                            {fields.job || "Your job title"}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-gray-100 transition-colors duration-150">
                        <Network className="h-4 w-4 text-gray-500 shrink-0" />
                        {activeField === "department" ? (
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <TextInput
                              label=""
                              value={fields.department}
                              placeholder="Your department"
                              onChange={(e) =>
                                setFields((prev) => ({
                                  ...prev,
                                  department: e.target.value,
                                }))
                              }
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSaveActive}
                              aria-label="Save department"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelActive}
                              aria-label="Cancel department"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectField("department")}
                            className="rounded-md px-2 py-1 text-left flex-1"
                            aria-label="Edit department"
                          >
                            {fields.department || "Your department"}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-gray-100 transition-colors duration-150">
                        <Building2 className="h-4 w-4 text-gray-500 shrink-0" />
                        {activeField === "organization" ? (
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <TextInput
                              label=""
                              value={fields.organization}
                              placeholder="Your organization"
                              onChange={(e) =>
                                setFields((prev) => ({
                                  ...prev,
                                  organization: e.target.value,
                                }))
                              }
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSaveActive}
                              aria-label="Save organization"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelActive}
                              aria-label="Cancel organization"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectField("organization")}
                            className="rounded-md px-2 py-1 text-left flex-1"
                            aria-label="Edit organization"
                          >
                            {fields.organization || "Your organization"}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-gray-100 transition-colors duration-150">
                        <MapPin className="h-4 w-4 text-gray-500 shrink-0" />
                        {activeField === "location" ? (
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <TextInput
                              label=""
                              value={fields.location}
                              placeholder="Your location"
                              onChange={(e) =>
                                setFields((prev) => ({
                                  ...prev,
                                  location: e.target.value,
                                }))
                              }
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSaveActive}
                              aria-label="Save location"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelActive}
                              aria-label="Cancel location"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectField("location")}
                            className="rounded-md px-2 py-1 text-left flex-1"
                            aria-label="Edit location"
                          >
                            {fields.location || "Your location"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">
                        Contact
                      </h4>
                      <div className="mt-2 flex items-center gap-3 text-sm text-gray-700 p-2 -mx-2 rounded-md hover:bg-gray-100 transition-colors duration-150">
                        <Mail className="h-4 w-4 text-gray-500 shrink-0" />
                        <span>{user?.email ?? "Your email"}</span>
                      </div>
                    </div>
                  </section>
                  {/* Sign Out Button */}
                  <button
                    onClick={async () => {
                      await logout();
                      router.push("/login");
                    }}
                    className="flex items-center gap-3 w-full p-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 bg-white transition-colors duration-200"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>

                {/* Right: Tabs + Dashboard / Organization / Subscription - ~70% */}
                <div className="flex flex-col gap-6 flex-1 min-w-0">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="border-b border-gray-200 mb-4">
                      <nav className="-mb-px flex gap-6">
                        {[
                          { id: "dashboard", label: "Dashboard" },
                          { id: "organization", label: "My Organization" },
                          { id: "subscription", label: "Subscription" },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-3 text-sm font-medium border-b-2 ${
                              activeTab === tab.id
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </nav>
                    </div>
                    {renderContent()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function DelayedProfilePageContent() {
  const [showDelayedSkeleton, setShowDelayedSkeleton] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowDelayedSkeleton(false);
    }, PROFILE_SKELETON_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (showDelayedSkeleton) {
    return <ProfilePageSkeleton />;
  }

  return <ProfilePageContent />;
}

export default function ProfilePage() {
  return (
    <ProtectedRoute loadingComponent={<ProfilePageSkeleton />}>
      <DelayedProfilePageContent />
    </ProtectedRoute>
  );
}
