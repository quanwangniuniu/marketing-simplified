"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Columns } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ColumnDetectionData } from "@/types/agent"

interface ColumnMappingCardProps {
  data: ColumnDetectionData
  onConfirm: (mapping: Record<string, string>) => void
  onReupload: () => void
}

const categoryLabels: Record<string, string> = {
  identifier: "ID",
  financial: "Financial",
  engagement: "Engagement",
  conversion: "Conversion",
  performance_ratio: "Ratio",
  unknown: "Unknown",
}

const categoryColors: Record<string, string> = {
  identifier: "bg-blue-500/20 text-blue-400",
  financial: "bg-green-500/20 text-green-400",
  engagement: "bg-purple-500/20 text-purple-400",
  conversion: "bg-orange-500/20 text-orange-400",
  performance_ratio: "bg-cyan-500/20 text-cyan-400",
  unknown: "bg-muted text-muted-foreground",
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const colorClass =
    value >= 1.0
      ? "bg-green-500/20 text-green-400"
      : value >= 0.5
      ? "bg-yellow-500/20 text-yellow-400"
      : "bg-red-500/20 text-red-400"
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", colorClass)}>
      {pct}%
    </span>
  )
}

export function ColumnMappingCard({ data, onConfirm, onReupload }: ColumnMappingCardProps) {
  const [editedMappings, setEditedMappings] = useState<Record<string, string>>(
    () => ({ ...data.mappings })
  )
  const [confirmed, setConfirmed] = useState(false)

  const overallPct = Math.round(data.confidence * 100)

  const handleConfirm = () => {
    setConfirmed(true)
    onConfirm(editedMappings)
  }

  const originalHeaders = Object.keys(data.mappings)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 shrink-0">
            <Columns className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              {data.schema_name}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Detected via {data.source === "rule" ? "rule matching" : data.source === "llm" ? "AI" : "unknown"} — {overallPct}% confidence
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        {/* Column table */}
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Original column</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Canonical name</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {originalHeaders.map((header) => {
                const canonical = editedMappings[header] ?? data.mappings[header]
                const isUnknown = canonical === "unknown"
                const canonicalForCategory = isUnknown ? "unknown" : canonical
                const category = data.categories[canonicalForCategory] ?? (isUnknown ? "unknown" : "unknown")
                const confidence = data.column_confidences[header] ?? (isUnknown ? 0 : 1)

                return (
                  <tr key={header} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 text-foreground">{header}</td>
                    <td className="px-3 py-1.5">
                      {confirmed ? (
                        <span className={cn("font-mono", isUnknown && "text-muted-foreground")}>
                          {canonical}
                        </span>
                      ) : (
                        <Input
                          className="h-6 text-xs font-mono px-2 py-0"
                          value={canonical}
                          onChange={(e) =>
                            setEditedMappings((prev) => ({
                              ...prev,
                              [header]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={cn(
                          "text-xs font-medium px-1.5 py-0.5 rounded-full",
                          categoryColors[category] ?? categoryColors.unknown
                        )}
                      >
                        {categoryLabels[category] ?? category}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <ConfidenceBadge value={confidence} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        {!confirmed && (
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleConfirm}>
              Confirm Mapping
            </Button>
            <Button size="sm" variant="outline" onClick={onReupload}>
              Re-upload File
            </Button>
          </div>
        )}

        {confirmed && (
          <p className="text-xs text-muted-foreground">
            Column mapping confirmed. Proceeding with analysis...
          </p>
        )}
      </CardContent>
    </Card>
  )
}
