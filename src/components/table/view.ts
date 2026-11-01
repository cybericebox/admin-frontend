"use client"
// The view of an index table (kept in the browser at once and on the server per person, see api/tablePrefs): column order, hidden columns, widths, pinned filter chips, sort and page size.
// The ViewStore is the browser copy (instant, offline); the server copy follows the person across devices and wins on load.
// Pinned filter chips stay in the browser: the server view has no field for them.
import { functionalAllowed } from "@/lib/consent"
import { useCallback, useEffect, useRef, useState } from "react"
import { deleteTablePrefs, getTablePrefs, putTablePrefs, type TablePrefs } from "@/api/tablePrefs"
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
    // functional storage: a view is kept in the browser only with functional consent
    try { if (functionalAllowed()) window.localStorage.setItem(PREFIX + table, JSON.stringify(view)) } catch { /* the view just is not kept */ }
  },
  clear(table) {
    try { window.localStorage.removeItem(PREFIX + table) } catch { /* nothing to clear */ }
  },
}

export type TableViewSpec = { table: string; allKeys: readonly string[]; identity: string; defaultCols: readonly string[]; store?: ViewStore; remote?: boolean }

/** The view as the server prefs: the shown order plus the hidden keys, widths, sort and page size. */
export function toPrefs(view: View, allKeys: readonly string[], identity: string, defaultCols: readonly string[]): TablePrefs {
  const cols = normalizeCols(view.cols ?? defaultCols, allKeys, identity)
  return {
    ColumnOrder: cols,
    Hidden: allKeys.filter((key) => !cols.includes(key)),
    ColumnWidths: view.widths ?? {},
    Sort: view.sort ? { Key: view.sort, Dir: view.dir ?? "asc" } : null,
    PageSize: Number(view.size) || 0,
  }
}

/** The server prefs as a view; a column the prefs do not mention (a new one) shows at the end. */
export function fromPrefs(prefs: TablePrefs, allKeys: readonly string[], identity: string): View {
  const hidden = new Set(prefs.Hidden ?? [])
  const order = (prefs.ColumnOrder ?? []).filter((key) => allKeys.includes(key) && !hidden.has(key))
  const rest = allKeys.filter((key) => !order.includes(key) && !hidden.has(key) && !(prefs.ColumnOrder ?? []).includes(key))
  return {
    cols: normalizeCols([...order, ...rest], allKeys, identity),
    widths: prefs.ColumnWidths && Object.keys(prefs.ColumnWidths).length > 0 ? prefs.ColumnWidths : undefined,
    sort: prefs.Sort?.Key,
    dir: prefs.Sort?.Dir,
    size: prefs.PageSize ? String(prefs.PageSize) : undefined,
  }
}

export function useTableView({ table, allKeys, identity, defaultCols, store = localViewStore, remote = true }: TableViewSpec) {
  const [view, setView] = useState<View>(() => (typeof window === "undefined" ? {} : store.read(table) ?? {}))
  // The latest view lives in a ref too: the stores are written here, never inside a state updater (which React may run late).
  const latest = useRef(view)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // What the server answered at load: the page applies its sort and page size once (they live in the address).
  const [serverView, setServerView] = useState<View | null>(null)
  const cols = normalizeCols(view.cols ?? defaultCols, allKeys, identity)

  useEffect(() => {
    if (!remote) return
    let active = true
    getTablePrefs(table).then((prefs) => {
      if (!active || !prefs) return
      const fromServer = fromPrefs(prefs, allKeys, identity)
      const next = { ...latest.current, ...fromServer }
      latest.current = next
      store.write(table, next)
      setView(next)
      setServerView(fromServer)
    }).catch(() => { /* the browser copy stays */ })
    return () => { active = false }
  }, [table, remote, store, allKeys, identity])

  // Saving is debounced: a drag or a resize is many changes.
  const saveRemote = useCallback(() => {
    if (!remote) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void putTablePrefs(table, toPrefs(latest.current, allKeys, identity, defaultCols)).catch(() => { /* kept in the browser */ }) }, 500)
  }, [remote, table, allKeys, identity, defaultCols])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const update = useCallback((patch: Partial<View>) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    store.write(table, next)
    setView(next)
    saveRemote()
  }, [store, table, saveRemote])

  const reset = useCallback(() => {
    latest.current = {}
    if (timer.current) clearTimeout(timer.current)
    store.clear(table)
    setView({})
    if (remote) void deleteTablePrefs(table).catch(() => { /* nothing saved there */ })
  }, [store, table, remote])
  const changed = !sameCols(cols, normalizeCols(defaultCols, allKeys, identity)) || Object.keys(view.widths ?? {}).length > 0 || (view.pinned?.length ?? 0) > 0

  return { view, cols, update, reset, changed, serverView }
}
