"use client"

import { AlertCircle, CheckCircle2, Clock, LayoutTemplate, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MiroBoardCardStatus } from "@/lib/agentMiroBoardStatus"
import { AgentMessageBoardText } from "./AgentMessageBoardText"
import { useBuildUrl } from "@/lib/buildUrl"

const TITLE = "Recommended Miro Board"
const BODY =
  "Generate a Miro board from the current analysis and recommended tasks."

interface MiroGenerateCardProps {
  status?: MiroBoardCardStatus
  boardHref?: string
  errorMessage?: string
  messageId?: string
  blockId?: string
  onGenerate?: () => void
  onOpenBoard?: () => void
  disabled?: boolean
  disabledHint?: string
}

export function MiroGenerateCard({
  status = "idle",
  boardHref,
  errorMessage,
  messageId = "miro-generate",
  blockId,
  onGenerate,
  onOpenBoard,
  disabled = false,
  disabledHint,
}: MiroGenerateCardProps) {
  const buildUrl = useBuildUrl();
  const statusChip = (() => {
    if (status === "waiting_tasks_generation") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Waiting for tasks
        </span>
      )
    }
    if (status === "generating") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating…
        </span>
      )
    }
    if (status === "retrying") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Continuing previous…
        </span>
      )
    }
    if (status === "ready") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          Ready
        </span>
      )
    }
    if (status === "failed") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      )
    }
    return null
  })()

  const handleOpenBoard = () => {
    if (onOpenBoard) {
      onOpenBoard()
      return
    }
    if (boardHref && typeof window !== "undefined") {
      window.location.href = buildUrl(boardHref)
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 shrink-0">
            <LayoutTemplate className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              <AgentMessageBoardText
                target={TITLE}
                partId={`${messageId}-miro-title`}
                blockId={blockId}
              />
            </CardTitle>
          </div>
          {statusChip ? <div className="shrink-0">{statusChip}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        <p className="text-sm text-foreground">
          <AgentMessageBoardText target={BODY} partId={`${messageId}-miro-body`} blockId={blockId} />
        </p>
        {disabled && disabledHint ? (
          <p className="text-xs text-muted-foreground">{disabledHint}</p>
        ) : null}
        {status === "failed" && errorMessage ? (
          <p className="text-xs text-destructive line-clamp-3">{errorMessage}</p>
        ) : null}
        {status === "retrying" ? (
          <p className="text-xs text-muted-foreground">
            Continuing previous Miro generation with the saved analysis context.
          </p>
        ) : null}
        {status === "ready" && boardHref ? (
          <Button size="sm" variant="outline" onClick={handleOpenBoard}>
            Open Miro Board
          </Button>
        ) : status === "generating" || status === "retrying" ? (
          <Button size="sm" variant="outline" disabled>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            {status === "retrying" ? "Continuing previous..." : "Generating Miro…"}
          </Button>
        ) : status === "failed" ? (
          <Button size="sm" variant="outline" onClick={onGenerate} disabled={disabled}>
            Try again
          </Button>
        ) : status === "waiting_tasks_generation" ? (
          <Button size="sm" variant="outline" disabled>
            Generate Miro
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onGenerate} disabled={disabled}>
            Generate Miro
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
