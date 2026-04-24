"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import ConfirmModal from "@/components/ui/ConfirmModal"
import { ImportedCSVFile } from "@/types/agent"
import { AGENT_MESSAGES } from "@/lib/agentMessages"

interface SpreadsheetHeaderProps {
  reports: ImportedCSVFile[]
  selectedSheet: string
  onSheetChange: (value: string) => void
  onDelete: (fileId: string) => void
  loading?: boolean
}

export function SpreadsheetHeader({
  reports,
  selectedSheet,
  onSheetChange,
  onDelete,
  loading = false,
}: SpreadsheetHeaderProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const selectedReport = reports.find((r) => r.filename === selectedSheet)

  return (
    <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="flex h-10 w-[280px] items-center rounded-md border border-input bg-card px-3">
            <Skeleton className="h-4 w-36" />
          </div>
        ) : (
          <Select value={selectedSheet} onValueChange={onSheetChange}>
            <SelectTrigger className="w-[280px] bg-card border-input text-foreground">
              <SelectValue placeholder="Select spreadsheet" />
            </SelectTrigger>
            <SelectContent className="bg-card border-input">
              {reports.length === 0 ? (
                <SelectItem value="__none" disabled>No CSV files found</SelectItem>
              ) : (
                reports.map((r) => (
                  <SelectItem key={r.filename} value={r.filename}>
                    {r.original_filename} ({r.row_count} rows)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}

        {loading ? (
          <Skeleton className="h-9 w-9 rounded-md" />
        ) : selectedReport ? (
          <Button
            variant="outline"
            size="sm"
            className="border-input text-red-400 hover:bg-red-950 hover:text-red-300"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        ) : null}

      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          if (selectedReport) {
            onDelete(selectedReport.id)
          }
        }}
        title={AGENT_MESSAGES.DELETE_CONFIRM_TITLE}
        message={AGENT_MESSAGES.DELETE_CONFIRM_MSG(selectedReport?.original_filename ?? '')}
        confirmText="Delete"
        type="danger"
      />
    </div>
  )
}
