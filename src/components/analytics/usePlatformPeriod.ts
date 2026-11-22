"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { customRange, DEFAULT_PERIOD, parsePreset, periodRange, type PeriodPreset, type PeriodRange } from "./period"

export type PlatformPeriod = {
  /** A preset, or «custom» for a typed date range (?period=custom&from=&to=). */
  preset: PeriodPreset | "custom"
  /** The typed range as dates (YYYY-MM-DD) when `preset` is custom. */
  custom?: { from: string; to: string }
  /** RFC 3339 UTC; undefined for `all`. Stable until the period changes. */
  from?: string
  to?: string
  /** Compare with the previous period of the same length (?compare=1). */
  compare: boolean
  /** `{from, to}` (+ `compare`) without the undefined keys, ready for apiGet / getAnalytics. */
  query: PeriodRange & { compare?: "true" }
  /** One text for the whole choice: what a resource keys its request on. */
  key: string
  setPreset: (preset: PeriodPreset) => void
  setCustom: (from: string, to: string) => void
  setCompare: (compare: boolean) => void
  /** The range recomputed against the clock now (auto-refresh uses it so `to` keeps moving). */
  resolve: () => PeriodRange & { compare?: "true" }
}

/**
 * The period of a platform analytics page, kept in the URL (?period=7d|30d|90d|all|custom, &from= &to= for custom,
 * &compare=1), default 30d. Uses useSearchParams, so render it under a Suspense boundary (SectionPage does).
 */
export function usePlatformPeriod(): PlatformPeriod {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const compare = params.get("compare") === "1"
  const customFrom = params.get("from") ?? ""
  const customTo = params.get("to") ?? ""
  const typed = params.get("period") === "custom" ? customRange(customFrom, customTo) : null
  const preset: PeriodPreset | "custom" = typed ? "custom" : parsePreset(params.get("period") === "custom" ? null : params.get("period"))
  const range = useCallback(() => ({ ...(typed ?? periodRange(preset as PeriodPreset)), ...(compare ? { compare: "true" as const } : {}) }), [typed, preset, compare])
  const query = useMemo(() => range(), [range])
  const replace = useCallback((mutate: (search: URLSearchParams) => void) => {
    const search = new URLSearchParams(params.toString())
    mutate(search)
    const text = search.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }, [params, router, pathname])
  const setPreset = useCallback((next: PeriodPreset) => replace((search) => {
    search.delete("from"); search.delete("to")
    if (next === DEFAULT_PERIOD) search.delete("period")
    else search.set("period", next)
  }), [replace])
  const setCustom = useCallback((from: string, to: string) => replace((search) => { search.set("period", "custom"); search.set("from", from); search.set("to", to) }), [replace])
  const setCompare = useCallback((next: boolean) => replace((search) => { if (next) search.set("compare", "1"); else search.delete("compare") }), [replace])
  const key = `${preset}|${typed ? `${customFrom}|${customTo}` : ""}|${compare ? "c" : ""}`
  return { preset, custom: typed ? { from: customFrom, to: customTo } : undefined, from: query.from, to: query.to, compare, query, key, setPreset, setCustom, setCompare, resolve: range }
}
