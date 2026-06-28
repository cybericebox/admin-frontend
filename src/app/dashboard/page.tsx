"use client"
import { useEffect, useState } from "react"
import { apiGet } from "@/api/client"
import { t } from "@/i18n/t"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

type RoleCount = { Role: string; Count: number }
type DayCount = { Day: string; Count: number }
type UserStats = {
  Total: number
  Blocked: number
  NewLast7d: number
  ActiveLast7d: number
  AvgDailyActive7d: number
  ByRole: RoleCount[]
  RegistrationsByDay: DayCount[]
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

// last7DayKeys returns [today-6 … today] as YYYY-MM-DD strings.
function last7DayKeys(): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export default function Page() {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiGet<UserStats>("/api/users/stats")
      .then((d) => { if (!cancelled) setStats(d) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Lay the (zero-or-more) registration days onto a fixed 7-day axis.
  const byDay = new Map<string, number>()
  ;(stats?.RegistrationsByDay ?? []).forEach((d) => byDay.set(d.Day.slice(0, 10), d.Count))
  const dayKeys = last7DayKeys()
  const counts = dayKeys.map((k) => byDay.get(k) ?? 0)
  const max = Math.max(1, ...counts)

  return (
    <div className="frost-in space-y-6">
      {error ? (
        <p className="text-sm text-destructive">{t("admin.dashboard.loadError")}</p>
      ) : loading || !stats ? (
        <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t("admin.dashboard.totalUsers")} value={stats.Total} />
            <StatCard label={t("admin.dashboard.new7d")} value={stats.NewLast7d} />
            <StatCard label={t("admin.dashboard.active7d")} value={stats.ActiveLast7d} />
            <StatCard label={t("admin.dashboard.avgDau")} value={stats.AvgDailyActive7d.toFixed(1)} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("admin.dashboard.regChart")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-end gap-2">
                {dayKeys.map((k, i) => (
                  <div key={k} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-primary/70"
                        style={{ height: `${(counts[i] / max) * 100}%` }}
                        title={`${k}: ${counts[i]}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{k.slice(5)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
