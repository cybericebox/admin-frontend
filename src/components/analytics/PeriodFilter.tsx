"use client"

import { t } from "@/i18n/t"
import { PERIOD_PRESETS, type PeriodPreset } from "./period"

/** Segmented period presets: 7 / 30 / 90 days / all time. */
export function PeriodFilter({ preset, onChange }: { preset: PeriodPreset; onChange: (preset: PeriodPreset) => void }) {
  return <div role="group" aria-label={t("admin.platformAnalytics.period.label")} className="inline-flex overflow-hidden rounded-md border border-border bg-card">
    {PERIOD_PRESETS.map((value) => {
      const active = value === preset
      return <button key={value} type="button" aria-pressed={active} onClick={() => onChange(value)}
        className={`min-h-9 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
        {t(`admin.platformAnalytics.period.${value}`)}
      </button>
    })}
  </div>
}
