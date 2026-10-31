"use client"
// The state of an index page (docs/specs/UI-TABLES.md): search, filters (the address, f.<key>), sort, page and size
// (the address, saved with the view), the saved view (columns, widths), the rows of the current request and the selection.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useUrlState } from "@/lib/useUrlState"
import { columnWidth } from "./columns"
import { activeCount, bagFromUrl, serializeCond, urlKey, type FilterBag, type FilterDef } from "./filters"
import { useTableView } from "./view"

export type ColumnDef<Row> = {
  key: string
  label: string
  /** The API's sortBy value; none = not sortable. */
  sort?: string
  width: number
  /** The first click sorts descending (dates, counts). */
  firstDesc?: boolean
  /** Dim text (secondary data). */
  dim?: boolean
  cell: (row: Row) => React.ReactNode
}
export type ListQuery = { search: string; bag: FilterBag; page: number; pageSize: number; sortBy: string; sortDir: "asc" | "desc" }
export type ListPage<Row> = { Items?: Row[] | null; Total?: number }

export function useIndexList<Row>({ table, columns, identity, defs, defaultSort, fetch, rowId, selectable = () => true, selectLimit = 200 }: {
  table: string
  columns: readonly { key: string; width: number }[]
  identity: string
  defs: readonly FilterDef[]
  defaultSort: { key: string; dir: "asc" | "desc" }
  fetch: (query: ListQuery) => Promise<ListPage<Row>>
  rowId: (row: Row) => string
  selectable?: (row: Row) => boolean
  /** «Вибрати всі за фільтром» reads other pages only up to this many rows. */
  selectLimit?: number
}) {
  const allKeys = useMemo(() => columns.map((c) => c.key), [columns])
  const { view, cols, update, reset, changed, serverView } = useTableView({ table, allKeys, identity, defaultCols: allKeys })
  const filterDefaults = Object.fromEntries(defs.map((def) => [urlKey(def.key), ""]))
  const [query, setQuery] = useUrlState({ q: "", page: "1", size: view.size ?? "50", sort: view.sort ?? defaultSort.key, dir: view.dir ?? defaultSort.dir, ...filterDefaults })

  // The saved view arrives after the address was read: its sort and page size apply unless the address names its own.
  useEffect(() => {
    if (!serverView) return
    const own = new URLSearchParams(window.location.search)
    const patch: Record<string, string> = {}
    if (serverView.sort && !own.has("sort") && !own.has("dir")) { patch.sort = serverView.sort; patch.dir = serverView.dir ?? "asc" }
    if (serverView.size && !own.has("size")) patch.size = serverView.size
    if (Object.keys(patch).length > 0) setQuery(patch)
  }, [serverView, setQuery])

  const bag = bagFromUrl(query, defs)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Number(query.size) || 50
  const sortBy = query.sort
  const sortDir: "asc" | "desc" = query.dir === "asc" ? "asc" : "desc"
  const debounced = query.q
  const [search, setSearch] = useState(query.q)

  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [gathering, setGathering] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState<Record<string, number>>({})
  const fetchRef = useRef(fetch)
  useEffect(() => { fetchRef.current = fetch })

  const request: ListQuery = { search: debounced, bag, page, pageSize, sortBy, sortDir }
  const requestKey = JSON.stringify(request)

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setLoading(true); setError(null) } })
    fetchRef.current(JSON.parse(requestKey) as ListQuery)
      .then((d) => { if (active) { setRows(d.Items ?? []); setTotal(d.Total ?? 0) } })
      .catch((cause) => { if (active) setError({ cause }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [requestKey, reloadKey])

  // Debounce the search box into the address; an unchanged query must not reset the page the person moved to.
  useEffect(() => {
    const next = search.trim()
    if (next === debounced) return
    const id = setTimeout(() => { setSelected(new Set()); setQuery({ q: next, page: "1" }) }, 300)
    return () => clearTimeout(id)
  }, [search, debounced, setQuery])

  // Any change of the view starts a new selection: the chosen rows would no longer be the rows on screen.
  const change = useCallback((patch: Record<string, string>) => {
    setSelected(new Set())
    setQuery(patch)
    if ("size" in patch) update({ size: patch.size })
  }, [setQuery, update])
  const setBag = (next: FilterBag) => change({ page: "1", ...Object.fromEntries(defs.map((def) => [urlKey(def.key), serializeCond(next[def.key])])) })
  const resetFilters = () => { setSearch(""); setBag({}); setQuery({ q: "" }) }
  const goToPage = (next: number) => { if (scrollRef.current) scrollRef.current.scrollTop = 0; change({ page: String(next) }) }
  const sort = (field: string, firstDesc = false) => {
    const nextDir = field === sortBy ? (sortDir === "asc" ? "desc" : "asc") : firstDesc ? "desc" : "asc"
    update({ sort: field, dir: nextDir })
    change({ sort: field, dir: nextDir, page: "1" })
  }

  const selectableIds = rows.filter(selectable).map(rowId)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectableIds))
  const canSelectAll = selected.size < total && total <= selectLimit
  async function selectAllMatching(onError: (cause: unknown) => void) {
    setGathering(true)
    try {
      const ids = new Set<string>()
      for (let at = 1; ids.size < total && at <= Math.ceil(selectLimit / 100); at += 1) {
        const res = await fetchRef.current({ ...request, page: at, pageSize: 100 })
        for (const row of res.Items ?? []) if (selectable(row)) ids.add(rowId(row))
        if ((res.Items ?? []).length < 100) break
      }
      setSelected(ids)
    } catch (cause) { onError(cause) } finally { setGathering(false) }
  }

  const byKey = new Map(columns.map((c) => [c.key, c]))
  const widthOf = (key: string) => live[key] ?? columnWidth(byKey.get(key)?.width, view.widths?.[key])
  return {
    request, bag, setBag, search, setSearch, filtered: activeCount(bag) > 0 || query.q !== "", resetFilters,
    page, pageSize, sortBy, sortDir, sort, goToPage, setPageSize: (size: number) => change({ size: String(size), page: "1" }),
    rows, total, loading, error, retry: () => { setError(null); setLoading(true); setReloadKey((k) => k + 1) }, reload: () => setReloadKey((k) => k + 1),
    view, cols, update, resetView: reset, viewChanged: changed, allKeys, widthOf, setLive, scrollRef,
    selected, setSelected, toggle, toggleAll, allSelected, selectableIds, canSelectAll, gathering, selectAllMatching,
  }
}
export type IndexList<Row> = ReturnType<typeof useIndexList<Row>>
