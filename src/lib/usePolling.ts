"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export const POLL_INTERVAL_MS = 20_000

/**
 * Runs `load` once when enabled and then every `intervalMs`. The clock pauses
 * while the tab is hidden and, when the tab becomes visible with stale data,
 * refreshes at once. Runs never overlap: a tick during a run is skipped.
 * `refreshing` is true while a run is in flight; `updatedAt` is the time of the
 * last completed run (ms).
 */
export function usePolling(load: () => Promise<void>, enabled: boolean, intervalMs: number = POLL_INTERVAL_MS) {
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const loadRef = useRef(load)
  const inFlight = useRef(false)
  const again = useRef(false)
  const lastRun = useRef(0)

  useEffect(() => { loadRef.current = load })

  // force: the inputs of `load` changed, so a run in flight is stale and one more follows it.
  const refresh = useCallback(async (force = false): Promise<void> => {
    if (inFlight.current) { if (force) again.current = true; return }
    inFlight.current = true
    setRefreshing(true)
    try {
      do {
        again.current = false
        await loadRef.current()
      } while (again.current)
    } finally {
      inFlight.current = false
      lastRun.current = Date.now()
      setUpdatedAt(lastRun.current)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const timer = setInterval(() => { if (!document.hidden) void refresh() }, intervalMs)
    const onVisible = () => { if (!document.hidden && Date.now() - lastRun.current >= intervalMs) void refresh() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible) }
  }, [enabled, intervalMs, refresh])

  return { updatedAt, refreshing, refresh }
}

/** Whole seconds since `since`, re-rendered every second while mounted. */
export function useSecondsSince(since: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (since === null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [since])
  if (since === null) return null
  return Math.max(0, Math.floor((now - since) / 1000))
}
