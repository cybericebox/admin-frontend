"use client"

/**
 * SignalDefaultsSection.tsx — platform default subscription for Event-scoped
 * signals (Task 13). One row per Event-scoped signal type, with an Email and
 * an In-app switch. Every Event inherits these defaults until it overrides a
 * (signal, channel) pair. Defaults are seeded disabled — this is how the
 * platform turns them on. Audience is shown read-only (not editable here).
 *
 * Rendered inside GlobalSettingsTab, below the global settings table.
 */

import { useEffect, useState } from "react"
import { t } from "@/i18n/t"
import { Switch } from "@/components/ui/switch"
import { notifTypeLabel, notifChannelLabel, notifAudienceLabel } from "@/utils/notifType"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { toast } from "@/components/ui/toast"
import { useRole } from "@/lib/useRole"
import { listSignalDefaults, updateSignalDefault, type SignalDefault } from "@/api/notifications/signalDefaults"

type Row = {
  signalType: string
  email?: SignalDefault
  inApp?: SignalDefault
}

// Groups the flat (SignalType, Channel) list into one row per SignalType,
// preserving the order types first appear in, regardless of how the API
// interleaves email/in_app entries.
function groupBySignalType(items: SignalDefault[]): Row[] {
  const order: string[] = []
  const bySignal = new Map<string, Row>()
  for (const item of items) {
    let row = bySignal.get(item.SignalType)
    if (!row) {
      row = { signalType: item.SignalType }
      bySignal.set(item.SignalType, row)
      order.push(item.SignalType)
    }
    if (item.Channel === "email") row.email = item
    else if (item.Channel === "in_app") row.inApp = item
  }
  return order.map((signalType) => bySignal.get(signalType) as Row)
}

const rowKey = (d: SignalDefault) => `${d.SignalType}::${d.Channel}`

export function SignalDefaultsSection() {
  const canWrite = useRole().can("notifications.settings.write")
  const [items, setItems] = useState<SignalDefault[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    listSignalDefaults()
      .then((d) => { if (!cancelled) setItems(d ?? []) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function toggle(current: SignalDefault, enabled: boolean) {
    const next = { ...current, Enabled: enabled }
    setItems((prev) => prev.map((i) => (rowKey(i) === rowKey(current) ? next : i))) // optimistic
    try {
      const saved = await updateSignalDefault(next)
      setItems((prev) => prev.map((i) => (rowKey(i) === rowKey(saved) ? saved : i)))
      toast.success(t("admin.notif.signalDefaults.saved"))
    } catch {
      toast.error(t("admin.notif.settings.saveError"))
      setItems((prev) => prev.map((i) => (rowKey(i) === rowKey(current) ? current : i))) // revert
    }
  }

  if (error) return <p className="py-8 text-center text-sm text-destructive">{t("admin.notif.loadError")}</p>
  if (loading) return <LoadingArea label={t("admin.loading")} />

  const rows = groupBySignalType(items)
  if (rows.length === 0) return <EmptyState message={t("admin.notif.settings.empty")} />

  return (
    <div className="space-y-3 pt-6">
      <h3 className="text-sm font-semibold text-foreground">{t("admin.notif.signalDefaults.title")}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("admin.notif.settings.type")}</th>
              <th className="px-3 py-2 font-medium text-center">{t("admin.notif.channel.email")}</th>
              <th className="px-3 py-2 font-medium text-center">{t("admin.notif.channel.in_app")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.notif.signalDefaults.colAudience")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const label = notifTypeLabel(row.signalType)
              const emailItem = row.email
              const inAppItem = row.inApp
              const audienceKind = emailItem?.Audience?.kind ?? inAppItem?.Audience?.kind
              return (
                <tr key={row.signalType} className="border-b border-border/50">
                  <td className="px-3 py-2 font-medium text-foreground">{label}</td>
                  <td className="px-3 py-2 text-center">
                    {emailItem && (
                      <Switch
                        checked={emailItem.Enabled}
                        disabled={!canWrite}
                        aria-label={`${label} — ${notifChannelLabel("email")}`}
                        onCheckedChange={(v) => void toggle(emailItem, v)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {inAppItem && (
                      <Switch
                        checked={inAppItem.Enabled}
                        disabled={!canWrite}
                        aria-label={`${label} — ${notifChannelLabel("in_app")}`}
                        onCheckedChange={(v) => void toggle(inAppItem, v)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {audienceKind ? notifAudienceLabel(audienceKind) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
