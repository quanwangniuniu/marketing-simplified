"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import FacebookFeedPreview from "@/components/facebook_meta/previews/FacebookFeedPreview";
import TiktokPreview from "@/components/tiktok/TiktokPreview";
import AdPreviewPanel from "@/components/google_ads/preview/AdPreviewPanel";
import type { GoogleAd } from "@/lib/api/googleAdsApi";
import attachmentApi, { validateFile } from "@/lib/api/attachmentApi";
import { AdVariationAPI } from "@/lib/api/adVariationApi";
import type {
  AdGroup,
  AdVariation,
  ComparisonResponse,
  CreativeType,
  VariationPerformanceEntry,
  VariationStatus,
} from "@/types/adVariation";
import BrandButton from "@/components/campaigns-v2/BrandButton";
import AdVariationStatusPill from "@/components/ad-variations-v2/pills/AdVariationStatusPill";
import CreativeTypeBadge from "@/components/ad-variations-v2/pills/CreativeTypeBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import BrandSelect from "@/components/ui/BrandSelect";
import VariationComparisonSection from "@/components/ad-variations-v2/sections/VariationComparisonSection";
import AdGroupSection from "@/components/ad-variations-v2/sections/AdGroupSection";

const STATUS_COLUMNS: VariationStatus[] = [
  "Draft",
  "Testing",
  "Live",
  "Winner",
  "Loser",
  "Paused",
];

const CREATIVE_FIELDS: Record<CreativeType, { key: string; label: string }[]> = {
  image: [
    { key: "headline", label: "Headline" },
    { key: "primaryText", label: "Primary Text" },
  ],
  video: [
    { key: "headline", label: "Headline" },
    { key: "primaryText", label: "Primary Text" },
  ],
  carousel: [
    { key: "cardHeadline", label: "Card Headline" },
    { key: "cardDescription", label: "Card Description" },
  ],
  collection: [
    { key: "headline", label: "Headline" },
    { key: "primaryText", label: "Primary Text" },
    { key: "collectionTitle", label: "Collection Title" },
  ],
  email: [
    { key: "subject", label: "Subject" },
    { key: "preheader", label: "Preheader" },
    { key: "body", label: "Body" },
  ],
};

const statusStyles: Record<
  VariationStatus,
  { strip: string; badge: string; card: string; border: string }
> = {
  Draft: {
    strip: "bg-slate-300",
    badge: "bg-slate-100 text-slate-600",
    card: "bg-slate-50/80",
    border: "border-slate-200/80",
  },
  Testing: {
    strip: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700",
    card: "bg-amber-50/80",
    border: "border-amber-200/80",
  },
  Live: {
    strip: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
    card: "bg-emerald-50/80",
    border: "border-emerald-200/80",
  },
  Winner: {
    strip: "bg-indigo-500",
    badge: "bg-indigo-100 text-indigo-700",
    card: "bg-indigo-50/80",
    border: "border-indigo-200/80",
  },
  Loser: {
    strip: "bg-rose-500",
    badge: "bg-rose-100 text-rose-700",
    card: "bg-rose-50/80",
    border: "border-rose-200/80",
  },
  Paused: {
    strip: "bg-gray-400",
    badge: "bg-gray-100 text-gray-600",
    card: "bg-gray-50/80",
    border: "border-gray-200/80",
  },
};

const creativePreviewLabel: Record<CreativeType, string> = {
  image: "Image",
  video: "Video",
  carousel: "Carousel",
  collection: "Collection",
  email: "Email",
};

const formatLabel = (value: string) => value[0].toUpperCase() + value.slice(1);

interface AdVariationManagementProps {
  campaignId: number;
}

export default function AdVariationManagement({ campaignId }: AdVariationManagementProps) {
  const [activeTab, setActiveTab] = useState<"board" | "compare" | "groups">(
    "board"
  );
  const [variations, setVariations] = useState<AdVariation[]>([]);
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeVariation, setActiveVariation] = useState<AdVariation | null>(
    null
  );
  const [compareData, setCompareData] = useState<ComparisonResponse | null>(
    null
  );
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [performanceEntries, setPerformanceEntries] = useState<
    VariationPerformanceEntry[]
  >([]);
  const [latestPerformance, setLatestPerformance] = useState<
    Record<number, { recordedAt: string | null; metrics: Record<string, any> } | null>
  >({});
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [orderedVariations, setOrderedVariations] = useState<AdVariation[]>([]);
  const [bulkAction, setBulkAction] = useState<
    | "updateStatus"
    | "addTags"
    | "removeTags"
    | "assignAdGroup"
    | "unassignAdGroup"
  >("updateStatus");
  const [bulkPayload, setBulkPayload] = useState<Record<string, any>>({});
  const [sortBy, setSortBy] = useState<"manual" | "recency" | "performance">(
    "manual"
  );
  const [statusFilter, setStatusFilter] = useState<VariationStatus | "all">(
    "all"
  );
  const [typeFilter, setTypeFilter] = useState<CreativeType | "all">("all");
  const [tagFilter, setTagFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | "none" | number>("all");
  const [columnSizes, setColumnSizes] = useState({ left: 240, right: 520 });
  const [isDesktop, setIsDesktop] = useState(false);
  const [previewMode, setPreviewMode] = useState<
    "native" | "facebook" | "tiktok" | "google"
  >("native");
  const boardRef = useRef<HTMLDivElement | null>(null);
  const pendingDeleteRef = useRef<
    Map<number, { timer: number; index: number; variation: AdVariation }>
  >(new Map());

  const groupMap = useMemo(() => {
    const map = new Map<number, string>();
    adGroups.forEach((group) => map.set(group.id, group.name));
    return map;
  }, [adGroups]);

  const groupPalette = [
    {
      base: "bg-indigo-50 text-indigo-700 border-indigo-200",
      active: "bg-indigo-100 text-indigo-800 border-indigo-300",
    },
    {
      base: "bg-emerald-50 text-emerald-700 border-emerald-200",
      active: "bg-emerald-100 text-emerald-800 border-emerald-300",
    },
    {
      base: "bg-amber-50 text-amber-700 border-amber-200",
      active: "bg-amber-100 text-amber-800 border-amber-300",
    },
    {
      base: "bg-rose-50 text-rose-700 border-rose-200",
      active: "bg-rose-100 text-rose-800 border-rose-300",
    },
    {
      base: "bg-sky-50 text-sky-700 border-sky-200",
      active: "bg-sky-100 text-sky-800 border-sky-300",
    },
    {
      base: "bg-violet-50 text-violet-700 border-violet-200",
      active: "bg-violet-100 text-violet-800 border-violet-300",
    },
    {
      base: "bg-teal-50 text-teal-700 border-teal-200",
      active: "bg-teal-100 text-teal-800 border-teal-300",
    },
  ];

  const groupColorClass = (name: string, active = false) => {
    const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const palette = groupPalette[hash % groupPalette.length];
    return active ? palette.active : palette.base;
  };

  const loadData = async () => {
    const [nextVariations, nextGroups] = await Promise.all([
      AdVariationAPI.listVariations(campaignId, { sortBy: "manual", order: "asc" }),
      AdVariationAPI.listAdGroups(campaignId),
    ]);
    setVariations(nextVariations);
    setOrderedVariations(nextVariations);
    setAdGroups(nextGroups);
  };

  useEffect(() => {
    loadData().catch(() => toast.error("Failed to load ad variations"));
  }, [campaignId]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadData().catch(() => undefined);
    }, 30000);
    return () => clearInterval(interval);
  }, [campaignId]);

  useEffect(() => {
    if (activeTab !== "board") {
      setActiveVariation(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsDesktop(window.innerWidth >= 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(
      `ad-variation-layout-${campaignId}`
    );
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { left?: number; right?: number };
      setColumnSizes({
        left: parsed.left || 240,
        right: parsed.right || 520,
      });
    } catch {
      // ignore
    }
  }, [campaignId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      `ad-variation-layout-${campaignId}`,
      JSON.stringify(columnSizes)
    );
  }, [campaignId, columnSizes]);

  useEffect(() => {
    const loadPerformance = async () => {
      const entries = await Promise.all(
        variations.map(async (variation) => {
          try {
            const data = await AdVariationAPI.getLatestPerformance(
              campaignId,
              variation.id
            );
            return [variation.id, data] as const;
          } catch {
            return [variation.id, null] as const;
          }
        })
      );
      const next: Record<
        number,
        { recordedAt: string | null; metrics: Record<string, any> } | null
      > = {};
      entries.forEach(([id, data]) => {
        next[id] = data;
      });
      setLatestPerformance(next);
    };
    if (variations.length) {
      loadPerformance().catch(() => undefined);
    }
  }, [campaignId, variations]);

  const filteredVariations = useMemo(() => {
    return orderedVariations.filter((variation) => {
      if (statusFilter !== "all" && variation.status !== statusFilter) return false;
      if (typeFilter !== "all" && variation.creativeType !== typeFilter) return false;
      if (groupFilter === "none" && variation.adGroupId) return false;
      if (
        groupFilter !== "all" &&
        groupFilter !== "none" &&
        variation.adGroupId !== groupFilter
      )
        return false;
      if (tagFilter.trim()) {
        const tags = tagFilter
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean);
        if (tags.length) {
          const variationTags = (variation.tags || []).map((tag) =>
            tag.toLowerCase()
          );
          const hasMatch = tags.some((tag) => variationTags.includes(tag));
          if (!hasMatch) return false;
        }
      }
      return true;
    });
  }, [orderedVariations, statusFilter, typeFilter, tagFilter, groupFilter]);

  const sortedVariations = useMemo(() => {
    if (sortBy === "manual") return filteredVariations;
    if (sortBy === "recency") {
      return [...filteredVariations].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    return [...filteredVariations].sort((a, b) => {
      const aMetric =
        latestPerformance[a.id]?.metrics?.ctr ??
        latestPerformance[a.id]?.metrics?.conversionRate ??
        0;
      const bMetric =
        latestPerformance[b.id]?.metrics?.ctr ??
        latestPerformance[b.id]?.metrics?.conversionRate ??
        0;
      return Number(bMetric) - Number(aMetric);
    });
  }, [filteredVariations, latestPerformance, sortBy]);

  const startResize = (side: "left" | "right") => (event: React.PointerEvent) => {
    if (!boardRef.current) return;
    event.preventDefault();
    const startX = event.clientX;
    const startLeft = columnSizes.left;
    const startRight = columnSizes.right;
    const containerWidth = boardRef.current.getBoundingClientRect().width;
    const minLeft = 200;
    const minRight = 360;
    const minCenter = 520;
    const maxLeft = Math.max(minLeft, containerWidth - minRight - minCenter - 20);
    const maxRight = Math.max(minRight, containerWidth - minLeft - minCenter - 20);

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      if (side === "left") {
        const nextLeft = Math.min(maxLeft, Math.max(minLeft, startLeft + delta));
        setColumnSizes((prev) => ({ ...prev, left: nextLeft }));
      } else {
        const nextRight = Math.min(
          maxRight,
          Math.max(minRight, startRight - delta)
        );
        setColumnSizes((prev) => ({ ...prev, right: nextRight }));
      }
    };

    const handleUp = () => {
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleSelect = (variationId: number) => {
    setSelectedIds((prev) =>
      prev.includes(variationId)
        ? prev.filter((id) => id !== variationId)
        : [...prev, variationId]
    );
  };

  const handleViewDetail = async (variationId: number) => {
    const variation = variations.find((item) => item.id === variationId);
    if (!variation) return;
    setActiveVariation(variation);
    setPreviewMode("native");
    try {
      const [entries, history] = await Promise.all([
        AdVariationAPI.listPerformance(campaignId, variationId, { limit: 50 }),
        AdVariationAPI.listStatusHistory(campaignId, variationId, { limit: 20 }),
      ]);
      setPerformanceEntries(entries);
      setStatusHistory(history);
    } catch {
      setPerformanceEntries([]);
      setStatusHistory([]);
    }
  };

  const handleDropStatus = async (
    variationId: number,
    status: VariationStatus
  ) => {
    const variation = variations.find((item) => item.id === variationId);
    if (!variation || variation.status === status) return;
    const previous = variation.status;
    setVariations((prev) =>
      prev.map((item) =>
        item.id === variationId ? { ...item, status } : item
      )
    );
    setOrderedVariations((prev) =>
      prev.map((item) =>
        item.id === variationId ? { ...item, status } : item
      )
    );
    try {
      await AdVariationAPI.changeStatus(campaignId, variationId, {
        toStatus: status,
        reason: "Drag-and-drop update",
      });
      loadData();
    } catch {
      setVariations((prev) =>
        prev.map((item) =>
          item.id === variationId ? { ...item, status: previous } : item
        )
      );
      toast.error("Failed to update status");
    }
  };

  const handleBulkApply = async () => {
    if (!selectedIds.length) return;
    const payload = {
      variationIds: selectedIds,
      action: bulkAction,
      payload: bulkPayload,
    };
    try {
      await AdVariationAPI.bulkOperate(campaignId, payload);
      toast.success("Bulk action applied");
      loadData();
    } catch {
      toast.error("Bulk action failed");
    }
  };

  const handleGroupDragStart =
    (groupId: number | "none") => (event: React.DragEvent<HTMLDivElement>) => {
      const value = String(groupId);
      event.dataTransfer.setData("application/x-adgroup-id", value);
      event.dataTransfer.setData("text/plain", `group:${value}`);
      event.dataTransfer.effectAllowed = "move";
    };

  const handleGroupDropOnCard = async (
    variationId: number,
    event: React.DragEvent<HTMLTableRowElement>
  ) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    const custom = event.dataTransfer.getData("application/x-adgroup-id");
    const groupId = custom || (raw.startsWith("group:") ? raw.replace("group:", "") : "");
    if (!groupId) return;
    if (groupId === "none") {
      await handleDropToGroup(variationId, null);
      return;
    }
    const parsedGroupId = Number(groupId);
    if (!Number.isFinite(parsedGroupId)) return;
    await handleDropToGroup(variationId, parsedGroupId);
  };

  const handleDropToGroup = async (variationId: number, groupId: number | null) => {
    const variation = variations.find((item) => item.id === variationId);
    if (!variation) return;
    const previousGroupId = variation.adGroupId ?? null;
    setVariations((prev) =>
      prev.map((item) =>
        item.id === variationId ? { ...item, adGroupId: groupId || undefined } : item
      )
    );
    setOrderedVariations((prev) =>
      prev.map((item) =>
        item.id === variationId ? { ...item, adGroupId: groupId || undefined } : item
      )
    );
    try {
      if (groupId !== null) {
        await AdVariationAPI.assignVariationsToGroup(campaignId, groupId, [
          variationId,
        ]);
      } else if (previousGroupId) {
        await AdVariationAPI.removeVariationsFromGroup(
          campaignId,
          previousGroupId,
          [variationId]
        );
      }
      loadData();
    } catch {
      toast.error("Failed to update ad set");
      loadData();
    }
  };

  const handleCompare = async () => {
    if (compareIds.length < 2) return;
    try {
      const data = await AdVariationAPI.compareVariations(
        campaignId,
        compareIds
      );
      setCompareData(data);
    } catch {
      toast.error("Comparison failed");
    }
  };

  const handleMarkStatus = async (
    variation: AdVariation,
    targetStatus: VariationStatus
  ) => {
    const nextStatus =
      variation.status === targetStatus ? "Testing" : targetStatus;
    try {
      const response = await AdVariationAPI.changeStatus(
        campaignId,
        variation.id,
        { toStatus: nextStatus, reason: "Comparison action" }
      );
      setVariations((prev) =>
        prev.map((item) =>
          item.id === variation.id ? response.variation : item
        )
      );
      setOrderedVariations((prev) =>
        prev.map((item) =>
          item.id === variation.id ? response.variation : item
        )
      );
      if (activeVariation?.id === variation.id) {
        setActiveVariation(response.variation);
      }
    } catch {
      toast.error("Status update failed");
    }
  };

  const handleDeleteVariation = async (variationId: number) => {
    const index = orderedVariations.findIndex((item) => item.id === variationId);
    const variation = orderedVariations[index];
    if (!variation) return;
    setOrderedVariations((prev) => prev.filter((item) => item.id !== variationId));
    setVariations((prev) => prev.filter((item) => item.id !== variationId));
    setSelectedIds((prev) => prev.filter((id) => id !== variationId));
    setCompareData(null);
    setActiveVariation((prev) => (prev?.id === variationId ? null : prev));

    const timer = window.setTimeout(async () => {
      pendingDeleteRef.current.delete(variationId);
      try {
        await AdVariationAPI.deleteVariation(campaignId, variationId);
        toast.success("Variation deleted");
      } catch {
        setOrderedVariations((prev) => {
          const next = [...prev];
          next.splice(index, 0, variation);
          return next;
        });
        setVariations((prev) => {
          const next = [...prev];
          next.splice(index, 0, variation);
          return next;
        });
        toast.error("Failed to delete variation");
      }
    }, 4000);

    pendingDeleteRef.current.set(variationId, { timer, index, variation });

    toast(
      (toastInfo) => (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">
            Variation scheduled for deletion.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              window.clearTimeout(timer);
              pendingDeleteRef.current.delete(variationId);
              setOrderedVariations((prev) => {
                const next = [...prev];
                next.splice(index, 0, variation);
                return next;
              });
              setVariations((prev) => {
                const next = [...prev];
                next.splice(index, 0, variation);
                return next;
              });
              toast.dismiss(toastInfo.id);
              toast.success("Deletion undone");
            }}
          >
            Undo
          </Button>
        </div>
      ),
      {
        duration: 4000,
        style: {
          background: "#ffffff",
          color: "#0f172a",
          border: "1px solid #e2e8f0",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
        },
      }
    );
  };

  const selectedCount = selectedIds.length;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
            Ad Variations
          </h2>
          <span className="text-[11px] normal-case text-gray-400">
            {variations.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => loadData().catch(() => toast.error("Refresh failed"))}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <BrandButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Variation
          </BrandButton>
        </div>
      </header>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="compare">Comparison</TabsTrigger>
          <TabsTrigger value="groups">Ad Sets</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "board" && (
        <div className="space-y-4">
          {/* FilterBar — 顶部 inline */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="Search tags..."
              className="w-56 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-[#0E8A96] focus:outline-none"
            />
            <div className="rounded-md border border-gray-200 bg-white px-1 py-0.5">
              <BrandSelect
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as VariationStatus | "all")}
                options={[
                  { value: "all", label: "All Statuses" },
                  ...STATUS_COLUMNS.map((s) => ({ value: s, label: s })),
                ]}
                ariaLabel="Status filter"
                widthClass="min-w-[8rem]"
              />
            </div>
            <div className="rounded-md border border-gray-200 bg-white px-1 py-0.5">
              <BrandSelect
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as CreativeType | "all")}
                options={[
                  { value: "all", label: "All Types" },
                  ...Object.keys(CREATIVE_FIELDS).map((t) => ({
                    value: t,
                    label: formatLabel(t),
                  })),
                ]}
                ariaLabel="Type filter"
                widthClass="min-w-[8rem]"
              />
            </div>
            <div className="rounded-md border border-gray-200 bg-white px-1 py-0.5">
              <BrandSelect
                value={sortBy}
                onValueChange={(v) =>
                  setSortBy(v as "manual" | "recency" | "performance")
                }
                options={[
                  { value: "manual", label: "Manual Order" },
                  { value: "recency", label: "Sort by Recency" },
                  { value: "performance", label: "Sort by Performance" },
                ]}
                ariaLabel="Sort by"
                widthClass="min-w-[10rem]"
              />
            </div>
            <div className="ml-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-gray-400">
                Ad Sets
              </span>
              <div
                draggable
                onDragStart={handleGroupDragStart("none")}
                onClick={() =>
                  setGroupFilter((prev) => (prev === "none" ? "all" : "none"))
                }
                className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] transition ${
                  groupFilter === "none"
                    ? "border-[#0E8A96]/30 bg-[#0E8A96]/10 text-[#0E8A96] shadow-sm"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                }`}
              >
                No Ad Set
              </div>
              {adGroups.map((group) => (
                <div
                  key={group.id}
                  draggable
                  onDragStart={handleGroupDragStart(group.id)}
                  onClick={() =>
                    setGroupFilter((prev) => (prev === group.id ? "all" : group.id))
                  }
                  className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] transition ${
                    groupFilter === group.id
                      ? "border-[#0E8A96]/30 bg-[#0E8A96]/10 text-[#0E8A96] shadow-sm"
                      : variations.some((variation) => variation.adGroupId === group.id)
                      ? groupColorClass(group.name)
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {group.name}
                </div>
              ))}
            </div>
          </div>

          {/* 主表格 — 全宽 + 紧凑 */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length > 0 &&
                        selectedIds.length === sortedVariations.length
                      }
                      onChange={() => {
                        if (selectedIds.length === sortedVariations.length) {
                          setSelectedIds([]);
                        } else {
                          setSelectedIds(sortedVariations.map((v) => v.id));
                        }
                      }}
                      className="accent-[#0E8A96]"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">Variation</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Ad Set</th>
                  <th className="px-3 py-2 text-left">Delivery</th>
                  <th className="px-3 py-2 text-left">Budget</th>
                  <th className="px-3 py-2 text-right">Results</th>
                  <th className="px-3 py-2 text-right">Reach</th>
                  <th className="px-3 py-2 text-right">Impressions</th>
                  <th className="px-3 py-2 text-right">Cost / Result</th>
                  <th className="px-3 py-2 text-left">Updated</th>
                  <th className="px-3 py-2 text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {sortedVariations.map((variation) => {
                  const mediaAsset = (variation.formatPayload as any)?.mediaAssets?.[0];
                  const assetFileUrl =
                    mediaAsset?.fileUrl || mediaAsset?.file_url || null;
                  const assetThumbnail =
                    mediaAsset?.thumbnailUrl || mediaAsset?.thumbnail_url || null;
                  const assetType = mediaAsset?.fileType || mediaAsset?.file_type || "";
                  const previewUrl =
                    variation.formatPayload?.previewUrl ||
                    assetThumbnail ||
                    variation.formatPayload?.imageUrl ||
                    assetFileUrl ||
                    null;
                  const isVideoPreview =
                    assetType.startsWith("video") ||
                    variation.creativeType === "video";
                  const videoSrc = assetFileUrl || variation.formatPayload?.videoUrl || previewUrl;
                  const performance = latestPerformance[variation.id];
                  const groupName = variation.adGroupId
                    ? groupMap.get(variation.adGroupId) || "—"
                    : "—";
                  const metrics = performance?.metrics || {};
                  const results =
                    metrics.results ?? metrics.conversions ?? metrics.leads ?? "—";
                  const reach = metrics.reach ?? "—";
                  const impressions = metrics.impressions ?? "—";
                  const costPerResult =
                    metrics.costPerResult ?? metrics.cpa ?? metrics.cpl ?? "—";
                  const isActive = activeVariation?.id === variation.id;
                  return (
                    <tr
                      key={variation.id}
                      onClick={() => handleViewDetail(variation.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleGroupDropOnCard(variation.id, event)}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          "application/x-variation-id",
                          String(variation.id)
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className={`cursor-pointer border-t border-gray-100 transition hover:bg-gray-50 ${
                        isActive ? "bg-[#0E8A96]/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(variation.id)}
                          onChange={(event) => {
                            event.stopPropagation();
                            handleSelect(variation.id);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          className="accent-[#0E8A96]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-12 shrink-0 rounded border border-gray-200 bg-gray-100">
                            {previewUrl ? (
                              isVideoPreview && videoSrc ? (
                                <video
                                  src={videoSrc}
                                  poster={assetThumbnail || undefined}
                                  className="h-full w-full rounded object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <div
                                  className="h-full w-full rounded bg-cover bg-center"
                                  style={{ backgroundImage: `url(${previewUrl})` }}
                                />
                              )
                            ) : (
                              <div className="flex h-full items-center justify-center text-[8px] uppercase tracking-wide text-gray-400">
                                —
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-gray-900">
                              {variation.name}
                            </p>
                            {(variation.tags || []).length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {(variation.tags || []).slice(0, 2).map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-gray-100 px-1.5 py-0 text-[10px] text-gray-600"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <AdVariationStatusPill status={variation.status} />
                      </td>
                      <td className="px-3 py-2">
                        <CreativeTypeBadge type={variation.creativeType} />
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {groupName !== "—" ? (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] ${groupColorClass(
                              groupName
                            )}`}
                          >
                            {groupName}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {variation.delivery ||
                          (variation.status === "Live"
                            ? "Active"
                            : variation.status === "Paused"
                            ? "Off"
                            : "Draft")}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {variation.budget || "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">
                        {results}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">
                        {reach}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">
                        {impressions}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">
                        {costPerResult}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {new Date(variation.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            AdVariationAPI.duplicateVariation(
                              campaignId,
                              variation.id
                            ).then(loadData);
                          }}
                        >
                          Duplicate
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedVariations.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16">
                <p className="text-sm text-gray-500">No variations yet.</p>
                <BrandButton onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create Your First Variation
                </BrandButton>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating BulkActionBar — 底部浮动(仅选中时)*/}
      {activeTab === "board" && selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <BulkActionBar
            selectedCount={selectedCount}
            bulkAction={bulkAction}
            onBulkActionChange={(value) => setBulkAction(value as any)}
            bulkPayload={bulkPayload}
            onPayloadChange={setBulkPayload}
            adGroups={adGroups}
            onApply={handleBulkApply}
          />
        </div>
      )}

      {/* Right Drawer — 点 row 打开 */}
      {activeVariation && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setActiveVariation(null)}
          />
          <aside className="fixed right-0 top-0 z-40 h-full w-full max-w-[520px] overflow-y-auto bg-white shadow-2xl ring-1 ring-gray-200">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <h3 className="truncate text-sm font-semibold text-gray-900">
                {activeVariation.name}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveVariation(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <VariationSidePanel
                variation={activeVariation}
                adGroups={adGroups}
                campaignId={campaignId}
                performanceEntries={performanceEntries}
                statusHistory={statusHistory}
                previewMode={previewMode}
                onPreviewModeChange={setPreviewMode}
                onRefresh={loadData}
                onDelete={handleDeleteVariation}
              />
            </div>
          </aside>
        </>
      )}

      {activeTab === "compare" && (
        <VariationComparisonSection
          variations={variations}
          compareIds={compareIds}
          compareData={compareData}
          onSelect={setCompareIds}
          onCompare={handleCompare}
          onMarkStatus={handleMarkStatus}
        />
      )}

      {activeTab === "groups" && (
        <AdGroupSection
          campaignId={campaignId}
          adGroups={adGroups}
          variations={variations}
          groupColorClass={groupColorClass}
          onRefresh={loadData}
        />
      )}

      {createOpen && (
        <VariationCreateModal
          campaignId={campaignId}
          adGroups={adGroups}
          onClose={() => setCreateOpen(false)}
          onComplete={async () => {
            setCreateOpen(false);
            await loadData();
            toast.success("Variation created successfully");
          }}
        />
      )}
    </section>
  );
}

function BulkActionBar({
  selectedCount,
  bulkAction,
  bulkPayload,
  onBulkActionChange,
  onPayloadChange,
  adGroups,
  onApply,
}: {
  selectedCount: number;
  bulkAction: string;
  bulkPayload: Record<string, any>;
  onBulkActionChange: (value: string) => void;
  onPayloadChange: (value: Record<string, any>) => void;
  adGroups: AdGroup[];
  onApply: () => void;
}) {
  const statusClass =
    bulkPayload.toStatus &&
    STATUS_COLUMNS.includes(bulkPayload.toStatus as VariationStatus)
      ? statusStyles[bulkPayload.toStatus as VariationStatus].badge
      : "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-lg font-semibold text-white shadow-inner">
            {selectedCount}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-[#0E8A96]">
              Selected
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="rounded-full border border-[#0E8A96]/30 bg-[#0E8A96]/10 px-3 py-1">
            <BrandSelect
              value={bulkAction}
              onValueChange={(v) => onBulkActionChange(v)}
              options={[
                { value: "updateStatus", label: "Update Status" },
                { value: "addTags", label: "Add Tags" },
                { value: "removeTags", label: "Remove Tags" },
                { value: "assignAdGroup", label: "Assign Ad Set" },
                { value: "unassignAdGroup", label: "Unassign Ad Set" },
              ]}
              ariaLabel="Bulk action"
              widthClass="min-w-[10rem]"
            />
          </div>
          {bulkAction === "updateStatus" && (
            <div className="rounded-full border border-[#0E8A96]/30 bg-[#0E8A96]/10 px-3 py-1">
              <BrandSelect
                value={bulkPayload.toStatus || ""}
                onValueChange={(v) =>
                  onPayloadChange({ ...bulkPayload, toStatus: v })
                }
                options={[
                  { value: "", label: "Select status" },
                  ...STATUS_COLUMNS.map((status) => ({
                    value: status,
                    label: status,
                  })),
                ]}
                ariaLabel="Target status"
                widthClass="min-w-[9rem]"
              />
            </div>
          )}
          {["addTags", "removeTags"].includes(bulkAction) && (
            <input
              value={bulkPayload.tags?.join(",") || ""}
              onChange={(event) =>
                onPayloadChange({
                  ...bulkPayload,
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              placeholder="tag1, tag2"
              className="rounded-full border border-[#0E8A96]/30 bg-[#0E8A96]/10 px-4 py-2 text-sm text-[#0E8A96] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0E8A96]/40"
            />
          )}
          {bulkAction === "assignAdGroup" && (
            <div className="rounded-full border border-[#0E8A96]/30 bg-[#0E8A96]/10 px-3 py-1">
              <BrandSelect
                value={String(bulkPayload.adGroupId || "")}
                onValueChange={(v) =>
                  onPayloadChange({
                    ...bulkPayload,
                    adGroupId: v ? Number(v) : null,
                  })
                }
                options={[
                  { value: "", label: "Select ad set" },
                  ...adGroups.map((group) => ({
                    value: String(group.id),
                    label: group.name,
                  })),
                ]}
                ariaLabel="Target ad set"
                widthClass="min-w-[10rem]"
              />
            </div>
          )}
          <button
            onClick={onApply}
            disabled={!selectedCount}
            className="rounded-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusRail({
  variations,
  onDropStatus,
}: {
  variations: AdVariation[];
  onDropStatus: (variationId: number, status: VariationStatus) => void;
}) {
  const counts = useMemo(() => {
    return STATUS_COLUMNS.reduce<Record<string, number>>((acc, status) => {
      acc[status] = variations.filter((item) => item.status === status).length;
      return acc;
    }, {});
  }, [variations]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STATUS_COLUMNS.map((status) => (
          <div
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const variationId = event.dataTransfer.getData(
                "application/x-variation-id"
              );
              if (!variationId) return;
              const parsedVariationId = Number(variationId);
              if (!Number.isFinite(parsedVariationId)) return;
              onDropStatus(parsedVariationId, status);
            }}
            className={`rounded-2xl border px-3 py-3 text-xs ${statusStyles[status].border} ${statusStyles[status].card}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-gray-500">
                {status}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-600 shadow-sm">
                {counts[status] || 0}
              </span>
            </div>
            <div className="mt-2 flex h-10 items-center justify-center rounded-xl border border-dashed border-gray-200 text-[10px] text-gray-400">
              Drop here
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VariationSidePanel({
  variation,
  adGroups,
  campaignId,
  performanceEntries,
  statusHistory,
  previewMode,
  onPreviewModeChange,
  onRefresh,
  onDelete,
}: {
  variation: AdVariation | null;
  adGroups: AdGroup[];
  campaignId: number;
  performanceEntries: VariationPerformanceEntry[];
  statusHistory: any[];
  previewMode: "native" | "facebook" | "tiktok" | "google";
  onPreviewModeChange: (mode: "native" | "facebook" | "tiktok" | "google") => void;
  onRefresh: () => void;
  onDelete: (variationId: number) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<VariationStatus>("Draft");
  const [adGroupId, setAdGroupId] = useState<number | null>(null);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [delivery, setDelivery] = useState("");
  const [bidStrategy, setBidStrategy] = useState("");
  const [budget, setBudget] = useState("");
  const [copyDrafts, setCopyDrafts] = useState<Record<string, string>>({});
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [logoFiles, setLogoFiles] = useState<File[]>([]);
  const [uploadedAssets, setUploadedAssets] = useState<
    { id: number; fileUrl: string; thumbnailUrl: string | null; fileType: string }[]
  >([]);
  const [logoAssets, setLogoAssets] = useState<
    { id: number; fileUrl: string; thumbnailUrl: string | null; fileType: string }[]
  >([]);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);
  const [logoPreviews, setLogoPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [composerExpanded, setComposerExpanded] = useState(true);

  useEffect(() => {
    if (!variation) return;
    setName(variation.name);
    setStatus(variation.status);
    setAdGroupId(variation.adGroupId ?? null);
    setTags((variation.tags || []).join(", "));
    setNotes(variation.notes || "");
    setDelivery(variation.delivery || "");
    setBidStrategy(variation.bidStrategy || "");
    setBudget(variation.budget ? String(variation.budget) : "");
    setMediaFiles([]);
    setLogoFiles([]);
    setUploadError(null);
    
    const existingMediaAssets = (variation.formatPayload as any)?.mediaAssets || [];
    setUploadedAssets(
      existingMediaAssets.map((asset: any) => ({
        id: asset.id,
        fileUrl: asset.fileUrl || asset.file_url || "",
        thumbnailUrl: asset.thumbnailUrl || asset.thumbnail_url || null,
        fileType: asset.fileType || asset.file_type || "",
      }))
    );
    
    const existingLogoAssets = (variation.formatPayload as any)?.logoAssets || [];
    setLogoAssets(
      existingLogoAssets.map((asset: any) => ({
        id: asset.id,
        fileUrl: asset.fileUrl || asset.file_url || "",
        thumbnailUrl: asset.thumbnailUrl || asset.thumbnail_url || null,
        fileType: asset.fileType || asset.file_type || "",
      }))
    );
    
    setCopyDrafts(
      variation.copyElements.reduce<Record<string, string>>((acc, elem) => {
        acc[elem.elementKey] = elem.value;
        return acc;
      }, {})
    );
    setEditMode(false);
  }, [variation]);

  useEffect(() => {
    if (!mediaFiles.length) {
      setLocalPreviews([]);
      return;
    }
    const urls = mediaFiles.map((file) => URL.createObjectURL(file));
    setLocalPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaFiles]);

  useEffect(() => {
    if (!logoFiles.length) {
      setLogoPreviews([]);
      return;
    }
    const urls = logoFiles.map((file) => URL.createObjectURL(file));
    setLogoPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [logoFiles]);

  const handleRemoveMediaAsset = (index: number) => {
    setUploadedAssets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveLogoAsset = (index: number) => {
    setLogoAssets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!variation) return;
    const existingByKey = variation.copyElements.reduce<
      Record<string, (typeof variation.copyElements)[number]>
    >((acc, elem) => {
      acc[elem.elementKey] = elem;
      return acc;
    }, {});
    const copyElements = CREATIVE_FIELDS[variation.creativeType].map((field, index) => {
      const existing = existingByKey[field.key];
      return {
        id: existing?.id,
        elementKey: field.key,
        value: copyDrafts[field.key] ?? existing?.value ?? "",
        position:
          variation.creativeType === "carousel" || variation.creativeType === "collection"
            ? existing?.position ?? index + 1
            : existing?.position,
        locale: existing?.locale,
        meta: existing?.meta,
      };
    });
    await AdVariationAPI.updateVariation(variation.campaignId, variation.id, {
      name,
      status,
      adGroupId: adGroupId ?? null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes,
      delivery,
      bidStrategy,
      budget: budget || null,
      copyElements,
      formatPayload: {
        ...(variation.formatPayload || {}),
        mediaFiles: mediaFiles.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
        })),
        mediaAssets: uploadedAssets.map((asset) => ({
          id: asset.id,
          fileUrl: asset.fileUrl,
          thumbnailUrl: asset.thumbnailUrl,
          fileType: asset.fileType,
        })),
        logoAssets: logoAssets.map((asset) => ({
          id: asset.id,
          fileUrl: asset.fileUrl,
          thumbnailUrl: asset.thumbnailUrl,
          fileType: asset.fileType,
        })),
        previewUrl:
          uploadedAssets[0]?.thumbnailUrl ||
          uploadedAssets[0]?.fileUrl ||
          variation.formatPayload?.previewUrl,
        logoUrl:
          logoAssets[0]?.thumbnailUrl ||
          logoAssets[0]?.fileUrl ||
          variation.formatPayload?.logoUrl,
      },
    });
    setEditMode(false);
    onRefresh();
  };

  if (!variation) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Select a variation to preview.
      </div>
    );
  }

  const payloadAsset = (variation.formatPayload as any)?.mediaAssets?.[0];
  const payloadAssetFile = payloadAsset?.fileUrl || payloadAsset?.file_url || null;
  const payloadAssetThumb = payloadAsset?.thumbnailUrl || payloadAsset?.thumbnail_url || null;
  const previewUrl =
    variation.formatPayload?.previewUrl ||
    payloadAssetThumb ||
    variation.formatPayload?.imageUrl ||
    payloadAssetFile ||
    variation.formatPayload?.videoUrl ||
    null;
  const livePreviewUrl =
    uploadedAssets[0]?.thumbnailUrl ||
    uploadedAssets[0]?.fileUrl ||
    localPreviews[0] ||
    previewUrl;
  const livePreviewType =
    uploadedAssets[0]?.fileType ||
    payloadAsset?.fileType ||
    payloadAsset?.file_type ||
    mediaFiles[0]?.type ||
    "";
  const liveVideoSrc =
    uploadedAssets[0]?.fileUrl ||
    payloadAssetFile ||
    variation.formatPayload?.videoUrl ||
    (livePreviewType.startsWith("video") ? livePreviewUrl : null);
  const liveVideoPoster =
    uploadedAssets[0]?.thumbnailUrl ||
    payloadAssetThumb ||
    (livePreviewType.startsWith("video") ? null : livePreviewUrl) ||
    null;
  const logoUrl =
    logoAssets[0]?.thumbnailUrl ||
    logoAssets[0]?.fileUrl ||
    logoPreviews[0] ||
    (variation.formatPayload as any)?.logoUrl ||
    null;
  const accepts = variation.creativeType === "video" ? "video/*" : "image/*";
  const headlineText = copyDrafts.headline || copyDrafts.subject || variation.name;
  const bodyText =
    copyDrafts.primaryText ||
    copyDrafts.body ||
    copyDrafts.cardDescription ||
    copyDrafts.preheader ||
    "";
  const facebookMedia = livePreviewUrl
    ? {
        id: 0,
        type: (livePreviewType.startsWith("video") ? "video" : "photo") as "video" | "photo",
        url: livePreviewUrl,
        thumbnail: livePreviewUrl,
        caption: headlineText,
      }
    : null;
  const tiktokCreative = livePreviewUrl
    ? {
        id: 0,
        type: (livePreviewType.startsWith("video") ? "video" : "image") as "video" | "image",
        url: livePreviewUrl,
        previewUrl: livePreviewUrl,
        fileUrl: livePreviewUrl,
        title: headlineText,
      }
    : null;
  const googlePreviewAd: GoogleAd = {
    name: variation.name,
    type: "RESPONSIVE_DISPLAY_AD",
    final_urls: ["https://marketingsimplified.com"],
    responsive_display_ad: {
      headlines: [{ text: headlineText || variation.name }],
      long_headline: { text: headlineText || variation.name },
      descriptions: [{ text: bodyText || "Add ad copy to preview." }],
      business_name: "Marketing Simplified",
      marketing_images: livePreviewUrl ? [{ asset: livePreviewUrl, url: livePreviewUrl }] : [],
      square_marketing_images: livePreviewUrl ? [{ asset: livePreviewUrl, url: livePreviewUrl }] : [],
      logo_images: logoUrl ? [{ asset: logoUrl, url: logoUrl }] : [],
      square_logo_images: logoUrl ? [{ asset: logoUrl, url: logoUrl }] : [],
      allow_flexible_color: true,
    },
  };

  const latestEntry = performanceEntries.reduce<VariationPerformanceEntry | null>(
    (latest, entry) => {
      if (!latest) return entry;
      return new Date(entry.recordedAt).getTime() >
        new Date(latest.recordedAt).getTime()
        ? entry
        : latest;
    },
    null
  );
  const latestMetrics = latestEntry?.metrics || {};
  const performancePairs = Object.entries(latestMetrics);
  const summaryMetrics = [
    { label: "CTR", keys: ["ctr", "clickThroughRate"] },
    { label: "CPA", keys: ["cpa", "costPerResult"] },
    { label: "Results", keys: ["results", "conversions", "leads"] },
    { label: "Spend", keys: ["spend", "cost"] },
    { label: "Reach", keys: ["reach"] },
    { label: "Impressions", keys: ["impressions"] },
  ];
  const metricValue = (keys: string[]) => {
    for (const key of keys) {
      if (latestMetrics[key] !== undefined) {
        return latestMetrics[key];
      }
    }
    return "/";
  };
  const metricColor = (label: string) => {
    if (label === "CTR") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (label === "CPA") return "border-rose-200 bg-rose-50 text-rose-700";
    if (label === "Results") return "border-indigo-200 bg-indigo-50 text-indigo-700";
    if (label === "Spend") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-slate-200 bg-slate-50 text-slate-700";
  };

  return (
    <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400">
            {creativePreviewLabel[variation.creativeType]}
          </p>
          {editMode ? (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-base font-semibold text-gray-900"
              placeholder="Ad title"
            />
          ) : (
            <h3 className="text-xl font-semibold text-gray-900">{variation.name}</h3>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Status: <span className="font-semibold text-gray-700">{variation.status}</span>
          </p>
          {!editMode && variation.notes && (
            <p className="mt-2 text-sm text-gray-600">{variation.notes}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {(variation.tags || []).map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                className="inline-flex items-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Save
                <Check className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
              >
                Cancel
                <X className="ml-2 h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Edit
                <Pencil className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() =>
                  AdVariationAPI.duplicateVariation(variation.campaignId, variation.id).then(onRefresh)
                }
                className="inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300"
              >
                Duplicate
                <Copy className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(variation.id)}
                className="inline-flex items-center rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:border-rose-300"
              >
                Delete
                <Trash2 className="ml-2 h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`rounded-3xl border border-indigo-100 bg-white ${previewExpanded ? "p-4" : "p-2"}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Preview</p>
          <button
            onClick={() => setPreviewExpanded((prev) => !prev)}
            className="inline-flex items-center rounded-full border border-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600"
          >
            {previewExpanded ? "Collapse preview" : "Expand preview"}
            {previewExpanded ? <Minimize2 className="ml-2 h-4 w-4" /> : <Maximize2 className="ml-2 h-4 w-4" />}
          </button>
        </div>
        {previewExpanded && (
          <div className="mt-3">
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              {(["native", "facebook", "tiktok", "google"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onPreviewModeChange(mode)}
                  className={`rounded-full px-3 py-1 font-semibold ${
                    previewMode === mode
                      ? "bg-indigo-600 text-white"
                      : "border border-gray-200 text-gray-600"
                  }`}
                >
                  {formatLabel(mode)}
                </button>
              ))}
            </div>
            <div className="rounded-3xl border border-indigo-100 bg-white p-4">
              {previewMode === "native" && (
                <>
                  <div className="h-60 rounded-2xl border border-gray-100 bg-gray-50">
                    {livePreviewUrl ? (
                      livePreviewType.startsWith("video") && liveVideoSrc ? (
                        <video
                          src={liveVideoSrc}
                          poster={liveVideoPoster || undefined}
                          className="h-full w-full rounded-2xl object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <div
                          className="h-full w-full rounded-2xl bg-cover bg-center"
                          style={{ backgroundImage: `url(${livePreviewUrl})` }}
                        />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-widest text-gray-400">
                        Media preview
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-800">{headlineText || "Headline"}</p>
                    <p className="text-[11px] text-gray-400">marketingsimplified.com</p>
                  </div>
                </>
              )}
              {previewMode === "facebook" && (
                <div className="flex items-center justify-center">
                  {facebookMedia ? (
                    <FacebookFeedPreview mediaToShow={facebookMedia} primaryText={bodyText} scale={75} />
                  ) : (
                    <div className="text-xs text-gray-400">
                      Upload media to preview Facebook feed.
                    </div>
                  )}
                </div>
              )}
              {previewMode === "tiktok" && (
                <div className="flex items-center justify-center">
                  {tiktokCreative ? (
                    <TiktokPreview
                      creative={tiktokCreative}
                      identity={
                        logoUrl
                          ? { avatarUrl: logoUrl, displayName: "Marketing Simplified Ads", sponsored: true }
                          : undefined
                      }
                      text={bodyText}
                      allowFullscreen={false}
                      enablePlacementSwitch={false}
                    />
                  ) : (
                    <div className="text-xs text-gray-400">Upload media to preview TikTok.</div>
                  )}
                </div>
              )}
              {previewMode === "google" && (
                <div className="max-h-[520px] overflow-y-auto">
                  <AdPreviewPanel ad={googlePreviewAd} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400">Composer</p>
            <p className="text-lg font-semibold text-gray-900">Post + Preview</p>
          </div>
          <button
            onClick={() => setComposerExpanded((prev) => !prev)}
            className="inline-flex items-center rounded-full border border-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600"
          >
            {composerExpanded ? "Collapse" : "Expand"}
            {composerExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
          </button>
        </div>
        {composerExpanded && (
          <div className="mt-4 space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Post copy
            </p>
            {CREATIVE_FIELDS[variation.creativeType].map((field) => (
              <div key={field.key}>
                <label className="text-[10px] uppercase tracking-widest text-gray-400">
                  {field.label}
                </label>
                {field.key === "primaryText" ||
                field.key === "body" ||
                field.key === "cardDescription" ? (
                  <textarea
                    value={copyDrafts[field.key] || ""}
                    onChange={(event) =>
                      setCopyDrafts((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    rows={3}
                    disabled={!editMode}
                  />
                ) : (
                  <input
                    value={copyDrafts[field.key] || ""}
                    onChange={(event) =>
                      setCopyDrafts((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    disabled={!editMode}
                  />
                )}
              </div>
            ))}
            {editMode && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  {uploadedAssets.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
                      {uploadedAssets.map((asset, index) => {
                        const isVideoAsset = asset.fileType?.startsWith("video");
                        const poster = asset.thumbnailUrl || undefined;
                        return (
                          <div key={asset.id || index} className="relative group">
                            {isVideoAsset ? (
                              <video
                                src={asset.fileUrl}
                                poster={poster}
                                className="h-16 w-full rounded-lg border border-indigo-100 object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <div
                                className="h-16 w-full rounded-lg border border-indigo-100 bg-white bg-cover bg-center"
                                style={{
                                  backgroundImage: `url(${asset.thumbnailUrl || asset.fileUrl})`,
                                }}
                              />
                            )}
                            <button
                              onClick={() => handleRemoveMediaAsset(index)}
                              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              type="button"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3 text-xs text-indigo-600">
                    <input
                      type="file"
                      accept={accepts}
                      multiple={
                        variation.creativeType === "carousel" ||
                        variation.creativeType === "collection"
                      }
                      onChange={(event) => {
                        const files = Array.from(event.target.files || []);
                        setMediaFiles(files);
                        setUploadError(null);
                        if (!files.length) return;
                        const invalid = files.find((file) => !validateFile(file).isValid);
                        if (invalid) {
                          setUploadError("Unsupported file type or size.");
                          return;
                        }
                        setUploading(true);
                        Promise.all(
                          files.map((file) =>
                            attachmentApi.uploadAttachment(file).then((asset) => ({
                              id: asset.id,
                              fileUrl: asset.file_url,
                              thumbnailUrl: asset.thumbnail_url,
                              fileType: asset.file_type,
                            }))
                          )
                        )
                          .then((assets) => {
                            if (
                              variation.creativeType === "carousel" ||
                              variation.creativeType === "collection"
                            ) {
                              setUploadedAssets((prev) => [...prev, ...assets]);
                            } else {
                              setUploadedAssets(assets);
                            }
                          })
                          .catch(() => setUploadError("Upload failed."))
                          .finally(() => setUploading(false));
                      }}
                      className="hidden"
                    />
                    <span className="text-[10px] uppercase tracking-widest text-indigo-400">
                      Upload media
                    </span>
                    <span>
                      {mediaFiles.length
                        ? mediaFiles.map((file) => file.name).join(", ")
                        : "Click to upload image/video"}
                    </span>
                    {uploading && (
                      <span className="text-[11px] text-[#0E8A96]">Uploading...</span>
                    )}
                    {uploadError && (
                      <span className="text-[11px] text-rose-500">{uploadError}</span>
                    )}
                  </label>
                </div>
                <div className="flex flex-col gap-2">
                  {logoAssets.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
                      {logoAssets.map((asset, index) => (
                        <div key={asset.id || index} className="relative group">
                          <div
                            className="h-16 w-full rounded-lg border border-indigo-100 bg-white bg-cover bg-center"
                            style={{
                              backgroundImage: `url(${asset.thumbnailUrl || asset.fileUrl})`,
                            }}
                          />
                          <button
                            onClick={() => handleRemoveLogoAsset(index)}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            type="button"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3 text-xs text-indigo-600">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const files = Array.from(event.target.files || []);
                        setLogoFiles(files);
                        setUploadError(null);
                        if (!files.length) return;
                        const invalid = files.find((file) => !validateFile(file).isValid);
                        if (invalid) {
                          setUploadError("Unsupported file type or size.");
                          return;
                        }
                        setUploading(true);
                        Promise.all(
                          files.map((file) =>
                            attachmentApi.uploadAttachment(file).then((asset) => ({
                              id: asset.id,
                              fileUrl: asset.file_url,
                              thumbnailUrl: asset.thumbnail_url,
                              fileType: asset.file_type,
                            }))
                          )
                        )
                          .then((assets) => {
                            setLogoAssets((prev) => [...prev, ...assets]);
                          })
                          .catch(() => setUploadError("Upload failed."))
                          .finally(() => setUploading(false));
                      }}
                      className="hidden"
                    />
                    <span className="text-[10px] uppercase tracking-widest text-indigo-400">
                      Upload logo
                    </span>
                    <span>
                      {logoFiles.length
                        ? logoFiles.map((file) => file.name).join(", ")
                        : "Click to upload logo image"}
                    </span>
                    {uploading && (
                      <span className="text-[11px] text-[#0E8A96]">Uploading...</span>
                    )}
                    {uploadError && (
                      <span className="text-[11px] text-rose-500">{uploadError}</span>
                    )}
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Details</p>
        <div className="mt-3 space-y-3 text-sm text-gray-600">
          <div>
            <p className="text-xs text-gray-400">Delivery</p>
            {editMode ? (
              <input
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            ) : (
              <p>{delivery || "—"}</p>
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="text-xs text-gray-400">Bid Strategy</p>
              {editMode ? (
                <input
                  value={bidStrategy}
                  onChange={(event) => setBidStrategy(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                />
              ) : (
                <p>{bidStrategy || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400">Budget</p>
              {editMode ? (
                <input
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                />
              ) : (
                <p>{budget || "—"}</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400">Ad Set</p>
            {editMode ? (
              <select
                value={adGroupId ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setAdGroupId(value ? Number(value) : null);
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">No ad set</option>
                {adGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            ) : (
              <p>{adGroups.find((group) => group.id === variation.adGroupId)?.name || "None"}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400">Tags</p>
            {editMode ? (
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                placeholder="tag1, tag2"
              />
            ) : (
              <p>{(variation.tags || []).join(", ") || "None"}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400">Description</p>
            {editMode ? (
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                placeholder="Add a short description"
                rows={3}
              />
            ) : (
              <p>{variation.notes || "No description yet."}</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Performance
          </p>
          <span className="text-xs text-gray-400">
            {performanceEntries.length ? `${performanceEntries.length} entries` : "/"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 rounded-xl border border-gray-100 bg-white p-3 text-xs text-gray-600 md:grid-cols-3">
          {summaryMetrics.map((metric) => (
            <div
              key={metric.label}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 shadow-sm ${metricColor(metric.label)}`}
            >
              <span className="text-[10px] uppercase tracking-widest text-gray-500">
                {metric.label}
              </span>
              <span className="text-sm font-semibold">{metricValue(metric.keys) as any}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {performanceEntries.length === 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center justify-end text-sm text-gray-600">
                <span>/</span>
              </div>
            </div>
          )}
          {performanceEntries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-400">Recorded</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {new Date(entry.recordedAt).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500">
                  {entry.trendIndicator || "/"}
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {Object.entries(entry.metrics || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-gray-600">
                    <span className="uppercase tracking-widest">{key}</span>
                    <span className="font-semibold text-gray-800">{value as any}</span>
                  </div>
                ))}
              </div>
              {entry.observations && (
                <p className="mt-3 text-xs text-gray-500">{entry.observations}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Status History</p>
        <div className="mt-3 space-y-2 text-xs text-gray-600">
          {statusHistory.length === 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-gray-500">/</div>
          )}
          {statusHistory.map((entry: any) => (
            <div key={entry.id} className="rounded-xl border border-gray-100 bg-white px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">
                  {entry.fromStatus} → {entry.toStatus}
                </span>
                <span>{new Date(entry.changedAt).toLocaleString()}</span>
              </div>
              {entry.reason && <p className="mt-1 text-[11px] text-gray-500">{entry.reason}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VariationCreateModal({
  campaignId,
  adGroups,
  onClose,
  onComplete,
}: {
  campaignId: number;
  adGroups: AdGroup[];
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400">Create Variation</p>
            <h2 className="text-2xl font-semibold text-gray-900">New Creative Variation</h2>
          </div>
          <button onClick={onClose} className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600">
            Close
          </button>
        </div>
        <div className="mt-6">
          <VariationForm campaignId={campaignId} adGroups={adGroups} onComplete={onComplete} />
        </div>
      </div>
    </div>
  );
}

function VariationForm({
  campaignId,
  adGroups,
  onComplete,
}: {
  campaignId: number;
  adGroups: AdGroup[];
  onComplete: () => void;
}) {
  const [name, setName] = useState("");
  const [creativeType, setCreativeType] = useState<CreativeType>("image");
  const [status, setStatus] = useState<VariationStatus>("Draft");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [adGroupId, setAdGroupId] = useState<number | null>(null);
  const [delivery, setDelivery] = useState("Active");
  const [bidStrategy, setBidStrategy] = useState("Lowest Cost");
  const [budgetChoice, setBudgetChoice] = useState("100");
  const [budgetCustom, setBudgetCustom] = useState("");
  const [copyEntries, setCopyEntries] = useState<Record<string, string>>({});
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedAssets, setUploadedAssets] = useState<
    { id: number; fileUrl: string; thumbnailUrl: string | null; fileType: string }[]
  >([]);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);
  const [logoFiles, setLogoFiles] = useState<File[]>([]);
  const [logoAssets, setLogoAssets] = useState<
    { id: number; fileUrl: string; thumbnailUrl: string | null; fileType: string }[]
  >([]);
  const [logoPreviews, setLogoPreviews] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [copyErrors, setCopyErrors] = useState<Record<string, string>>({});

  const acceptMap: Record<CreativeType, string> = {
    image: "image/*",
    video: "video/*",
    carousel: "image/*",
    collection: "image/*",
    email: "",
  };

  const deliveryOptions = ["Active", "Learning", "Limited", "Paused"];
  const bidStrategyOptions = ["Lowest Cost", "Cost Cap", "Bid Cap", "ROAS"];
  const budgetOptions = [
    { label: "$25 / day", value: "25" },
    { label: "$50 / day", value: "50" },
    { label: "$100 / day", value: "100" },
    { label: "$250 / day", value: "250" },
    { label: "$500 / day", value: "500" },
    { label: "Custom", value: "custom" },
  ];

  const formatCreateVariationError = (error: any) => {
    const data = error?.response?.data;
    if (!data) return "Create variation failed. Please check required fields.";
    if (typeof data === "string") return data;
    if (Array.isArray(data)) return data.join(", ");
    if (data.detail) return String(data.detail);

    const fieldLabels: Record<string, string> = {
      name: "Name",
      creativeType: "Creative type",
      status: "Status",
      tags: "Tags",
      notes: "Notes",
      adGroupId: "Ad set",
      delivery: "Delivery",
      bidStrategy: "Bid strategy",
      budget: "Budget",
      formatPayload: "Media assets",
      copyElements: "Copy elements",
    };

    const parts = Object.entries(data).map(([key, value]) => {
      const label = fieldLabels[key] || key;
      if (Array.isArray(value)) return `${label}: ${value.join(", ")}`;
      return `${label}: ${String(value)}`;
    });

    return parts.length
      ? `Please check: ${parts.join("; ")}`
      : "Create variation failed. Please check required fields.";
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const nextCopyErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = "Please enter a name.";
    }

    CREATIVE_FIELDS[creativeType].forEach((field) => {
      const value = copyEntries[field.key] || "";
      if (!value.trim()) {
        nextCopyErrors[field.key] = "This field is required.";
      }
    });

    if (Object.keys(nextCopyErrors).length) {
      nextErrors.copyElements = "Please complete all copy fields.";
    }

    setFormErrors(nextErrors);
    setCopyErrors(nextCopyErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const applyServerErrors = (data: any) => {
    const nextErrors: Record<string, string> = {};
    const nextCopyErrors: Record<string, string> = {};
    const fieldLabels: Record<string, string> = {
      name: "Please enter a name.",
      creativeType: "Please choose a creative type.",
      status: "Please choose a status.",
      tags: "Please check your tags.",
      notes: "Please check your notes.",
      adGroupId: "Please select an ad set.",
      delivery: "Please check delivery.",
      bidStrategy: "Please check bid strategy.",
      budget: "Please check budget.",
      formatPayload: "Please add required media assets.",
      copyElements: "Please complete all copy fields.",
    };

    if (data && typeof data === "object") {
      Object.entries(data).forEach(([key, value]) => {
        if (key === "copyElements" || key === "copy_elements") {
          nextErrors.copyElements = fieldLabels.copyElements;
          if (Array.isArray(value)) {
            value.forEach((item) => {
              const fieldKey = item?.elementKey;
              const message =
                Array.isArray(item?.value) ? item.value.join(", ") : item?.value;
              if (fieldKey && message) {
                nextCopyErrors[fieldKey] = String(message);
              }
            });
          }
          return;
        }
        nextErrors[key] = fieldLabels[key] || "Please check this field.";
      });
    }

    setFormErrors(nextErrors);
    setCopyErrors(nextCopyErrors);
  };

  const handleSubmit = async () => {
    if (uploading) return;
    if (!validateForm()) return;
    const budgetValue = budgetChoice === "custom" ? budgetCustom : budgetChoice;
    const budgetNumber = budgetValue ? Number.parseFloat(budgetValue) : NaN;
    const copyElements = CREATIVE_FIELDS[creativeType].map((field, index) => ({
      elementKey: field.key,
      value: copyEntries[field.key] || "",
      position:
        creativeType === "carousel" || creativeType === "collection"
          ? index + 1
          : undefined,
    }));

    try {
      await AdVariationAPI.createVariation(campaignId, {
        name,
        creativeType,
        status,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        notes,
        adGroupId: adGroupId ?? null,
        delivery,
        bidStrategy,
        budget: Number.isFinite(budgetNumber) ? budgetNumber : null,
        formatPayload: {
          mediaFiles: mediaFiles.map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
          })),
          mediaAssets: uploadedAssets.map((asset) => ({
            id: asset.id,
            fileUrl: asset.fileUrl,
            thumbnailUrl: asset.thumbnailUrl,
            fileType: asset.fileType,
          })),
          logoAssets: logoAssets.map((asset) => ({
            id: asset.id,
            fileUrl: asset.fileUrl,
            thumbnailUrl: asset.thumbnailUrl,
            fileType: asset.fileType,
          })),
          previewUrl: uploadedAssets[0]?.thumbnailUrl || uploadedAssets[0]?.fileUrl || null,
          logoUrl: logoAssets[0]?.thumbnailUrl || logoAssets[0]?.fileUrl || null,
        },
        copyElements,
      });
      await onComplete();
    } catch (error: any) {
      applyServerErrors(error?.response?.data);
      toast.error(formatCreateVariationError(error));
    }
  };

  useEffect(() => {
    if (!mediaFiles.length) {
      setLocalPreviews([]);
      return;
    }
    const urls = mediaFiles.map((file) => URL.createObjectURL(file));
    setLocalPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaFiles]);

  useEffect(() => {
    if (!logoFiles.length) {
      setLogoPreviews([]);
      return;
    }
    const urls = logoFiles.map((file) => URL.createObjectURL(file));
    setLogoPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [logoFiles]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">New Variation</h3>
        <div className="mt-4 grid gap-3">
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (formErrors.name) {
                setFormErrors((prev) => ({ ...prev, name: "" }));
              }
            }}
            placeholder="Variation name"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#0E8A96] focus:outline-none"
          />
          {formErrors.name && (
            <p className="text-xs text-rose-600">{formErrors.name}</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white px-2 py-1">
              <BrandSelect
                value={creativeType}
                onValueChange={(v) => setCreativeType(v as CreativeType)}
                options={Object.keys(CREATIVE_FIELDS).map((type) => ({
                  value: type,
                  label: formatLabel(type),
                }))}
                ariaLabel="Creative type"
                widthClass="w-full"
              />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-2 py-1">
              <BrandSelect
                value={status}
                onValueChange={(v) => setStatus(v as VariationStatus)}
                options={STATUS_COLUMNS.map((item) => ({
                  value: item,
                  label: item,
                }))}
                ariaLabel="Status"
                widthClass="w-full"
              />
            </div>
          </div>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="tags (comma separated)"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#0E8A96] focus:outline-none"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white px-2 py-1">
              <BrandSelect
                value={delivery}
                onValueChange={(v) => setDelivery(v)}
                options={deliveryOptions.map((option) => ({
                  value: option,
                  label: option,
                }))}
                ariaLabel="Delivery"
                widthClass="w-full"
              />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-2 py-1">
              <BrandSelect
                value={bidStrategy}
                onValueChange={(v) => setBidStrategy(v)}
                options={bidStrategyOptions.map((option) => ({
                  value: option,
                  label: option,
                }))}
                ariaLabel="Bid strategy"
                widthClass="w-full"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white px-2 py-1">
              <BrandSelect
                value={budgetChoice}
                onValueChange={(v) => setBudgetChoice(v)}
                options={budgetOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                ariaLabel="Budget"
                widthClass="w-full"
              />
            </div>
            {budgetChoice === "custom" && (
              <input
                value={budgetCustom}
                onChange={(event) => setBudgetCustom(event.target.value)}
                placeholder="Custom budget"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#0E8A96] focus:outline-none"
              />
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-2 py-1">
            <BrandSelect
              value={String(adGroupId ?? "")}
              onValueChange={(v) => setAdGroupId(v ? Number(v) : null)}
              options={[
                { value: "", label: "No ad set" },
                ...adGroups.map((group) => ({
                  value: String(group.id),
                  label: group.name,
                })),
              ]}
              ariaLabel="Ad set"
              widthClass="w-full"
            />
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#0E8A96] focus:outline-none"
            rows={4}
          />
          {acceptMap[creativeType] && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="cursor-pointer rounded-2xl border border-dashed border-[#0E8A96]/30 bg-[#0E8A96]/5 p-4 text-sm text-gray-600">
                <input
                  type="file"
                  accept={acceptMap[creativeType]}
                  multiple={creativeType === "carousel" || creativeType === "collection"}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    setMediaFiles(files);
                    setUploadError(null);
                    setUploadedAssets([]);
                    if (!files.length) return;
                    const invalid = files.find((file) => !validateFile(file).isValid);
                    if (invalid) {
                      setUploadError("Unsupported file type or size.");
                      return;
                    }
                    setUploading(true);
                    Promise.all(
                      files.map((file) =>
                        attachmentApi.uploadAttachment(file).then((asset) => ({
                          id: asset.id,
                          fileUrl: asset.file_url,
                          thumbnailUrl: asset.thumbnail_url,
                          fileType: asset.file_type,
                        }))
                      )
                    )
                      .then((assets) => {
                        setUploadedAssets(assets);
                      })
                      .catch(() => setUploadError("Upload failed."))
                      .finally(() => setUploading(false));
                  }}
                  className="hidden"
                />
                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-[#0E8A96]">
                    Upload {creativeType === "video" ? "video" : "images"}
                  </span>
                  <span className="text-sm text-gray-700">
                    Drag files here or click to browse
                  </span>
                  {mediaFiles.length > 0 && (
                    <div className="text-xs text-gray-500">
                      {mediaFiles.map((file) => file.name).join(", ")}
                    </div>
                  )}
                  {uploading && (
                    <span className="text-[11px] text-[#0E8A96]">
                      Uploading...
                    </span>
                  )}
                  {uploadError && (
                    <span className="text-[11px] text-rose-500">
                      {uploadError}
                    </span>
                  )}
                  {uploadedAssets.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {uploadedAssets.map((asset) => {
                        const isVideoAsset = asset.fileType?.startsWith("video");
                        const poster = asset.thumbnailUrl || undefined;
                        return isVideoAsset ? (
                          <video
                            key={asset.id}
                            src={asset.fileUrl}
                            poster={poster}
                            className="h-16 w-full rounded-lg border border-indigo-100 object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <div
                            key={asset.id}
                            className="h-16 w-full rounded-lg border border-indigo-100 bg-white bg-cover bg-center"
                            style={{
                              backgroundImage: `url(${asset.thumbnailUrl || asset.fileUrl})`,
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                  {!uploadedAssets.length && localPreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {localPreviews.map((url, index) => {
                        const fileType = mediaFiles[index]?.type || "";
                        const isVideo = fileType.startsWith("video");
                        return isVideo ? (
                          <video
                            key={url}
                            src={url}
                            className="h-16 w-full rounded-lg border border-indigo-100 object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <div
                            key={url}
                            className="h-16 w-full rounded-lg border border-indigo-100 bg-white bg-cover bg-center"
                            style={{ backgroundImage: `url(${url})` }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </label>
              <label className="cursor-pointer rounded-2xl border border-dashed border-[#0E8A96]/30 bg-[#0E8A96]/5 p-4 text-sm text-gray-600">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    setLogoFiles(files);
                    setUploadError(null);
                    setLogoAssets([]);
                    if (!files.length) return;
                    const invalid = files.find((file) => !validateFile(file).isValid);
                    if (invalid) {
                      setUploadError("Unsupported file type or size.");
                      return;
                    }
                    setUploading(true);
                    Promise.all(
                      files.map((file) =>
                        attachmentApi.uploadAttachment(file).then((asset) => ({
                          id: asset.id,
                          fileUrl: asset.file_url,
                          thumbnailUrl: asset.thumbnail_url,
                          fileType: asset.file_type,
                        }))
                      )
                    )
                      .then((assets) => {
                        setLogoAssets(assets);
                      })
                      .catch(() => setUploadError("Upload failed."))
                      .finally(() => setUploading(false));
                  }}
                  className="hidden"
                />
                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-[#0E8A96]">
                    Upload logo
                  </span>
                  <span className="text-sm text-gray-700">
                    Drag logo here or click to browse
                  </span>
                  {logoFiles.length > 0 && (
                    <div className="text-xs text-gray-500">
                      {logoFiles.map((file) => file.name).join(", ")}
                    </div>
                  )}
                  {logoAssets.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {logoAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="h-16 w-full rounded-lg border border-indigo-100 bg-white bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${asset.thumbnailUrl || asset.fileUrl})`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {!logoAssets.length && logoPreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {logoPreviews.map((url) => (
                        <div
                          key={url}
                          className="h-16 w-full rounded-lg border border-indigo-100 bg-white bg-cover bg-center"
                          style={{ backgroundImage: `url(${url})` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </label>
            </div>
          )}
        </div>
      </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Copy Elements</h3>
        {formErrors.copyElements && (
          <p className="mt-2 text-xs text-rose-600">{formErrors.copyElements}</p>
        )}
        <div className="mt-4 space-y-3">
          {CREATIVE_FIELDS[creativeType].map((field) => (
            <div key={field.key}>
              <label className="text-xs uppercase tracking-widest text-gray-400">
                {field.label}
              </label>
              {field.key === "primaryText" ||
              field.key === "body" ||
              field.key === "cardDescription" ? (
                <textarea
                  value={copyEntries[field.key] || ""}
                  onChange={(event) => {
                    setCopyEntries((prev) => ({ ...prev, [field.key]: event.target.value }));
                    if (copyErrors[field.key]) {
                      setCopyErrors((prev) => ({ ...prev, [field.key]: "" }));
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  rows={3}
                />
              ) : (
                <input
                  value={copyEntries[field.key] || ""}
                  onChange={(event) => {
                    setCopyEntries((prev) => ({ ...prev, [field.key]: event.target.value }));
                    if (copyErrors[field.key]) {
                      setCopyErrors((prev) => ({ ...prev, [field.key]: "" }));
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                />
              )}
              {copyErrors[field.key] && (
                <p className="mt-1 text-xs text-rose-600">{copyErrors[field.key]}</p>
              )}
            </div>
          ))}
          <button
            onClick={handleSubmit}
            className="mt-2 w-full rounded-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-2 text-sm font-semibold text-white shadow transition hover:brightness-105"
          >
            Create Variation
          </button>
        </div>
      </div>
    </div>
  );
}

