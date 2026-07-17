"use client"
import { useEffect, useState } from "react"
import { apiGet, apiPut } from "@/api/client"
import { t } from "@/i18n/t"
import { Switch } from "@/components/ui/switch"
import { notifTypeLabel } from "@/utils/notifType"
import { Spinner } from "@/components/ui/spinner"

type Setting = {
  NotificationType: string
  Channel: string
  Enabled: boolean
  UserCanChange: boolean
  UserDefault: boolean
}

const rowKey = (s: Setting) => `${s.NotificationType}::${s.Channel}`

export function GlobalSettingsTab() {
  const [rows, setRows] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)
    apiGet<Setting[]>("/api/notifications/settings/global")
      .then((d) => { if (!cancelled) setRows(d ?? []) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function toggle(s: Setting, field: "Enabled" | "UserCanChange" | "UserDefault", value: boolean) {
    const next = { ...s, [field]: value }
    setRows((prev) => prev.map((r) => (rowKey(r) === rowKey(s) ? next : r))) // optimistic
    setSaveError(false)
    try {
      await apiPut("/api/notifications/settings/global", next)
    } catch {
      setSaveError(true)
      setRows((prev) => prev.map((r) => (rowKey(r) === rowKey(s) ? s : r))) // revert
    }
  }

  if (error) return <p className="py-8 text-center text-sm text-destructive">{t("admin.notif.loadError")}</p>
  if (loading) return <div className="flex justify-center py-8"><Spinner label={t("admin.loading")} /></div>
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.notif.settings.empty")}</p>

  return (
    <div className="space-y-3 pt-4">
      {saveError && <p className="text-sm text-destructive">{t("admin.notif.settings.saveError")}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("admin.notif.settings.type")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.notif.settings.channel")}</th>
              <th className="px-3 py-2 font-medium text-center">{t("admin.notif.settings.enabled")}</th>
              <th className="px-3 py-2 font-medium text-center">{t("admin.notif.settings.userCanChange")}</th>
              <th className="px-3 py-2 font-medium text-center">{t("admin.notif.settings.userDefault")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={rowKey(s)} className="border-b border-border/50">
                <td className="px-3 py-2 font-medium text-foreground">{notifTypeLabel(s.NotificationType)}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.Channel}</td>
                <td className="px-3 py-2 text-center"><Switch checked={s.Enabled} onCheckedChange={(v) => toggle(s, "Enabled", v)} /></td>
                <td className="px-3 py-2 text-center"><Switch checked={s.UserCanChange} onCheckedChange={(v) => toggle(s, "UserCanChange", v)} /></td>
                <td className="px-3 py-2 text-center"><Switch checked={s.UserDefault} onCheckedChange={(v) => toggle(s, "UserDefault", v)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
