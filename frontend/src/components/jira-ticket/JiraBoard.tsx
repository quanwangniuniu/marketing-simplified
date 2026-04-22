import * as React from "react"
import { AlertTriangle, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import JiraTicketKey from "@/components/jira-ticket/JiraTicketKey"
import JiraTicketTypeIcon, { JiraTicketType } from "@/components/jira-ticket/JiraTicketTypeIcon"
import { Avatar } from "@/components/avatar/Avatar"

export interface JiraBoardColumnsProps extends React.HTMLAttributes<HTMLDivElement> {
  minWidth?: number
}

const JiraBoardColumns = React.forwardRef<HTMLDivElement, JiraBoardColumnsProps>(
  ({ children, className, minWidth, id = "mj-board-columns-scroll", ...props }, ref) => (
    <div
      ref={ref}
      id={id}
      data-testid="board-columns"
      className={cn(
        "mt-4 w-full min-w-0 max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain pb-2"
      )}
      {...props}
    >
      <div
        className={cn(
          "flex w-max min-w-full items-stretch divide-x divide-slate-200",
          className
        )}
        style={typeof minWidth === "number" ? { minWidth } : undefined}
      >
        {children}
      </div>
    </div>
  )
)
JiraBoardColumns.displayName = "JiraBoardColumns"

export interface JiraBoardColumnProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  count?: number
  showDoneIcon?: boolean
  footer?: React.ReactNode
}

const JiraBoardColumn = React.forwardRef<HTMLDivElement, JiraBoardColumnProps>(
  ({ title, count, showDoneIcon = false, footer, children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex min-h-[420px] min-w-[240px] max-w-[300px] flex-1 basis-0 flex-col overflow-hidden bg-[#f7f8f9]",
        className
      )}
      {...props}
    >
      <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{title}</span>
          {typeof count === "number" ? (
            <span className="shrink-0 rounded-sm bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {count}
            </span>
          ) : null}
        </div>
        {showDoneIcon ? <Check className="h-4 w-4 text-emerald-500" /> : null}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-2 py-2 ">
        {children}
      </div>
      {footer ? <div className="border-t border-slate-200 px-2 py-2">{footer}</div> : null}
    </div>
  )
)
JiraBoardColumn.displayName = "JiraBoardColumn"

export type JiraBoardDueTone = "default" | "warning" | "danger"

export interface JiraDueDateBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  tone?: JiraBoardDueTone
}

export interface JiraBoardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  summary: React.ReactNode
  ticketKey: string
  type: JiraTicketType | string
  dueDate?: string
  dueTone?: JiraBoardDueTone
  assignee?: {
    name: string
    src?: string
    initials?: string
  } | null
  meta?: React.ReactNode
  isDragging?: boolean
  isDropTarget?: boolean
}

const dueToneClasses: Record<JiraBoardDueTone, string> = {
  default: "border-slate-300 bg-white text-slate-500",
  warning: "border-amber-400 bg-white text-amber-600",
  danger: "border-red-500 bg-white text-red-500",
}

const JiraDueDateBadge = React.forwardRef<HTMLDivElement, JiraDueDateBadgeProps>(
  ({ label, tone = "default", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        dueToneClasses[tone],
        className
      )}
      {...props}
    >
      <AlertTriangle className="h-3 w-3" />
      {label}
    </div>
  )
)
JiraDueDateBadge.displayName = "JiraDueDateBadge"

const JiraBoardCard = React.forwardRef<HTMLDivElement, JiraBoardCardProps>(
  (
    {
      summary,
      ticketKey,
      type,
      dueDate,
      dueTone = "default",
      assignee,
      meta,
      isDragging = false,
      isDropTarget = false,
      className,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      className={cn(
        "min-h-[132px] w-full min-w-0 shrink-0 rounded-md border bg-white px-3 py-2.5 text-[13px] shadow-sm transition grid grid-rows-[40px_24px_24px] gap-2 overflow-hidden",
        "border-slate-200 hover:border-slate-300 hover:shadow",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]",
        isDragging && "border-[#3CCED7] bg-[#3CCED7]/10 shadow-lg",
        isDropTarget && "border-[#3CCED7] ring-2 ring-blue-200",
        className
      )}
      {...props}
    >
      {/* min-h-0: Safari grid items default to min-height:auto and won't shrink to the row track, so titles overflow into the next rows; overflow-hidden clips. */}
      <div className="h-[40px] min-h-0 min-w-0 w-full overflow-hidden">
        {typeof summary === "string" ? (
          <div className="line-clamp-2 w-full min-w-0 break-words text-[13px] font-medium leading-5 text-slate-900">
            {summary}
          </div>
        ) : (
          summary
        )}
      </div>
      <div className="h-6 min-h-0 min-w-0 overflow-hidden">
        {dueDate ? (
          <JiraDueDateBadge label={dueDate} tone={dueTone} className="self-start" />
        ) : null}
      </div>
      <div className="flex h-6 min-h-0 min-w-0 items-center justify-between gap-2 overflow-hidden">
        <div className="flex min-w-0 items-center gap-2">
          <JiraTicketTypeIcon type={type} size={18} />
          <JiraTicketKey
            jiraTicketKey={ticketKey}
            onClick={() => {}}
            className="block max-w-[140px] truncate"
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {meta}
          {assignee ? (
            <Avatar
              size="xs"
              src={assignee.src}
              alt={assignee.name}
              fallback={assignee.initials || assignee.name.charAt(0).toUpperCase()}
              className="h-6 w-6 border border-slate-200 bg-slate-100 text-xs text-slate-600"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-500">
              <span className="sr-only">Unassigned</span>
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="3" />
                <path d="M5 19c1.5-3 5-4 7-4s5.5 1 7 4" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  )
)
JiraBoardCard.displayName = "JiraBoardCard"

export { JiraBoardColumns, JiraBoardColumn, JiraBoardCard, JiraDueDateBadge }
