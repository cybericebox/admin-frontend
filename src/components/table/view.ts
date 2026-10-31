"use client"
// The view of an index table: column order, hidden columns, widths, pinned filter chips, sort and page size.
// A ViewStore keeps it per user and table. The server store (the view follows the user across devices) replaces the
// local one when its API exists; the table code only talks to this interface.
import { useCallback, useRef, useState } from "react"
import { normalizeCols, sameCols } from "./columns"

export type View = {
  cols?: string[]
  widths?: Record<string, number>
  pinned?: string[]
  sort?: string
  dir?: "asc" | "desc"
  size?: string
}

export type ViewStore = {
  read(table: string): View | null
  write(table: string, view: View): void
  clear(table: string): void
}

const PREFIX = "ib.view."

/** Per browser; used until the server store exists. Every access is guarded: storage can be missing or blocked. */
export const localViewStore: ViewStore = {
  read(table) {
    try {
      const raw = window.localStorage.getItem(PREFIX + table)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed && typeof parsed === "object" ? (parsed as View) : null
    } catch { return null }
  },
  write(table, view) {
    try { window.localStorage.setItem(PREFIX + table, JSON.stringify(view)) } catch { /* the view just is not kept */ }
  },
  clear(table) {
    try { window.localStorage.removeItem(PREFIX + table) } catch { /* nothing to clear */ }
  },
}

export type TableViewSpec = { table: string; allKeys: readonly string[]; identity: string; defaultCols: readonly string[]; store?: ViewStore }

export function useTableView({ table, allKeys, identity, defaultCols, store = localViewStore }: TableViewSpec) {
  const [view, setView] = useState<View>(() => (typeof window === "undefined" ? {} : store.read(table) ?? {}))
  const cols = normalizeCols(view.cols ?? defaultCols, allKeys, identity)

  // The latest view lives in a ref too: the store is written here, never inside a state updater (which React may run late).
  const latest = useRef(view)
  const update = useCallback((patch: Partial<View>) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    store.write(table, next)
    setView(next)
  }, [store, table])

  const reset = useCallback(() => { latest.current = {}; store.clear(table); setView({}) }, [store, table])
  const changed = !sameCols(cols, normalizeCols(defaultCols, allKeys, identity)) || Object.keys(view.widths ?? {}).length > 0 || (view.pinned?.length ?? 0) > 0

  return { view, cols, update, reset, changed }
}
