"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { t } from "@/i18n/t"
import { listBroadcasts, type Broadcast } from "@/api/notifications/broadcasts"
import type { CursorPage } from "@/api/pagination"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea, Spinner } from "@/components/ui/spinner"
import { SelectMenu } from "@/components/ui/select-menu"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { StatusPill } from "@/components/notifications/StatusPill"
import { useRole } from "@/lib/useRole"
import { audienceLabel } from "./AudiencePicker"
import { broadcastChannelLabel, broadcastHeading, broadcastPillStatus, broadcastStatusLabel } from "./broadcastLabels"

const PAGE_SIZES = [25, 50, 100]

export function BroadcastsList() {
  const router = useRouter()
  const canSend = useRole().can("notifications.broadcast")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [reload, setReload] = useState(0)
  const [data, setData] = useState<{ query: string; page: CursorPage<Broadcast> } | null>(null)
  const [errorQuery, setErrorQuery] = useState<{ query: string; cause: unknown } | null>(null)

  const cursor = cursors[page - 1]
  const query = `${pageSize}:${cursor ?? ""}:${reload}`
  const failure = errorQuery?.query === query ? errorQuery : null
  const loading = !failure && data?.query !== query

  useEffect(() => {
    let cancelled = false
    listBroadcasts({ limit: pageSize, cursor })
      .then((result) => { if (!cancelled) { setData({ query, page: result }); setErrorQuery(null) } })
      .catch((cause) => { if (!cancelled) setErrorQuery({ query, cause }) })
    return () => { cancelled = true }
  }, [query, pageSize, cursor])

  const current = data?.query === query ? data.page : null
  const rows = current?.Items ?? []
  const total = current?.Total ?? 0
  const nextCursor = current?.NextCursor
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="frost-panel frost-in flex h-full min-h-0 flex-col overflow-hidden rounded-lg p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">{t("admin.notif.broadcast.title")}</h1>
        {canSend && <Button asChild><Link href="/notifications/broadcasts/new">{t("admin.notif.broadcast.send")}</Link></Button>}
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto" aria-busy={loading}>
        {failure ? (
          <LoadError message={t("admin.notif.broadcast.loadError")} error={failure.cause} onRetry={() => setReload((value) => value + 1)} className="h-full" />
        ) : loading ? (
          <LoadingArea className="h-full" label={t("admin.loading")} />
        ) : rows.length === 0 ? (
          <EmptyState message={t("admin.notif.broadcast.empty")} className="h-full" />
        ) : (
          <div className="min-w-[960px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-border bg-background text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcast.col.message")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcast.channels")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcast.audience.title")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcast.col.recipients")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcast.col.delivery")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.logs.status")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcast.col.author")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.logs.created")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.ID} onClick={() => router.push(`/notifications/broadcasts/detail?id=${encodeURIComponent(row.ID)}`)} className="cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/10">
                    <td className="max-w-72 px-3 py-2 font-medium text-foreground">
                      <HoverTooltip text={broadcastHeading(row)} truncated className="max-w-full">
                        <Link href={`/notifications/broadcasts/detail?id=${encodeURIComponent(row.ID)}`} onClick={(event) => event.stopPropagation()} className="block truncate hover:underline">{broadcastHeading(row)}</Link>
                      </HoverTooltip>
                    </td>
                    <td className="px-3 py-2 text-foreground">{row.Channels.map(broadcastChannelLabel).join(", ")}</td>
                    <td className="px-3 py-2 text-foreground">{audienceLabel(row.Audience)}</td>
                    <td className="px-3 py-2 text-foreground">{row.RecipientCount}</td>
                    <td className="px-3 py-2 text-foreground">{row.SentCount} / <span className={row.FailedCount > 0 ? "text-destructive" : undefined}>{row.FailedCount}</span></td>
                    <td className="px-3 py-2"><StatusPill status={broadcastPillStatus(row.Status)} label={broadcastStatusLabel(row.Status)} /></td>
                    <td className="px-3 py-2 text-foreground">{row.CreatedByName || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(row.CreatedAt).toLocaleString("uk-UA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-auto grid shrink-0 grid-cols-1 items-center gap-3 border-t border-border pt-4 text-sm text-muted-foreground sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-3"><span>{t("admin.table.total")}: {total}</span><span>{t("admin.table.page")} {page} {t("admin.table.of")} {pageCount}</span>{loading && data && <Spinner size="sm" label={t("admin.table.updating")} />}</div>
        <div className="flex gap-2 sm:justify-center">
          <Button variant="outline" size="sm" disabled={loading || page === 1} onClick={() => setPage(page - 1)}>{t("admin.table.previous")}</Button>
          <Button variant="outline" size="sm" disabled={loading || !nextCursor} onClick={() => { if (nextCursor) { setCursors((list) => [...list.slice(0, page), nextCursor]); setPage(page + 1) } }}>{t("admin.table.next")}</Button>
        </div>
        <div className="flex items-center gap-2 sm:justify-end"><span>{t("admin.table.perPage")}</span><SelectMenu value={String(pageSize)} onChange={(value) => { setPage(1); setCursors([null]); setPageSize(Number(value)) }} ariaLabel={t("admin.table.perPage")} options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))} className="w-20" disabled={loading} /></div>
      </div>
    </div>
  )
}
