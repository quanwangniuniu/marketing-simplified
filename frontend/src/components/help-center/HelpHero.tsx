"use client"

import { FormEvent, useId, useState } from "react"
import { Search, X } from "lucide-react"

type HelpHeroProps = {
  title?: string
  helperText?: string
  searchPlaceholder?: string
  heroImageSrc?: string
  heroImageAlt?: string
  onSearchSubmit?: (query: string) => void
  maxQueryLength?: number
}

export default function HelpHero({
  title = "How can we help?",
  searchPlaceholder = "Search for forms, templates, rules, and more",
  heroImageSrc = "/help-center/hero image.png",
  heroImageAlt = "People collaborating while using MediaJira",
  onSearchSubmit,
  maxQueryLength = 120,
}: Readonly<HelpHeroProps>) {
  const inputId = useId()
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [lengthError, setLengthError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      onSearchSubmit?.("")
      return
    }

    if (trimmedQuery.length > maxQueryLength) {
      setLengthError(`Please keep your search under ${maxQueryLength} characters.`)
      return
    }

    setLengthError(null)
    onSearchSubmit?.(trimmedQuery)
  }

  return (
    <section className="flex min-h-[50vh] items-center w-full bg-gradient-to-r from-[#45c8d8] via-[#70d6a8] to-[#b8e36a] py-4 md:py-6 lg:py-8">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 xl:px-10">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold leading-[1.05] tracking-normal text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>

          <form className="mt-6 md:mt-8" onSubmit={handleSubmit}>
            <label htmlFor={inputId} className="sr-only">
              Search help center
            </label>

            <div
              className={[
                "relative mx-auto h-16 w-full max-w-2xl rounded-full border bg-white shadow-sm transition md:h-20",
                "hover:border-white hover:shadow-md",
                isFocused ? "border-white ring-2 ring-white" : "border-white/70",
                lengthError ? "border-red-400 ring-1 ring-red-300" : "",
              ].join(" ")}
            >
              <Search aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-gray-500" />
              <input
                id={inputId}
                type="search"
                name="q"
                autoComplete="off"
                value={query}
                onChange={(event) => {
                  const value = event.target.value
                  setQuery(value)
                  if (lengthError && value.trim().length <= maxQueryLength) {
                    setLengthError(null)
                  }
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={searchPlaceholder}
                className="h-full w-full rounded-full bg-transparent pl-14 pr-14 text-lg text-slate-900 placeholder:text-gray-500 outline-none"
              />

              {query.length > 0 ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("")
                    setLengthError(null)
                  }}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {lengthError ? <p className="mt-2 text-sm text-red-100">{lengthError}</p> : null}
          </form>
        </div>
      </div>
    </section>
  )
}
