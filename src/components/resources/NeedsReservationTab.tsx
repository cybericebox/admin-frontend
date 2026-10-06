"use client"

import { CalendarClock } from "lucide-react"
import type { Event } from "@/api/events/catalog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { BLOCK, THEAD, TROW, Th } from "./resourceView"

type Target = { eventID: string; name: string }

/** Events that may run labs, still ahead of their end, and that the calendar holds no reservation for. */
export function eventsNeedingReservation(events: Event[], reservedIDs: ReadonlySet<string>): Event[] {
  return events.filter((event) => event.InfrastructureAllowed === true
    && event.Status !== "archived"
    && event.LifecycleStatus !== "finished" && event.LifecycleStatus !== "withdrawn"
    && !reservedIDs.has(event.ID))
}

export function NeedsReservationTab({ events, error, onRetry, canRead, onEdit }: {
  events: Event[] | null
  error: unknown
  onRetry: () => void
  canRead: boolean
  onEdit: (target: Target) => void
}) {
  if (error && events === null) return <LoadError className={BLOCK} message={t("admin.resources.needs.loadError")} error={error} onRetry={onRetry} />
  if (events === null) return <LoadingArea className={BLOCK} label={t("admin.loading")} />
  return <Card>
    <CardContent className="space-y-3 pt-6">
      <p className="text-sm text-muted-foreground">{t("admin.resources.needs.hint")}</p>
      {events.length === 0 ? <EmptyState className={BLOCK} message={t("admin.resources.needs.empty")} /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className={THEAD}><tr><Th>{t("admin.resources.col.event")}</Th><Th>{t("admin.resources.needs.col.start")}</Th><Th className="w-px" /></tr></thead>
        <tbody>{events.map((event) => <tr key={event.ID} className={TROW} data-testid={`needs-${event.ID}`}>
          <td className="px-3 py-2"><span className="block font-medium">{event.Name || event.Tag}</span></td>
          <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{formatDateTime(event.AvailableFrom, { dateStyle: "short", timeStyle: "short" })}</td>
          <td className="whitespace-nowrap px-3 py-2 text-right">{canRead && <Button type="button" variant="outline" size="sm" onClick={() => onEdit({ eventID: event.ID, name: event.Name })}>
            <CalendarClock className="mr-2 h-4 w-4" aria-hidden />{t("admin.resources.editor.open")}
          </Button>}</td>
        </tr>)}</tbody></table></div>}
    </CardContent>
  </Card>
}
