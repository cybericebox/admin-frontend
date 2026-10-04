"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { acknowledgeAlarm, listOpenAlarms, recheckNow, type Alarm } from "@/api/resourceCalendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { Badge, BLOCK, THEAD, TROW, Th, formatAmount, useCalendarResource } from "./resourceView"

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
    <Card><CardContent className="p-4">
      {error && data === null ? <LoadError className={BLOCK} message={t("admin.resources.alarms.loadError")} error={error} onRetry={() => void refresh(true)} />
        : data === null ? <LoadingArea className={BLOCK} label={t("admin.loading")} />
        : data.length === 0 ? <EmptyState className={BLOCK} message={t("admin.resources.alarms.empty")} />
        : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className={THEAD}><tr><Th>{t("admin.resources.col.event")}</Th><Th>{t("admin.resources.alarms.kind")}</Th><Th>{t("admin.resources.col.agent")}</Th><Th>{t("admin.resources.alarms.shortage")}</Th><Th>{t("admin.resources.alarms.raised")}</Th><Th className="w-32"><span className="sr-only">{t("admin.resources.col.actions")}</span></Th></tr></thead>
          <tbody>{data.map((alarm) => <tr key={alarm.ID} className={TROW} data-testid={`alarm-${alarm.ID}`}>
            <td className="px-3 py-2 font-medium">{alarm.EventName || alarm.EventTag || "—"}</td>
            <td className="px-3 py-2"><span className="inline-flex flex-wrap items-center gap-1.5"><Badge tone="warn">{t(`admin.resources.alarms.kind.${alarm.Kind}`)}</Badge><span className="text-xs text-muted-foreground">{t("admin.resources.alarms.stage", { stage: alarm.Stage })}</span></span></td>
            <td className="px-3 py-2 text-muted-foreground">{alarm.AgentName || "—"}{alarm.Units > 0 ? ` ×${alarm.Units}` : ""}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatAmount(alarm.Shortage)}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{formatDateTime(alarm.RaisedAt, { dateStyle: "short", timeStyle: "short" })}</td>
            <td className="px-3 py-2">{alarm.AckedAt ? <Badge>{t("admin.resources.alarms.acked")}</Badge>
              : canWrite && <Button type="button" variant="outline" size="sm" busy={busy === alarm.ID} onClick={() => void acknowledge(alarm)}>{t("admin.resources.alarms.acknowledge")}</Button>}</td>
          </tr>)}</tbody></table></div>}
    </CardContent></Card>
  </div>
}
