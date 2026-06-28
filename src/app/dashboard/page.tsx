"use client"
import { useEffect, useState } from "react"
import { apiGet } from "@/api/client"
import { t } from "@/i18n/t"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { UserRow } from "@/app/users/page"

type UsersList = { Users: UserRow[]; Total: number }

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

export default function Page() {
  const [list, setList] = useState<UsersList | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiGet<UsersList>("/api/users?limit=1000")
      .then((d) => { if (!cancelled) setList(d) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const total = list?.Total ?? 0
  const admins = (list?.Users ?? []).filter((u) => u.Role === "admin" || u.Role === "super_admin").length
  const blocked = (list?.Users ?? []).filter((u) => u.Status === "blocked").length

  return (
    <div className="frost-in">
      <h1 className="mb-4 text-lg font-semibold text-foreground">{t("admin.dashboard.title")}</h1>
      {error ? (
        <p className="text-sm text-destructive">{t("admin.dashboard.loadError")}</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t("admin.dashboard.totalUsers")} value={total} />
          <StatCard label={t("admin.dashboard.admins")} value={admins} />
          <StatCard label={t("admin.dashboard.blocked")} value={blocked} />
        </div>
      )}
    </div>
  )
}
