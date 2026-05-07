import Link from "next/link"
import { ArrowRight, Clock3 } from "lucide-react"

type HelpAcademyCardLevel = "Beginner" | "Intermediate" | "Advanced"

type HelpAcademyCardItem = {
  level: HelpAcademyCardLevel
  title: string
  durationMinutes: number
  summary: string
  href: string
  ctaLabel?: string
}

type HelpAcademyCardProps = {
  cards: HelpAcademyCardItem[]
}

const levelPillClass: Record<HelpAcademyCardLevel, string> = {
  Beginner: "bg-[#5DBA3A] text-white",
  Intermediate: "bg-[#5DBA3A] text-white",
  Advanced: "bg-[#5DBA3A] text-white",
}

function HelpAcademyCardItemView({
  level,
  title,
  durationMinutes,
  summary,
  href,
  ctaLabel = "Get started",
}: Readonly<HelpAcademyCardItem>) {
  return (
    <article className="flex h-full min-h-[21rem] flex-col rounded-2xl bg-[#94E275] p-8 transition-all duration-200 hover:bg-[#a5ea8c]">
      <span className={`inline-flex h-6 w-fit items-center rounded px-2.5 text-sm font-medium ${levelPillClass[level]}`}>
        {level}
      </span>

      <h3 className="mt-5 text-[34px] font-medium leading-[1.12] tracking-[-0.02em] text-white">{title}</h3>

      <p className="mt-6 flex items-center gap-2 text-lg text-white">
        <Clock3 className="h-[14px] w-[14px]" aria-hidden="true" />
        <span>{durationMinutes} minutes</span>
      </p>

      <p className="mt-4 text-[18px] leading-[1.5] text-white">{summary}</p>

      <Link
        href={href}
        className="group mt-auto inline-flex items-center gap-2.5 pt-8 text-[20px] font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
      >
        {ctaLabel}
        <span className="inline-flex h-[21px] w-[21px] items-center justify-center rounded-full bg-white">
          <ArrowRight
            className="h-3.5 w-3.5 text-[#94E275] transition-transform duration-200 ease-out group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </Link>
    </article>
  )
}

export default function HelpAcademyCard({ cards }: Readonly<HelpAcademyCardProps>) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {cards.map((card) => (
        <HelpAcademyCardItemView key={card.href} {...card} />
      ))}
    </div>
  )
}
