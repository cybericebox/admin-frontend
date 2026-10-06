"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { t } from "@/i18n/t"
import { NotificationIcon } from "@/components/notifications/NotificationIcon"
import { ColorPicker } from "./ColorPicker"
import { FieldHelp } from "@/components/ui/field-help"
import { APPEARANCES, ICONS, toneColor } from "./inAppOptions"
import { HoverTooltip } from "@/components/ui/hover-tooltip"

type Props = {
  icon: string
  tone: string
  accentColor: string
  onChange: (next: { icon: string; tone: string; accentColor: string }) => void
  disabled?: boolean
}

export function NotificationAppearancePicker({ icon, tone, accentColor, onChange, disabled = false }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(Boolean(accentColor))

  return <section className="rounded-lg border border-border bg-card p-4" aria-label={t("admin.notif.inapp.appearance")}>
    <div className="mb-3 flex items-center gap-1.5">
      <h2 className="text-sm font-semibold text-foreground">{t("admin.notif.inapp.appearance")}</h2>
      <FieldHelp text={t("admin.notif.inapp.appearanceHelp")} />
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" role="radiogroup" aria-label={t("admin.notif.inapp.appearance")}>
      {APPEARANCES.map((option) => <button key={option.tone} type="button" role="radio" aria-checked={tone === option.tone} disabled={disabled}
        onClick={() => onChange({ icon: option.icon, tone: option.tone, accentColor: "" })}
        className={`flex min-w-0 flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${tone === option.tone ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>
        <NotificationIcon icon={option.icon} tone={option.tone} accentColor="" size="sm" />
        <span>{t(option.labelKey)}</span>
      </button>)}
    </div>
    <button type="button" onClick={() => setDetailsOpen((value) => !value)} disabled={disabled} aria-expanded={detailsOpen}
      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">
      {t("admin.notif.inapp.appearanceMore")} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
    </button>
    {detailsOpen && <div className="mt-3 space-y-4 border-t border-border pt-4">
      <div>
        <p className="mb-2 text-xs font-medium text-foreground">{t("admin.notif.inapp.icon")}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("admin.notif.inapp.icon")}>
          {ICONS.map((option) => <HoverTooltip key={option.value} text={t(option.labelKey)}><button type="button" role="radio" aria-checked={icon === option.value}
            onClick={() => onChange({ icon: option.value, tone, accentColor })} disabled={disabled} aria-label={t(option.labelKey)}
            className={`rounded-md border p-1.5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60 ${icon === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
            <NotificationIcon icon={option.value} tone={tone} accentColor={accentColor} size="sm" />
          </button></HoverTooltip>)}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-3">
          <ColorPicker label={t("admin.notif.inapp.accentColor")} help={t("admin.notif.inapp.accentHelp")} value={accentColor || toneColor(tone)} onChange={(value) => onChange({ icon, tone, accentColor: value })} />
          {accentColor && <button type="button" onClick={() => onChange({ icon, tone, accentColor: "" })} className="text-xs font-medium text-primary hover:underline">{t("admin.notif.inapp.accentClear")}</button>}
        </div>
      </div>
    </div>}
  </section>
}
