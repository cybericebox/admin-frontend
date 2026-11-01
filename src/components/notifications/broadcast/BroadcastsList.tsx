"use client"
import { useMemo } from "react"
import Link from "next/link"
import { t } from "@/i18n/t"
import { listBroadcastsPage, type Broadcast, type BroadcastStatus } from "@/api/notifications/broadcasts"
import { Button } from "@/components/ui/button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { IndexTable } from "@/components/table/IndexTable"
import { useIndexList, type ColumnDef, type ListQuery } from "@/components/table/useIndexList"
import { isComplete, type FilterDef } from "@/components/table/filters"
import { StatusPill } from "@/components/notifications/StatusPill"
import { formatListDateTime } from "@/lib/locale"
import { useRole } from "@/lib/useRole"
import { audienceLabel } from "./AudiencePicker"
import { broadcastChannelLabel, broadcastHeading, broadcastPillStatus, broadcastStatusLabel } from "./broadcastLabels"

const STATUSES: BroadcastStatus[] = ["sending", "done", "failed", "canceled"]
const COLUMNS = [
  { key: "message", width: 300 }, { key: "channels", width: 160 }, { key: "audience", width: 200 }, { key: "recipients", width: 130 },
  { key: "delivery", width: 140 }, { key: "status", width: 140 }, { key: "author", width: 180 }, { key: "created", width: 180 },
]

function fetchBroadcasts(query: ListQuery) {
  const status = isComplete(query.bag.status) ? query.bag.status.v[0] : ""
  return listBroadcastsPage({ page: query.page, pageSize: query.pageSize, search: query.search, status, sortBy: query.sortBy, sortDir: query.sortDir })
}

/** The «Розсилки» history on the table standard: server paging, sorting, search and the status filter. */
export function BroadcastsList() {
  const canSend = useRole().can("notifications.broadcast")
  const defs = useMemo<FilterDef[]>(() => [
    { key: "status", label: t("admin.notif.logs.status"), type: "choice", single: true, ops: ["in"], options: STATUSES.map((status) => ({ value: status, label: broadcastStatusLabel(status) })) },
  ], [])
  const list = useIndexList<Broadcast>({
    table: "admin.notif.broadcasts", columns: COLUMNS, identity: "message", defs, defaultSort: { key: "created", dir: "desc" },
    fetch: fetchBroadcasts, rowId: (row) => row.ID,
  })
  const detailHref = (row: Broadcast) => `/notifications/broadcasts/detail?id=${encodeURIComponent(row.ID)}`

  const columns: ColumnDef<Broadcast>[] = [
    { key: "message", label: t("admin.notif.broadcast.col.message"), sort: "subject", width: 300, cell: (row) => (
      <HoverTooltip text={broadcastHeading(row)} truncated className="max-w-full">
        <Link href={detailHref(row)} className="block truncate font-medium text-foreground hover:underline">{broadcastHeading(row)}</Link>
      </HoverTooltip>
    ) },
    { key: "channels", label: t("admin.notif.broadcast.channels"), sort: "channels", width: 160, cell: (row) => row.Channels.map(broadcastChannelLabel).join(", ") },
    { key: "audience", label: t("admin.notif.broadcast.audience.title"), sort: "audience", width: 200, cell: (row) => audienceLabel(row.Audience) },
    { key: "recipients", label: t("admin.notif.broadcast.col.recipients"), sort: "recipients", width: 130, cell: (row) => row.RecipientCount },
    { key: "delivery", label: t("admin.notif.broadcast.col.delivery"), sort: "delivered", width: 140, cell: (row) => <span>{row.SentCount} / <span className={row.FailedCount > 0 ? "text-destructive" : undefined}>{row.FailedCount}</span></span> },
    { key: "status", label: t("admin.notif.logs.status"), sort: "status", width: 140, cell: (row) => <StatusPill status={broadcastPillStatus(row.Status)} label={broadcastStatusLabel(row.Status)} /> },
    { key: "author", label: t("admin.notif.broadcast.col.author"), sort: "author", width: 180, cell: (row) => row.CreatedByName || "—" },
    { key: "created", label: t("admin.notif.logs.created"), sort: "created", firstDesc: true, dim: true, width: 180, cell: (row) => formatListDateTime(row.CreatedAt) },
  ]

  return (
    <div className="ib-index">
      <IndexTable<Broadcast>
        list={list} columns={columns} identity="message" title={t("admin.notif.broadcast.title")} rowId={(row) => row.ID} rowLabel={broadcastHeading}
        defs={defs} searchLabel={t("admin.notif.broadcast.search")} emptyLabel={t("admin.notif.broadcast.emptyFiltered")} emptyInitialLabel={t("admin.notif.broadcast.empty")} errorLabel={t("admin.notif.broadcast.loadError")}
        actionsLabel={t("admin.notif.logs.actions")}
        actions={canSend ? <Button asChild><Link href="/notifications/broadcasts/new">{t("admin.notif.broadcast.send")}</Link></Button> : undefined}
      />
    </div>
  )
}
