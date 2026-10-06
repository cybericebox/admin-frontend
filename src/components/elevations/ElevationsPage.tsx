"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { listElevations, type ElevationFilter, type ElevationRequest } from "@/api/elevations"
import { Button } from "@/components/ui/button"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Segmented } from "@/components/ui/segmented"
import { useUrlState } from "@/lib/useUrlState"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"

const FILTERS: ElevationFilter[] = ["pending", "approved", "rejected", ""]

const STATUS_TONE: Record<ElevationRequest["Status"], BadgeTone> = { pending: "info", approved: "ok", rejected: "danger" }

export function StatusBadge({ status }: { status: ElevationRequest["Status"] }) {
  return <Badge data-status={status} tone={STATUS_TONE[status]}>{t(`admin.elevations.status.${status}`)}</Badge>
}

export function ElevationsPage() {
  const [url, setUrl] = useUrlState({ status: "pending" })
  const filter: ElevationFilter = url.status === "all" ? "" : (FILTERS as string[]).includes(url.status) ? url.status as ElevationFilter : "pending"
  const setFilter = (value: ElevationFilter) => setUrl({ status: value === "" ? "all" : value })
  const [state, setState] = useState<{ filter: ElevationFilter; items: ElevationRequest[] | null; error: unknown }>({ filter: "pending", items: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    listElevations(filter)
      .then((items) => { if (!cancelled) setState({ filter, items, error: null }) })
      .catch((error) => { if (!cancelled) setState((current) => ({ filter, items: current.filter === filter ? current.items : null, error })) })
    return () => { cancelled = true }
  }, [filter, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const items = state.filter === filter ? state.items : null
  const loading = items === null && (state.filter !== filter || state.error === null)

  return <div className="flex min-h-full flex-col gap-5">
    <PageHeader title={t("admin.nav.elevations")} sub={t("admin.elevations.subtitle")}
      actions={<Button variant="outline" onClick={retry}><RefreshCw className="mr-2 h-4 w-4" />{t("admin.labs.refresh")}</Button>}
      filters={<Segmented value={filter || "all"} onChange={(value) => setFilter(value === "all" ? "" : value as ElevationFilter)} label={t("admin.elevations.filter")}
        options={FILTERS.map((value) => ({ value: value || "all", label: t(`admin.elevations.filter.${value || "all"}`) }))} />} />

    {loading ? <LoadingArea className="flex-1" label={t("admin.loading")} />
      : !items ? <LoadError message={t("admin.elevations.error.load")} error={state.error} onRetry={retry} className="flex-1" />
      : items.length === 0 ? <EmptyState className="flex-1" message={t(`admin.elevations.empty.${filter || "all"}`)} />
      : <Card><ul className="divide-y divide-border" data-testid="elevations-list">
        {items.map((item) => <li key={item.ID} data-testid={`elevation-${item.ID}`}>
          <Link href={`/elevations/detail?id=${encodeURIComponent(item.ID)}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary">
            <span className="min-w-0 flex-1 basis-56">
              <span className="block truncate text-sm font-medium text-foreground">{item.ExerciseName}</span>
              <span className="block truncate text-sm text-muted-foreground">{item.RequestedByName} · {formatDateTime(item.RequestedAt)}</span>
            </span>
            <span className="text-sm text-muted-foreground">{t("admin.elevations.devicesCount", { count: item.Requested.length })}</span>
            <StatusBadge status={item.Status} />
          </Link>
        </li>)}
      </ul></Card>}
  </div>
}
