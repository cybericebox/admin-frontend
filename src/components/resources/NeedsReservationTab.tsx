"use client"

import { CalendarClock } from "lucide-react"
import type { Event } from "@/api/events/catalog"
import { Button } from "@/components/ui/button"
import { TableState, TableWrap, TimeText } from "@/components/common/DsTable"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { Th } from "./resourceView"

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
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{t("admin.resources.needs.hint")}</p>
    <TableWrap label={t("admin.resources.tabs.needs")} rows={5}>
      <table aria-label={t("admin.resources.tabs.needs")} className="ib-table">
        <thead><tr><Th>{t("admin.resources.col.event")}</Th><Th>{t("admin.resources.needs.col.start")}</Th><Th className="w-px"><span className="sr-only">{t("admin.resources.col.actions")}</span></Th></tr></thead>
        {error && events === null ? <TableState colSpan={3} kind="error" message={t("admin.resources.needs.loadError")} error={error} onRetry={onRetry} />
          : events === null ? <TableState colSpan={3} kind="loading" />
          : events.length === 0 ? <TableState colSpan={3} kind="empty" message={t("admin.resources.needs.empty")} />
          : <tbody>{events.map((event) => <tr key={event.ID} data-testid={`needs-${event.ID}`}>
            <td className="font-medium">{event.Name || event.Tag}</td>
            <td className="ib-table__dim"><TimeText iso={event.AvailableFrom}>{formatDateTime(event.AvailableFrom, { dateStyle: "short", timeStyle: "short" })}</TimeText></td>
            <td className="ib-table__actions">{canRead && <Button type="button" variant="outline" size="sm" onClick={() => onEdit({ eventID: event.ID, name: event.Name })}>
              <CalendarClock className="mr-2 h-4 w-4" aria-hidden />{t("admin.resources.editor.open")}
            </Button>}</td>
          </tr>)}</tbody>}
      </table>
    </TableWrap>
  </div>
}
