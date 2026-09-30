"use client"
import { useEffect, useState } from "react"
import { t } from "@/i18n/t"
import { SelectMenu } from "@/components/ui/select-menu"
import { LoadError } from "@/components/ui/load-error"
import { Spinner } from "@/components/ui/spinner"
import { loadBroadcastTemplates, type BroadcastTemplate } from "./broadcastTemplates"

// «Почати з шаблону»: picking a published template hands it to the composer, which prefills itself from it.
export function TemplateStart({ onPick }: { onPick: (template: BroadcastTemplate) => void }) {
  const [templates, setTemplates] = useState<BroadcastTemplate[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadBroadcastTemplates().then(
      (list) => { if (!cancelled) { setTemplates(list); setError(null) } },
      (cause) => { if (!cancelled) setError({ cause }) },
    )
    return () => { cancelled = true }
  }, [attempt])

  if (error) return <LoadError compact message={t("admin.notif.broadcast.template.loadError")} onRetry={() => { setError(null); setAttempt((n) => n + 1) }} className="rounded-md border border-border" />
  if (!templates) return <div className="flex h-10 items-center justify-center"><Spinner size="sm" /></div>
  const options = templates.map((template) => ({
    value: template.type,
    label: template.label,
    description: [template.email && t("admin.notif.broadcast.channel.email"), template.inApp && t("admin.notif.broadcast.channel.in_app")].filter(Boolean).join(" · "),
  }))
  return (
    <div className="max-w-sm">
      <label className="mb-1 block text-sm font-medium text-foreground">{t("admin.notif.broadcast.template.start")}</label>
      <SelectMenu value="" onChange={(type) => { const found = templates.find((template) => template.type === type); if (found) onPick(found) }} options={options} disabled={options.length === 0} placeholder={t(options.length === 0 ? "admin.notif.broadcast.template.none" : "admin.notif.broadcast.template.placeholder")} ariaLabel={t("admin.notif.broadcast.template.start")} className="w-full" />
      <p className="mt-1 text-xs text-muted-foreground">{t("admin.notif.broadcast.template.help")}</p>
    </div>
  )
}
