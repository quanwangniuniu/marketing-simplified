"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import type { AdGroup, AdVariation } from "@/types/adVariation";
import { AdVariationAPI } from "@/lib/api/adVariationApi";
import BrandButton from "@/components/campaigns-v2/BrandButton";
import BrandConfirmDialog from "@/components/campaigns-v2/BrandConfirmDialog";
import BrandSelect from "@/components/ui/BrandSelect";
import { Button } from "@/components/ui/button";
import VariationSelector from "@/components/ad-variations/VariationSelector";

interface Props {
  campaignId: number;
  adGroups: AdGroup[];
  variations: AdVariation[];
  groupColorClass: (name: string, active?: boolean) => string;
  onRefresh: () => void;
}

export default function AdGroupSection({
  campaignId,
  adGroups,
  variations,
  groupColorClass,
  onRefresh,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedVariationIds, setSelectedVariationIds] = useState<number[]>([]);
  const [groupQuery, setGroupQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<
    { id: number; name: string } | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const groupNameMap = useMemo(() => {
    const map = new Map<number, string>();
    adGroups.forEach((group) => map.set(group.id, group.name));
    return map;
  }, [adGroups]);

  const assignedCount = variations.filter((v) => v.adGroupId).length;
  const unassignedCount = variations.length - assignedCount;

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await AdVariationAPI.createAdGroup(campaignId, { name, description });
      setName("");
      setDescription("");
      toast.success("Ad set created");
      onRefresh();
    } catch {
      toast.error("Failed to create ad set");
    }
  };

  const handleEdit = (group: AdGroup) => {
    setDeleteTarget(null);
    setEditId(group.id);
    setEditName(group.name);
    setEditDescription(group.description || "");
  };

  const handleSave = async () => {
    if (!editId) return;
    try {
      await AdVariationAPI.updateAdGroup(campaignId, editId, {
        name: editName,
        description: editDescription,
      });
      setEditId(null);
      setEditName("");
      setEditDescription("");
      toast.success("Ad set updated");
      onRefresh();
    } catch {
      toast.error("Failed to update ad set");
    }
  };

  const handleAssign = async () => {
    if (selectedGroupId === null || selectedVariationIds.length === 0) return;
    try {
      await AdVariationAPI.assignVariationsToGroup(
        campaignId,
        selectedGroupId,
        selectedVariationIds
      );
      setSelectedVariationIds([]);
      toast.success("Variations assigned");
      onRefresh();
    } catch {
      toast.error("Failed to assign variations");
    }
  };

  const handleUnassign = async () => {
    if (selectedGroupId === null || selectedVariationIds.length === 0) return;
    try {
      await AdVariationAPI.removeVariationsFromGroup(
        campaignId,
        selectedGroupId,
        selectedVariationIds
      );
      setSelectedVariationIds([]);
      toast.success("Variations removed");
      onRefresh();
    } catch {
      toast.error("Failed to remove variations");
    }
  };

  const filteredAdGroups = adGroups.filter((group) =>
    group.name.toLowerCase().includes(groupQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 ring-1 ring-gray-100">
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
            Ad Sets
          </h2>
          <span className="text-[11px] text-gray-400">{adGroups.length}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Cluster variations by audience, funnel stage, or platform.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">
              Ad Sets
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {adGroups.length}
            </p>
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">
              Assigned
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {assignedCount}
            </p>
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">
              Unassigned
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {unassignedCount}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Left column: Create + Assign */}
        <div className="space-y-6">
          {/* Create card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 ring-1 ring-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
                New ad set
              </h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                Optional
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ad set name"
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#0E8A96] focus:outline-none"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description"
                rows={3}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#0E8A96] focus:outline-none"
              />
              <BrandButton onClick={handleCreate} className="w-full">
                <Plus className="h-4 w-4" />
                Add Ad Set
              </BrandButton>
            </div>
          </div>

          {/* Assign card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 ring-1 ring-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
                Assign variations
              </h3>
              <span className="text-[11px] text-gray-500">
                {selectedVariationIds.length} selected
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400">
                  Select ad set
                </p>
                <div className="mt-2 rounded-md border border-gray-200 bg-white px-2 py-1">
                  <BrandSelect
                    value={String(selectedGroupId ?? "")}
                    onValueChange={(v) =>
                      setSelectedGroupId(v ? Number(v) : null)
                    }
                    options={[
                      { value: "", label: "Choose an ad set" },
                      ...adGroups.map((group) => ({
                        value: String(group.id),
                        label: group.name,
                      })),
                    ]}
                    ariaLabel="Select ad set"
                    widthClass="w-full"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white p-3">
                {adGroups.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Create an ad set to assign variations.
                  </p>
                ) : (
                  <VariationSelector
                    variations={variations}
                    selectedIds={selectedVariationIds}
                    groupNameMap={groupNameMap}
                    groupColorClass={groupColorClass}
                    onChange={setSelectedVariationIds}
                  />
                )}
              </div>
              <div className="flex gap-2">
                <BrandButton
                  onClick={handleAssign}
                  disabled={
                    selectedGroupId === null ||
                    selectedVariationIds.length === 0
                  }
                  className="flex-1"
                >
                  Assign
                </BrandButton>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnassign}
                  disabled={
                    selectedGroupId === null ||
                    selectedVariationIds.length === 0
                  }
                  className="flex-1"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Existing */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 ring-1 ring-gray-100">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
              Ad sets
            </h3>
            <input
              value={groupQuery}
              onChange={(event) => setGroupQuery(event.target.value)}
              placeholder="Search ad sets"
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 focus:border-[#0E8A96] focus:outline-none"
            />
          </div>
          <div className="mt-4 space-y-3">
            {filteredAdGroups.map((group) => {
              const groupVariations = variations.filter(
                (v) => v.adGroupId === group.id
              );
              const chipLimit = 5;
              const visibleChips = groupVariations.slice(0, chipLimit);
              const hiddenCount = groupVariations.length - chipLimit;
              return (
                <div
                  key={group.id}
                  className="rounded-md border border-gray-200 bg-white p-4"
                >
                  {editId === group.id ? (
                    <div className="space-y-3">
                      <input
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-[#0E8A96] focus:outline-none"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(event) =>
                          setEditDescription(event.target.value)
                        }
                        rows={2}
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-[#0E8A96] focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <BrandButton onClick={handleSave} className="px-4 py-1 text-xs">
                          Save
                        </BrandButton>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="truncate text-sm font-semibold text-gray-900">
                            {group.name}
                          </h4>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                            {groupVariations.length} variations
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {group.description || "No description"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {visibleChips.map((variation) => (
                            <span
                              key={variation.id}
                              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
                            >
                              {variation.name}
                            </span>
                          ))}
                          {hiddenCount > 0 && (
                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] text-gray-700">
                              +{hiddenCount} more
                            </span>
                          )}
                          {groupVariations.length === 0 && (
                            <span className="text-[10px] text-gray-400">
                              No variations assigned
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(group)}
                        >
                          Edit
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(null);
                            setDeleteTarget({ id: group.id, name: group.name });
                          }}
                          className="rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {adGroups.length === 0 && (
              <p className="py-6 text-center text-xs text-gray-500">
                No ad sets yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <BrandConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete ad set"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? This will unassign all variations.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            setDeleting(true);
            await AdVariationAPI.deleteAdGroup(campaignId, deleteTarget.id);
            toast.success("Ad set deleted");
            setDeleteTarget(null);
            onRefresh();
          } catch {
            toast.error("Failed to delete ad set");
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
