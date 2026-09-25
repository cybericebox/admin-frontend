"use client"
import { useEffect, useState } from "react"
import { apiGet } from "@/api/client"
import { t } from "@/i18n/t"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { StatusPill } from "./StatusPill"
import { notifTypeLabel, notifChannelLabel } from "@/utils/notifType"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"

type KeyCount = { Key: string; Count: number }
type ChannelStatus = { Channel: string; Status: string; Count: number }
type Stats = {
  Since: string
  Total: number
  ByStatus: KeyCount[]
  ByType: KeyCount[]
  ByChannel: ChannelStatus[]
}

const WINDOWS = [7, 30, 90]

export function StatisticsTab() {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadedDays, setLoadedDays] = useState<number | null>(null)
  const [errorDays, setErrorDays] = useState<number | null>(null)
  const error = errorDays === days
  const loading = !error && loadedDays !== days

  useEffect(() => {
    let cancelled = false
    apiGet<Stats>(`/api/notifications/stats?days=${days}`)
      .then((result) => { if (!cancelled) { setStats(result); setLoadedDays(days); setErrorDays(null) } })
      .catch(() => { if (!cancelled) setErrorDays(days) })
    return () => { cancelled = true }
  }, [days])

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.stats.window")}</span>
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setDays(w)}
            className={"rounded-md px-3 py-1 text-sm transition-colors " + (days === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent/30")}
          >{w}</button>
        ))}
      </div>

      {error ? (
        <p className="py-8 text-center text-sm text-destructive">{t("admin.notif.loadError")}</p>
      ) : loading || !stats ? (
        <LoadingArea label={t("admin.loading")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.stats.total")}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold text-foreground">{stats.Total}</p></CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.stats.byStatus")}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {stats.ByStatus.length === 0 ? <EmptyState message={t("admin.notif.stats.empty")} compact /> :
                stats.ByStatus.map((s) => (
                  <div key={s.Key} className="flex items-center justify-between text-sm">
                    <StatusPill status={s.Key} /><span className="font-medium text-foreground">{s.Count}</span>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.stats.byType")}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {stats.ByType.length === 0 ? <EmptyState message={t("admin.notif.stats.empty")} compact /> :
                stats.ByType.map((s) => (
                  <div key={s.Key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{notifTypeLabel(s.Key)}</span><span className="font-medium text-foreground">{s.Count}</span>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.stats.byChannel")}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {stats.ByChannel.length === 0 ? <EmptyState message={t("admin.notif.stats.empty")} compact /> :
                stats.ByChannel.map((c, i) => (
                  <div key={`${c.Channel}-${c.Status}-${i}`} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{notifChannelLabel(c.Channel)}</span>
                    <span className="flex items-center gap-2"><StatusPill status={c.Status} /><span className="font-medium text-foreground">{c.Count}</span></span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
