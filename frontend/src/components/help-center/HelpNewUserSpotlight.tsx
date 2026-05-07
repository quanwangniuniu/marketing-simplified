import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"

type HelpNewUserSpotlightProps = {
  title?: string
  description?: string
  ctaLabel?: string
  ctaHref?: string
  imageSrc?: string
  imageAlt?: string
}

export default function HelpNewUserSpotlight({
  title = "New to Market?",
  description = "Start with guided onboarding to learn where to organize work, track progress, and collaborate faster.",
  ctaLabel = "Get started",
  ctaHref = "/docs",
  imageSrc = "/help-center/meeting.png",
  imageAlt = "New users onboarding with workspace setup guidance",
}: Readonly<HelpNewUserSpotlightProps>) {
  return (
    <section className="flex min-h-screen items-center bg-white py-10 md:py-12">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-6">
        <div className="mx-auto w-full max-w-[560px] rounded-3xl bg-white shadow-sm lg:max-w-[520px]">
          <div className="relative overflow-hidden rounded-3xl">
            <Image
              src={imageSrc}
              alt={imageAlt}
              width={7800}
              height={5200}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="h-auto w-full object-cover lg:aspect-[16/11]"
            />
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-slate-900 lg:text-5xl">{title}</h2>
          <p className="mt-8 max-w-xl text-2xl leading-8 text-gray-900">{description}</p>
          <Button
            asChild
            size="lg"
            className="ml-auto mt-8 h-14 rounded-full bg-brand-gradient px-8 text-lg leading-8 text-white hover:saturate-150 focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
          >
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
