"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Visible marker when a budget decision was made by an org-admin outside the
 * assigned approval chain (MED-240). Render only when `is_admin_override` is true.
 */
export function AdminOverrideBadge({
  className,
  label = "Admin override",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Badge
      variant="outline"
      data-testid="admin-override-badge"
      title="Approved or rejected by an organization admin outside the approval chain"
      className={cn(
        "border-amber-300 bg-amber-50 text-amber-900 font-medium",
        className,
      )}
    >
      {label}
    </Badge>
  );
}

/** Strip machine-readable override audit lines from user-facing notes. */
export function stripAdminOverrideNotes(notes?: string | null): string {
  if (!notes) return "";
  return notes
    .split("\n")
    .filter((line) => !line.includes("[ORG_ADMIN_OVERRIDE]"))
    .join("\n")
    .trim();
}
