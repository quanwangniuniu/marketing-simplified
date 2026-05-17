"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { SpreadsheetHeader } from "./SpreadsheetHeader"
import { DataTable } from "./DataTable"
import { AnalysisResults } from "./AnalysisResults"
import { AgentAPI } from "@/lib/api/agentApi"
import { ImportedCSVFile } from "@/types/agent"
import { AGENT_MESSAGES } from "@/lib/agentMessages"
export function SpreadsheetView() {
  const [reports, setReports] = useState<ImportedCSVFile[]>([])
  const [selectedSheet, setSelectedSheet] = useState("")
  const [reportsLoading, setReportsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const list = await AgentAPI.fetchReports()
        setReports(list)
        if (list.length > 0) setSelectedSheet(list[0].filename)
      } catch {
      } finally {
        setReportsLoading(false)
      }
    }
    load()
  }, [])

  const handleDelete = async (fileId: string) => {
    try {
      await AgentAPI.deleteReport(fileId)
      const list = await AgentAPI.fetchReports()
      setReports(list)
      const deletedReport = reports.find((r) => r.id === fileId)
      if (deletedReport && deletedReport.filename === selectedSheet) {
        setSelectedSheet(list.length > 0 ? list[0].filename : "")
      }
      toast.success(AGENT_MESSAGES.DELETE_SUCCESS)
    } catch {
      toast.error(AGENT_MESSAGES.DELETE_FAILED)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <SpreadsheetHeader
        reports={reports}
        selectedSheet={selectedSheet}
        onSheetChange={setSelectedSheet}
        onDelete={handleDelete}
        loading={reportsLoading}
      />
      <DataTable
        fileId={reports.find((r) => r.filename === selectedSheet)?.id ?? ""}
        loading={reportsLoading}
      />
      <AnalysisResults filename={selectedSheet} loading={reportsLoading} />
    </div>
  )
}
