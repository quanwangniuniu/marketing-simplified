import * as React from "react"
import { cn } from "@/lib/utils"

export interface JiraTicketKeyProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  jiraTicketKey: string
}

const JiraTicketKey = React.forwardRef<HTMLAnchorElement, JiraTicketKeyProps>(
  ({ jiraTicketKey, className, onClick, ...props }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      onClick?.(event)
    }

    return (
      <a
        ref={ref}
        href="#"
        onClick={handleClick}
        className={cn(
          "text-[11px] font-medium tracking-wide text-slate-400 transition-colors",
          "hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7] focus-visible:ring-offset-2",
          className
        )}
        {...props}
      >
        {jiraTicketKey}
      </a>
    )
  }
)
JiraTicketKey.displayName = "JiraTicketKey"

export default JiraTicketKey
