"use client"

import { useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { t } from "@/i18n/t"
import { CONTROL_SHAPE } from "@/components/ui/control"
import { customRange, PERIOD_PRESETS } from "./period"
import type { PlatformPeriod } from "./usePlatformPeriod"

/** Period presets (7 / 30 / 90 days / all time), a custom date range and «Порівняти з попереднім». */
export function PeriodFilter({ period }: { period: Pick<PlatformPeriod, "preset" | "custom" | "compare" | "setPreset" | "setCustom" | "setCompare"> }) {
  const [from, setFrom] = useState(period.custom?.from ?? "")
  const [to, setTo] = useState(period.custom?.to ?? "")
  const [open, setOpen] = useState(false)
  const valid = customRange(from, to) !== null
  const custom = period.preset === "custom"
  const segment = (active: boolean) => `min-h-10 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
    <div role="group" aria-label={t("admin.platformAnalytics.period.label")} className={`inline-flex overflow-hidden ${CONTROL_SHAPE}`}>
      {PERIOD_PRESETS.map((value) => <button key={value} type="button" aria-pressed={value === period.preset} onClick={() => period.setPreset(value)} className={segment(value === period.preset)}>{t(`admin.platformAnalytics.period.${value}`)}</button>)}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild><button type="button" aria-pressed={custom} className={segment(custom)}>{custom && period.custom ? `${period.custom.from} – ${period.custom.to}` : t("admin.platformAnalytics.period.custom")}</button></Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={6} collisionPadding={12} className="z-50 flex w-64 max-w-full flex-col gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground outline-none">
            <label className="flex flex-col gap-1 text-sm">{t("admin.table.dateFrom")}<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="flex flex-col gap-1 text-sm">{t("admin.table.dateTo")}<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
            {from && to && !valid && <p role="alert" className="text-xs text-destructive">{t("admin.platformAnalytics.period.rangeError")}</p>}
            <Button type="button" disabled={!valid} onClick={() => { period.setCustom(from, to); setOpen(false) }}>{t("admin.table.apply")}</Button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
    <Checkbox checked={period.compare} onChange={(event) => period.setCompare(event.target.checked)} label={t("admin.platformAnalytics.period.compare")} />
  </div>
}
