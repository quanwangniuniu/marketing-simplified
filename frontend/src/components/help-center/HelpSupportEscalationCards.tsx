import Link from "next/link"
import { ArrowRight } from "lucide-react"

type SupportEscalationCardTone = "academy" | "community" | "contact"

export type SupportEscalationCardItem = {
  title: string
  description: string
  href: string
  ctaLabel: string
  tone?: SupportEscalationCardTone
}

type HelpSupportEscalationCardsProps = {
  cards: SupportEscalationCardItem[]
}

const toneClassMap: Record<SupportEscalationCardTone, string> = {
  academy: "bg-[#94E275] hover:bg-[#a5ea8c]",
  community: "bg-[#94E275] hover:bg-[#a5ea8c]",
  contact: "bg-[#94E275] hover:bg-[#a5ea8c]",
}

function SupportEscalationCard({
  title,
  description,
  href,
  ctaLabel,
  tone = "academy",
}: Readonly<SupportEscalationCardItem>) {
  return (
    <Link
      href={href}
      className={[
        "group flex min-h-[14rem] w-full flex-col rounded-2xl p-6 shadow-sm transition-all duration-200",
        "cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2",
        toneClassMap[tone],
      ].join(" ")}
    >
      <h3 className="text-2xl font-semibold leading-[1.2] text-white">{title}</h3>
      <p className="mt-3 max-w-[32ch] text-base leading-7 text-white">{description}</p>

      <span className="mt-auto inline-flex items-center gap-2.5 pt-8 text-lg font-medium text-white">
        {ctaLabel}
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#94E275] transition-transform duration-200 ease-out group-hover:translate-x-0.5">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
    </Link>
  )
}

export default function HelpSupportEscalationCards({ cards }: Readonly<HelpSupportEscalationCardsProps>) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {cards.map((card) => (
        <SupportEscalationCard key={card.href} {...card} />
      ))}
    </div>
  )
}
