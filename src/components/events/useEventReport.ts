"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export const REPORT_POLL_MS = 30_000

/**
 * Loads one read-only report and re-reads it every `pollMs` (0: once). `key` names the inputs
 * (filters): a change re-reads while the previous data stays on screen, so nothing flashes.
 * `loading` is the very first load only. A failed background poll keeps the data and stays
 * silent; a failed load for a new key or a retry sets `error`.
 */
export function useEventReport<T>(load: () => Promise<T>, key: string, { enabled = true, pollMs = REPORT_POLL_MS }: { enabled?: boolean; pollMs?: number } = {}) {
  const [state, setState] = useState<{ data?: T; error?: unknown; hasError: boolean }>({ hasError: false })
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  useEffect(() => {
    if (!enabled) return
    let active = true
    const run = async (silent: boolean) => {
      try {
        const data = await loadRef.current()
        if (active) setState({ data, hasError: false })
      } catch (error) {
        if (active && !silent) setState((prev) => ({ data: prev.data, error, hasError: true }))
      }
    }
    void run(false)
    const timer = pollMs > 0 ? setInterval(() => { if (!document.hidden) void run(true) }, pollMs) : undefined
    return () => { active = false; if (timer) clearInterval(timer) }
  }, [enabled, key, pollMs, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { data: state.data, error: state.error, failed: state.hasError, loading: enabled && state.data === undefined && !state.hasError, retry }
}
