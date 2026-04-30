"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonView from "@/components/meta-ads/ComparisonView";

const ALLOWED_DAYS = [1, 2, 3, 7, 14, 28, 30] as const;
const MIN_IDS = 2;
const MAX_IDS = 5;

interface ParsedParams {
  ok: boolean;
  message?: string;
  adAccountId?: number;
  ids?: number[];
  days?: number;
}

function parseParams(search: URLSearchParams): ParsedParams {
  const adAccountRaw = search.get("ad_account");
  const idsRaw = search.get("ids");
  const daysRaw = search.get("days");

  const adAccountId = Number(adAccountRaw);
  if (!adAccountRaw || !Number.isFinite(adAccountId) || adAccountId <= 0) {
    return {
      ok: false,
      message: "Comparison requires an ad account.",
    };
  }
  if (!idsRaw) {
    return {
      ok: false,
      message: "Comparison requires at least 2 ad ids.",
    };
  }
  const seen = new Set<number>();
  const parsed: number[] = [];
  for (const piece of idsRaw.split(",")) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    parsed.push(n);
  }
  if (parsed.length < MIN_IDS) {
    return {
      ok: false,
      message: `Pick at least ${MIN_IDS} ads to compare.`,
    };
  }
  const ids = parsed.slice(0, MAX_IDS);

  let days = Number(daysRaw);
  if (!Number.isFinite(days) || !ALLOWED_DAYS.includes(days as (typeof ALLOWED_DAYS)[number])) {
    days = 14;
  }

  return { ok: true, adAccountId, ids, days };
}

function CompareAdsContent() {
  const searchParams = useSearchParams();
  const parsed = useMemo(
    () => parseParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  if (parsed.ok) {
    return (
      <ComparisonView
        adAccountId={parsed.adAccountId!}
        ids={parsed.ids!}
        days={parsed.days!}
      />
    );
  }
  return (
    <div className="mx-auto max-w-2xl rounded-xl bg-rose-50 p-5 ring-1 ring-rose-200">
      <h2 className="text-sm font-semibold text-rose-900">
        Couldn&apos;t load comparison
      </h2>
      <p className="mt-1 text-sm text-rose-800">{parsed.message}</p>
      <Link
        href="/meta-ads?tab=ranking"
        className="mt-4 inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200 transition-colors hover:bg-rose-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Ranking
      </Link>
    </div>
  );
}

function CompareAdsFallback() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[320px] w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default function CompareAdsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="bg-gray-50">
          <div className="mx-auto max-w-[1440px] px-6 py-4">
            <Suspense fallback={<CompareAdsFallback />}>
              <CompareAdsContent />
            </Suspense>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
