"use client"
import { useCallback, useState } from "react"
import { apiGet } from "@/api/client"
import { usePolling } from "@/lib/usePolling"

/** The requests that wait for a decision (GET /api/exercises/elevations/pending-count -> {Pending}), for the menu badge; polled quietly, a failure shows nothing. */
export function usePendingElevations(enabled: boolean): number {
  const [pending, setPending] = useState(0)
  const load = useCallback(async () => {
    try { setPending((await apiGet<{ Pending?: number }>("/api/exercises/elevations/pending-count"))?.Pending ?? 0) } catch { /* the badge keeps its last value */ }
  }, [])
  usePolling(load, enabled, 60_000)
  return pending
}
