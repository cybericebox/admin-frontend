"use client"

import { useEffect, useState } from "react"
import { apiGet } from "@/api/client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { t } from "@/i18n/t"

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

function last7Days(): string[] {
  const now = new Date()
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now)
    day.setDate(now.getDate() - 6 + index)
    return day.toISOString().slice(0, 10)
  })
}

function UserAnalytics() {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiGet<UserStats>("/api/users/stats")
      .then((data) => { if (!cancelled) setStats(data) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingArea className="h-full" label={t("admin.loading")} />
  if (error || !stats) return <p role="alert" className="text-sm text-destructive">{t("admin.dashboard.loadError")}</p>

  const days = last7Days()
  const countByDay = new Map(stats.RegistrationsByDay.map((entry) => [entry.Day.slice(0, 10), entry.Count]))
  const max = Math.max(1, ...days.map((day) => countByDay.get(day) ?? 0))
  const metrics = [
    { label: t("admin.dashboard.totalUsers"), value: stats.Total },
    { label: t("admin.dashboard.new7d"), value: stats.NewLast7d },
    { label: t("admin.dashboard.active7d"), value: stats.ActiveLast7d },
    { label: t("admin.dashboard.blocked"), value: stats.Blocked },
  ]

  return <div className="space-y-6">
    <div><h2 className="text-xl font-semibold text-foreground">Користувачі</h2><p className="mt-1 text-sm text-muted-foreground">Реєстрації та активність користувачів платформи.</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="rounded-lg border border-border bg-card p-4"><p className="text-sm text-muted-foreground">{metric.label}</p><p className="mt-4 text-2xl font-semibold tabular-nums text-foreground">{metric.value}</p></div>)}</div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="registration-chart-title">
        <h3 id="registration-chart-title" className="text-base font-semibold text-foreground">{t("admin.dashboard.regChart")}</h3>
        <div className="mt-6 flex h-44 items-end gap-2" role="img" aria-label={days.map((day) => `${day}: ${countByDay.get(day) ?? 0}`).join(", ")}>
          {days.map((day) => <div key={day} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2 text-center"><div className="flex min-h-0 flex-1 items-end"><div className="w-full rounded-t-sm bg-primary" style={{ height: `${Math.max(2, ((countByDay.get(day) ?? 0) / max) * 100)}%` }} title={`${day}: ${countByDay.get(day) ?? 0}`} /></div><span className="text-xs tabular-nums text-muted-foreground">{day.slice(5)}</span></div>)}
        </div>
      </section>
      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="role-breakdown-title">
        <h3 id="role-breakdown-title" className="text-base font-semibold text-foreground">За ролями</h3>
        {stats.ByRole.length === 0 ? <EmptyState message="Даних поки немає." compact /> : <dl className="mt-4 divide-y divide-border">{stats.ByRole.map((entry) => <div key={entry.Role} className="flex items-center justify-between gap-3 py-2 text-sm"><dt className="text-muted-foreground">{t(`admin.role.${entry.Role}`)}</dt><dd className="font-medium tabular-nums text-foreground">{entry.Count}</dd></div>)}</dl>}
        <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">Середньодобова активність: <strong className="font-medium tabular-nums text-foreground">{stats.AvgDailyActive7d.toFixed(1)}</strong></p>
      </section>
    </div>
  </div>
}

export default function Page() {
  return <RequirePermission perm="users.read"><UserAnalytics /></RequirePermission>
}
