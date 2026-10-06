"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { acknowledgeAlarm, listOpenAlarms, recheckNow, type Alarm } from "@/api/resourceCalendar"
import { Button } from "@/components/ui/button"
import { TableState, TableWrap, TimeText } from "@/components/common/DsTable"
import { toast } from "@/components/ui/toast"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { Badge, Th, formatAmount, useCalendarResource } from "./resourceView"

export function AlarmsTab({ canWrite, version, onChanged }: { canWrite: boolean; version: number; onChanged: () => void }) {
  const { data, error, refresh, setData } = useCalendarResource(listOpenAlarms, true, String(version))
  const [busy, setBusy] = useState<string | null>(null)
  const [rechecking, setRechecking] = useState(false)

  async function acknowledge(alarm: Alarm) {
    setBusy(alarm.ID)
    try {
      const saved = await acknowledgeAlarm(alarm.ID)
      setData((current) => current && current.map((item) => (item.ID === alarm.ID ? { ...item, ...saved } : item)))
      onChanged()
    } catch (err) {
      toast.error(localizedError(err))
    } finally {
      setBusy(null)
    }
  }

  async function recheck() {
    setRechecking(true)
    try {
      await recheckNow()
      toast.success(t("admin.resources.alarms.rechecked"))
      await refresh(true)
      onChanged()
    } catch (err) {
      toast.error(localizedError(err))
    } finally {
      setRechecking(false)
    }
  }

  return <div className="space-y-4">
    {canWrite && <div className="flex justify-end">
      <Button type="button" variant="outline" busy={rechecking} onClick={() => void recheck()}><RefreshCw className="mr-2 h-4 w-4" aria-hidden />{t("admin.resources.alarms.recheck")}</Button>
    </div>}
    <TableWrap label={t("admin.resources.tabs.alarms")} rows={6}>
      <table aria-label={t("admin.resources.tabs.alarms")} className="ib-table">
        <thead><tr><Th>{t("admin.resources.col.event")}</Th><Th>{t("admin.resources.alarms.kind")}</Th><Th>{t("admin.resources.col.agent")}</Th><Th>{t("admin.resources.alarms.shortage")}</Th><Th>{t("admin.resources.alarms.raised")}</Th><Th className="w-32"><span className="sr-only">{t("admin.resources.col.actions")}</span></Th></tr></thead>
        {error && data === null ? <TableState colSpan={6} kind="error" message={t("admin.resources.alarms.loadError")} error={error} onRetry={() => void refresh(true)} />
          : data === null ? <TableState colSpan={6} kind="loading" />
          : data.length === 0 ? <TableState colSpan={6} kind="empty" message={t("admin.resources.alarms.empty")} />
          : <tbody>{data.map((alarm) => <tr key={alarm.ID} data-testid={`alarm-${alarm.ID}`}>
            <td className="font-medium">{alarm.EventName || alarm.EventTag || "—"}</td>
            <td><span className="inline-flex flex-wrap items-center gap-1.5"><Badge tone="warn">{t(`admin.resources.alarms.kind.${alarm.Kind}`)}</Badge><span className="text-xs text-muted-foreground">{t("admin.resources.alarms.stage", { stage: alarm.Stage })}</span></span></td>
            <td className="ib-table__dim">{alarm.AgentName || "—"}{alarm.Units > 0 ? ` ×${alarm.Units}` : ""}</td>
            <td>{formatAmount(alarm.Shortage)}</td>
            <td className="ib-table__dim"><TimeText iso={alarm.RaisedAt}>{formatDateTime(alarm.RaisedAt, { dateStyle: "short", timeStyle: "short" })}</TimeText></td>
            <td className="ib-table__actions">{alarm.AckedAt ? <Badge>{t("admin.resources.alarms.acked")}</Badge>
              : canWrite && <Button type="button" variant="outline" size="sm" busy={busy === alarm.ID} onClick={() => void acknowledge(alarm)}>{t("admin.resources.alarms.acknowledge")}</Button>}</td>
          </tr>)}</tbody>}
      </table>
    </TableWrap>
  </div>
}
