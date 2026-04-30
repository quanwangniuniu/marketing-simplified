"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

import { Skeleton } from "@/components/ui/skeleton";
import {
  facebookApi,
  type MetaAdPerformanceRow,
} from "@/lib/api/facebookApi";
import ComparisonRadar from "./ComparisonRadar";
import ComparisonTable from "./ComparisonTable";

interface ComparisonViewProps {
  adAccountId: number;
  ids: number[];
  days: number;
}

export default function ComparisonView({
  adAccountId,
  ids,
  days,
}: ComparisonViewProps) {
  const [rows, setRows] = useState<MetaAdPerformanceRow[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("USD");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    facebookApi
      .getMetaAdPerformance(adAccountId, days, { ids })
      .then((data) => {
        if (!active) return;
        setRows(data.ads);
        setCurrency(data.currency || "USD");
        if (data.ads.length < 2) {
          setError(
            "Some ads could not be loaded. Please return to Ranking and pick again."
          );
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load comparison.");
        toast.error("Failed to load comparison.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [adAccountId, days, ids]);

  const lifecycleMixed = useMemo(() => {
    if (!rows) return false;
    let hasLearning = false;
    let hasStable = false;
    for (const r of rows) {
      if (r.is_in_learning === true) hasLearning = true;
      else if (r.is_in_learning === false) hasStable = true;
    }
    return hasLearning && hasStable;
  }, [rows]);

  if (loading && !rows) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[320px] w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !rows || rows.length < 2) {
    return <ErrorCard message={error ?? "No comparison to render."} />;
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link
          href="/meta-ads?tab=ranking"
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Ranking
        </Link>
        <h1 className="text-[22px] font-semibold text-gray-900">
          Compare ads
        </h1>
        <p className="text-xs text-gray-500">
          Last {days} days · {rows.length} ads
        </p>
      </header>

      {lifecycleMixed && (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="text-sm">
            <div className="font-semibold text-amber-800">
              Mixed lifecycle stages
            </div>
            <p className="mt-0.5 text-amber-800">
              Some ads are still in the learning phase. Performance comparison
              may be misleading until all selected ads exit learning.
            </p>
          </div>
        </div>
      )}

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Radar
        </h2>
        <ComparisonRadar rows={rows} />
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Dimensions
        </h2>
        <ComparisonTable rows={rows} currency={currency} />
      </section>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl bg-rose-50 p-5 ring-1 ring-rose-200">
      <h2 className="text-sm font-semibold text-rose-900">
        Couldn&apos;t load comparison
      </h2>
      <p className="mt-1 text-sm text-rose-800">{message}</p>
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
