"use client"

import { LayoutTemplate } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MiroGenerateCardProps {
  onGenerate?: () => void
  disabled?: boolean
  disabledHint?: string
}

export function MiroGenerateCard({ onGenerate, disabled = false, disabledHint }: MiroGenerateCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 shrink-0">
            <LayoutTemplate className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold text-card-foreground">
            Recommended Miro Board
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        <p className="text-sm text-foreground">
          Generate a Miro board from the current analysis and recommended tasks.
        </p>
        {disabled && disabledHint ? (
          <p className="text-xs text-muted-foreground">
            {disabledHint}
          </p>
        ) : null}
        <Button size="sm" variant="outline" onClick={onGenerate} disabled={disabled}>
          Generate Miro
        </Button>
      </CardContent>
    </Card>
  )
}
