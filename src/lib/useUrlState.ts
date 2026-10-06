"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

/**
 * List state (filters, sort, page, tab) kept in the query string, so a reload or a shared link restores the view.
 * Values equal to their default are left out of the address. The state lives in React and is mirrored to the address
 * with history.replaceState (no navigation, no request); a change of the address itself (back, a link) is read back.
 * Needs a Suspense boundary above (static export).
 */
export function useUrlState<K extends string>(defaults: Record<K, string>): [Record<K, string>, (patch: Partial<Record<K, string>>) => void] {
  const params = useSearchParams()
  const [fixed] = useState(defaults)
  const read = useCallback((source: URLSearchParams | null): Record<K, string> => {
    const next = {} as Record<K, string>
    for (const key of Object.keys(fixed) as K[]) next[key] = source?.get(key) ?? fixed[key]
    return next
  }, [fixed])
  const [state, setState] = useState(() => read(params ?? (typeof window === "undefined" ? null : new URLSearchParams(window.location.search))))
  // The address changed by something else than this hook: follow it.
  const seen = useRef(params?.toString())
  useEffect(() => {
    const now = params?.toString()
    if (now === seen.current) return
    seen.current = now
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors an external value (the address)
    setState(read(params))
  }, [params, read])

  const set = useCallback((patch: Partial<Record<K, string>>) => {
    setState((current) => ({ ...current, ...patch }))
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(patch) as [K, string | undefined][]) {
      if (value === undefined || value === "" || value === fixed[key]) next.delete(key)
      else next.set(key, value)
    }
    seen.current = next.toString()
    const query = next.toString()
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`)
  }, [fixed])
  return [state, set]
}
