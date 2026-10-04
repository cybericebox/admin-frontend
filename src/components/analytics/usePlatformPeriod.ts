"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { DEFAULT_PERIOD, parsePreset, periodRange, type PeriodPreset, type PeriodRange } from "./period"

export type PlatformPeriod = {
  preset: PeriodPreset
  /** RFC 3339 UTC; undefined for `all`. Stable until the preset changes. */
  from?: string
  to?: string
  /** `{from, to}` without the undefined keys, ready for apiGet / getAnalytics. */
  query: PeriodRange
  setPreset: (preset: PeriodPreset) => void
  /** The range recomputed against the clock now (auto-refresh uses it so `to` keeps moving). */
  resolve: () => PeriodRange
}

/**
 * The period of a platform analytics page, kept in the URL (?period=7d|30d|90d|all),
 * default 30d. Uses useSearchParams, so render it under a Suspense boundary
 * (SectionPage does).
 */
export function usePlatformPeriod(): PlatformPeriod {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const preset = parsePreset(params.get("period"))
  const query = useMemo(() => periodRange(preset), [preset])
  const setPreset = useCallback((next: PeriodPreset) => {
    const search = new URLSearchParams(params.toString())
    if (next === DEFAULT_PERIOD) search.delete("period")
    else search.set("period", next)
    const text = search.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }, [params, router, pathname])
  const resolve = useCallback(() => periodRange(preset), [preset])
  return { preset, from: query.from, to: query.to, query, setPreset, resolve }
}
