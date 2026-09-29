"use client"

import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { ApiError } from "@/api/client"
import { getAnalytics, type AnalyticsParams } from "@/api/platformAnalytics"
import { usePolling } from "@/lib/usePolling"
import { SectionContext } from "./sectionContext"

export type AnalyticsResource<T> = {
  data: T | undefined
  loading: boolean
  error: unknown
  /** The API answered 403; SectionPage then shows the error screen. */
  forbidden: boolean
  updatedAt: number | null
  /** Refetch with the loading state (a retry). */
  reload: () => void
}

/**
 * GET /api/analytics/<section> with cancellation. Inside SectionPage the chosen
 * period (from / to) is added to the query, and, when auto-refresh is on, the data
 * is refetched silently on an interval. `params` (extra filters) override the period
 * keys. Pass `{ period: false }` for a section that ignores the period.
 */
export function useAnalyticsResource<T>(section: string, params: AnalyticsParams = {}, options: { period?: boolean } = {}): AnalyticsResource<T> {
  const ctx = useContext(SectionContext)
  const withPeriod = options.period !== false && ctx !== null
  const key = `${section}|${JSON.stringify(params)}|${withPeriod ? ctx?.period.preset : "-"}`
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown; done: boolean; at: number | null }>({ key, done: false, at: null })
  const latest = useRef({ section, params, withPeriod, ctx, key })
  const controller = useRef<AbortController | null>(null)
  const started = useRef<string | null>(null)
  const hasData = useRef(false)

  useEffect(() => { latest.current = { section, params, withPeriod, ctx, key } })
  useEffect(() => () => { controller.current?.abort(); started.current = null }, [])

  const run = useCallback(async (silent: boolean) => {
    const cur = latest.current
    controller.current?.abort()
    const ctl = new AbortController()
    controller.current = ctl
    started.current = cur.key
    if (!silent) setState((prev) => ({ key: cur.key, data: prev.key === cur.key ? prev.data : undefined, done: false, at: prev.at }))
    cur.ctx?.reportBusy(1)
    try {
      const query = { ...(cur.withPeriod && cur.ctx ? cur.ctx.period.resolve() : {}), ...cur.params }
      const data = await getAnalytics<T>(cur.section, query, { signal: ctl.signal })
      if (ctl.signal.aborted) return
      const at = Date.now()
      hasData.current = true
      setState({ key: cur.key, data, done: true, at })
      cur.ctx?.reportUpdated(at)
      cur.ctx?.reportForbidden(false)
    } catch (error) {
      if (ctl.signal.aborted) return
      if (silent && hasData.current) return // a failed background refresh keeps the last data
      setState((prev) => ({ key: cur.key, done: true, error, at: prev.at }))
      if (error instanceof ApiError && error.status === 403) cur.ctx?.reportForbidden(true)
    } finally {
      cur.ctx?.reportBusy(-1)
    }
  }, [])

  const polling = ctx?.autoRefresh ?? false
  const { refresh } = usePolling(useCallback(async () => { await run(hasData.current) }, [run]), polling)

  useEffect(() => {
    if (started.current === key) return
    hasData.current = false
    if (polling) void refresh(true)
    else void run(false)
  }, [key, polling, refresh, run])

  const current = state.key === key
  const error = current ? state.error : undefined
  return {
    data: current ? state.data : undefined,
    loading: !current || !state.done,
    error,
    forbidden: error instanceof ApiError && error.status === 403,
    updatedAt: state.at,
    reload: useCallback(() => { void run(false) }, [run]),
  }
}
