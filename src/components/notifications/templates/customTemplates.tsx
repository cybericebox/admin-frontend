"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { listBroadcastTemplates, type BroadcastTemplate } from "@/api/notifications/broadcastTemplates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import { formatDateTime } from "@/lib/locale"
import { broadcastChannelLabel } from "@/components/notifications/broadcast/broadcastLabels"

export type TemplateChannel = "email" | "in_app"
export type TemplateKindFilter = "all" | "triggered" | "custom"

// The address of a custom template's editor (static export: the id and the page's channel are query parameters).
export function customTemplateHref(channel: TemplateChannel, id?: string): string {
  const query = new URLSearchParams({ channel })
  if (id) query.set("id", id)
  return `/notifications/templates/custom?${query.toString()}`
}

// The custom templates (saved broadcast messages, not bound to any platform action) that send on `channel`, for a
// templates page. Loaded only for whoever may manage them (notifications.broadcast).
export function useCustomTemplates(channel: TemplateChannel, enabled: boolean) {
  const [rows, setRows] = useState<BroadcastTemplate[] | null>(null)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    listBroadcastTemplates().then(
      (list) => { if (!cancelled) { setRows(list); setError(null) } },
      (cause) => { if (!cancelled) setError({ cause }) },
    )
    return () => { cancelled = true }
  }, [enabled, attempt])
  return {
    rows: enabled ? (rows ?? []).filter((row) => (row.Channels ?? []).includes(channel)) : [],
    loading: enabled && rows === null && !error,
    error: enabled ? error : null,
    retry: () => { setError(null); setAttempt((n) => n + 1) },
  }
}

export function TemplateKindSelect({ value, onChange }: { value: TemplateKindFilter; onChange: (value: TemplateKindFilter) => void }) {
  const options = (["all", "triggered", "custom"] as const).map((kind) => ({ value: kind, label: t(`admin.notif.customTpl.filter.${kind}`) }))
  return <SelectMenu value={value} onChange={(next) => onChange(next as TemplateKindFilter)} options={options} ariaLabel={t("admin.notif.customTpl.filter.label")} className="w-48" />
}

// «Створити шаблон» of a templates page: a new custom template on the page's channel.
export function CreateCustomTemplateButton({ channel }: { channel: TemplateChannel }) {
  return <Button asChild><Link href={customTemplateHref(channel)}><Plus aria-hidden className="h-4 w-4" />{t("admin.notif.customTpl.create")}</Link></Button>
}

export function TriggeredKindCell() {
  return <td className="px-4 py-3"><Badge size="sm">{t("admin.notif.customTpl.kind.triggered")}</Badge></td>
}

// One custom template row in the columns of the templates table: template, type, status, updated, updated by.
export function CustomTemplateRow({ template, channel }: { template: BroadcastTemplate; channel: TemplateChannel }) {
  const channels = (template.Channels ?? []).map(broadcastChannelLabel).join(", ")
  return (
    <tr className="hover:bg-[var(--ib-hover)] transition-colors">
      <td className="px-4 py-3">
        <Link href={customTemplateHref(channel, template.ID)} className="font-medium text-foreground hover:text-primary hover:underline">{template.Name}</Link>
        <div className="text-xs text-muted-foreground">{t("admin.notif.customTpl.channels", { channels })}</div>
      </td>
      <td className="px-4 py-3"><Badge tone="ok" size="sm">{t("admin.notif.customTpl.kind.custom")}</Badge></td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{t("admin.notif.customTpl.manualOnly")}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(template.UpdatedAt, { dateStyle: "short", timeStyle: "short" })}</td>
      <td className="px-4 py-3">{template.UpdatedByName || <span className="text-muted-foreground">—</span>}</td>
    </tr>
  )
}
