"use client"

import { useCallback, useRef, useState } from "react"
import { toast } from "@/components/ui/toast"
import { localizedError } from "@/i18n/apiError"
import { usePolling } from "@/lib/usePolling"

/**
 * Live detail of one stand or test lab (mount it per lab, so nothing stale shows): loaded on mount, refreshed quietly in the background
 * (only the first load shows the loader). Instant device switches go through `enqueue`:
 * the value changes at once, the saves run one after another, nothing is disabled while they
 * are pending, polled data is ignored until the last one is done, and an error refetches.
 */
export function useLabDetail<T>(load: () => Promise<T>, enabled: boolean) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const pending = useRef(0)
  const chain = useRef<Promise<void>>(Promise.resolve())

  const run = useCallback(async () => {
    try {
      const next = await load()
      if (pending.current === 0) setData(next)
      setError(null)
    } catch (cause) {
      setError(cause)
    }
  }, [load])

  const { refresh } = usePolling(run, enabled)

  const enqueue = useCallback((apply: (value: T) => T, save: () => Promise<unknown>) => {
    setData((value) => value === null ? value : apply(value))
    pending.current++
    chain.current = chain.current.then(save).then(() => undefined, (cause) => { toast.error(localizedError(cause)) }).then(() => {
      pending.current--
      if (pending.current === 0) void refresh(true)
    })
  }, [refresh])

  return { data, error, refresh: useCallback(() => void refresh(true), [refresh]), enqueue }
}
