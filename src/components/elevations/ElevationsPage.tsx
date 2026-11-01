"use client"

import { Suspense, useEffect, useMemo } from "react"
import Link from "next/link"
import { listElevations, type ElevationRequest, type ElevationStatus } from "@/api/elevations"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { LoadingArea } from "@/components/ui/spinner"
import { IndexTable, TimeText } from "@/components/table/IndexTable"
import { useIndexList, type ColumnDef, type ListQuery } from "@/components/table/useIndexList"
import { isComplete, type FilterDef } from "@/components/table/filters"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"

const STATUS_TONE: Record<ElevationRequest["Status"], BadgeTone> = { pending: "info", approved: "ok", rejected: "danger" }

export function StatusBadge({ status }: { status: ElevationRequest["Status"] }) {
  return <Badge data-status={status} tone={STATUS_TONE[status]}>{t(`admin.elevations.status.${status}`)}</Badge>
}

const IDENTITY = "exercise"
const STATUSES: ElevationStatus[] = ["pending", "approved", "rejected"]

/** The list is short and comes whole: the status is asked from the API, search, sort and paging are done here. */
async function fetchElevations(query: ListQuery): Promise<{ Items: ElevationRequest[]; Total: number }> {
  const status = isComplete(query.bag.status) ? (query.bag.status.v[0] as ElevationStatus) : ""
  const needle = query.search.trim().toLowerCase()
  const all = (await listElevations(status)).filter((item) => !needle || `${item.ExerciseName} ${item.RequestedByName}`.toLowerCase().includes(needle))
  const factor = query.sortDir === "asc" ? 1 : -1
  const value = (item: ElevationRequest): string | number => query.sortBy === "exercise" ? item.ExerciseName.toLowerCase()
    : query.sortBy === "author" ? item.RequestedByName.toLowerCase()
    : query.sortBy === "devices" ? item.Requested.length
    : query.sortBy === "status" ? item.Status
    : query.sortBy === "decided" ? Date.parse(item.DecidedAt ?? "") || 0
    : Date.parse(item.RequestedAt) || 0
  const sorted = [...all].sort((a, b) => { const x = value(a); const y = value(b); return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "uk")) * factor })
  const from = (query.page - 1) * query.pageSize
  return { Items: sorted.slice(from, from + query.pageSize), Total: sorted.length }
}

const COLUMN_KEYS = [
  { key: IDENTITY, width: 260 }, { key: "author", width: 180 }, { key: "requested", width: 180 },
  { key: "devices", width: 130 }, { key: "status", width: 140 }, { key: "decided", width: 220 },
]

function Elevations() {
  const columns = useMemo<ColumnDef<ElevationRequest>[]>(() => [
    { key: IDENTITY, label: t("admin.elevations.col.exercise"), sort: "exercise", width: 260, cell: (item) => <Link href={`/elevations/detail?id=${encodeURIComponent(item.ID)}`} className="ib-table__name block min-w-0 truncate text-primary hover:underline" title={item.ExerciseName}>{item.ExerciseName}</Link> },
    { key: "author", label: t("admin.elevations.col.author"), sort: "author", width: 180, cell: (item) => item.RequestedByName || "—" },
    { key: "requested", label: t("admin.elevations.col.requestedAt"), sort: "requested", firstDesc: true, dim: true, width: 180, cell: (item) => <TimeText iso={item.RequestedAt}>{formatDateTime(item.RequestedAt)}</TimeText> },
    { key: "devices", label: t("admin.elevations.col.devices"), sort: "devices", firstDesc: true, width: 130, cell: (item) => t("admin.elevations.devicesCount", { count: item.Requested.length }) },
    { key: "status", label: t("admin.elevations.col.status"), sort: "status", width: 140, cell: (item) => <StatusBadge status={item.Status} /> },
    { key: "decided", label: t("admin.elevations.col.decided"), sort: "decided", firstDesc: true, dim: true, width: 220, cell: (item) => item.DecidedAt ? <span>{item.DecidedByName ? `${item.DecidedByName} · ` : ""}<TimeText iso={item.DecidedAt}>{formatDateTime(item.DecidedAt)}</TimeText></span> : "—" },
  ], [])
  const defs = useMemo<FilterDef[]>(() => [
    { key: "status", label: t("admin.elevations.col.status"), type: "choice", single: true, ops: ["in"], options: STATUSES.map((value) => ({ value, label: t(`admin.elevations.status.${value}`) })) },
  ], [])
  const list = useIndexList<ElevationRequest>({
    table: "admin.elevations", columns: COLUMN_KEYS, identity: IDENTITY, defs, defaultSort: { key: "requested", dir: "desc" },
    fetch: fetchElevations, rowId: (item) => item.ID,
  })
  // The page opens on what waits for a decision, unless the address names its own filter.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("f.status")) list.setBag({ status: { op: "in", v: ["pending"] } })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])
  return <div className="ib-index">
    <IndexTable<ElevationRequest>
      list={list} columns={columns} identity={IDENTITY} title={t("admin.nav.elevations")} rowId={(item) => item.ID} rowLabel={(item) => item.ExerciseName}
      defs={defs} searchLabel={t("admin.elevations.search")} emptyLabel={t("admin.elevations.empty.filtered")} emptyInitialLabel={t("admin.elevations.empty.all")}
      errorLabel={t("admin.elevations.error.load")} actionsLabel={t("admin.elevations.col.actions")}
    />
  </div>
}

export function ElevationsPage() {
  return <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><Elevations /></Suspense>
}
