"use client"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { apiGet, apiPut } from "@/api/client"
import { t } from "@/i18n/t"
import { Switch } from "@/components/ui/switch"
import { notifChannelLabel, notifTypeLabel } from "@/utils/notifType"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { toast } from "@/components/ui/toast"
import { SignalDefaultsSection } from "@/components/notifications/SignalDefaultsSection"

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
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Saves run one after another; the switches react at once and are never disabled by a pending save.
  // latest is set together with rows, so a click right after the load never sees an empty list.
  const latest = useRef<Setting[]>([])
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    apiGet<Setting[]>("/api/notifications/settings/global")
      .then((d) => {
        if (cancelled) return
        latest.current = d ?? []
        setRows(latest.current)
      })
      .catch((cause) => { if (!cancelled) setError({ cause }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [attempt])

  function patchRow(key: string, field: "Enabled" | "UserCanChange" | "UserDefault", value: boolean) {
    const next = latest.current.map((r) => (rowKey(r) === key ? { ...r, [field]: value } : r))
    latest.current = next
    setRows(next)
  }

  function toggle(s: Setting, field: "Enabled" | "UserCanChange" | "UserDefault", value: boolean) {
    const key = rowKey(s)
    const previous = latest.current.find((r) => rowKey(r) === key)?.[field] ?? s[field]
    patchRow(key, field, value) // optimistic
    queue.current = queue.current.then(async () => {
      const wanted = latest.current.find((r) => rowKey(r) === key)
      if (!wanted) return
      try {
        await apiPut("/api/notifications/settings/global", wanted)
        toast.success(t("admin.notif.settings.saved"))
      } catch {
        toast.error(t("admin.notif.settings.saveError"))
        // Roll back only this field, and only if the user has not changed it again since.
        if (latest.current.find((r) => rowKey(r) === key)?.[field] === value) patchRow(key, field, previous)
      }
    })
  }

  let globalSettings: ReactNode
  if (error) {
    globalSettings = <LoadError message={t("admin.notif.loadError")} error={error.cause} onRetry={() => { setError(null); setLoading(true); setAttempt((key) => key + 1) }} />
  } else if (loading) {
    globalSettings = <LoadingArea label={t("admin.loading")} />
  } else if (rows.length === 0) {
    globalSettings = <EmptyState message={t("admin.notif.settings.empty")} />
  } else {
    globalSettings = (
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
                <td className="px-3 py-2 text-muted-foreground">{notifChannelLabel(s.Channel)}</td>
                <td className="px-3 py-2 text-center"><Switch checked={s.Enabled} onCheckedChange={(v) => toggle(s, "Enabled", v)} /></td>
                <td className="px-3 py-2 text-center"><Switch checked={s.UserCanChange} onCheckedChange={(v) => toggle(s, "UserCanChange", v)} /></td>
                <td className="px-3 py-2 text-center"><Switch checked={s.UserDefault} onCheckedChange={(v) => toggle(s, "UserDefault", v)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-4">
      {globalSettings}
      <SignalDefaultsSection />
    </div>
  )
}
