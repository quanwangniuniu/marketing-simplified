import * as React from "react"
import { Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

export interface JiraTicketSummaryProps {
  value: string
  onSave?: (value: string) => void | Promise<void>
  onCancel?: () => void
  placeholder?: string
  className?: string
  startInEdit?: boolean
}

const JiraTicketSummary: React.FC<JiraTicketSummaryProps> = ({
  value,
  onSave,
  onCancel,
  placeholder = "Add summary",
  className,
  startInEdit = false,
}) => {
  const [isEditing, setIsEditing] = React.useState(startInEdit)
  const [draft, setDraft] = React.useState(value)
  const originalValue = React.useRef(value)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  React.useEffect(() => {
    if (!isEditing && value !== draft) {
      setDraft(value)
      originalValue.current = value
    }
  }, [value, isEditing, draft])

  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const startEditing = () => {
    originalValue.current = draft
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setDraft(originalValue.current)
    setIsEditing(false)
    onCancel?.()
  }

  const saveEditing = async () => {
    if (draft === originalValue.current) {
      setIsEditing(false)
      return
    }
    await onSave?.(draft)
    originalValue.current = draft
    setIsEditing(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void saveEditing()
    }
    if (event.key === "Escape") {
      event.preventDefault()
      cancelEditing()
    }
  }

  if (isEditing) {
    const rows = Math.max(2, draft.split("\n").length)

    return (
      <div className={cn("w-full max-w-[900px]", className)}>
        <textarea
          ref={textareaRef}
          value={draft}
          rows={rows}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void saveEditing()}
          aria-label="Edit summary"
          className={cn(
            "w-full resize-none rounded-md border border-[#3CCED7] bg-white px-3 py-2",
            "text-[20px] font-semibold leading-tight text-slate-900",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7] focus-visible:ring-offset-2"
          )}
        />
      </div>
    )
  }

  const displayValue = draft.trim() ? draft : placeholder
  const isPlaceholder = !draft.trim()

  return (
    <div className={cn("group relative w-full max-w-[900px]", className)}>
      <button
        type="button"
        onClick={startEditing}
        onDoubleClick={(event) => {
          event.preventDefault()
          startEditing()
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            startEditing()
          }
        }}
        className={cn(
          "w-full rounded-md px-3 py-2 text-left transition-colors",
          "hover:bg-slate-100 focus-visible:bg-slate-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7] focus-visible:ring-offset-2"
        )}
        aria-label="Edit summary"
      >
        <span
          className={cn(
            "block whitespace-pre-wrap break-words text-[20px] font-semibold leading-tight",
            isPlaceholder ? "text-slate-400" : "text-slate-900"
          )}
        >
          {displayValue}
        </span>
      </button>
      <span
        className={cn(
          "pointer-events-none absolute right-3 top-3 text-slate-400",
          "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        )}
        aria-hidden="true"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </div>
  )
}

export default JiraTicketSummary
