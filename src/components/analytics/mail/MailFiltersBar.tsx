"use client"

import { useId } from "react"
import { Button } from "@/components/ui/button"
import { FieldHelp } from "@/components/ui/field-help"
import { SelectMenu } from "@/components/ui/select-menu"
import { Switch } from "@/components/ui/switch"
import { t } from "@/i18n/t"
import { notifChannelLabel } from "@/utils/notifType"
import { transportLabel, typeLabel } from "./labels"
import type { MailChannel, MailFilters, MailOptions } from "./types"

const CHANNELS: MailChannel[] = ["email", "in_app"]

const P = "admin.platformAnalytics.mail."

/** Channel, transport and type selects (the admin select menu), the test-sends switch and a manual reload. The transport belongs to email, so it is hidden for in-app. */
export function MailFiltersBar({ filters, options, onChange, onReload, busy }: { filters: MailFilters; options: MailOptions; onChange: (next: MailFilters) => void; onReload: () => void; busy: boolean }) {
  const testsId = useId()
  const all = { value: "", label: t(P + "filters.all") }
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t(P + "filters.channel")}</span>
      <SelectMenu value={filters.channel} ariaLabel={t(P + "filters.channel")} className="min-w-40"
        onChange={(channel) => onChange({ ...filters, channel: channel as MailFilters["channel"], transport: channel === "in_app" ? "" : filters.transport })}
        options={[all, ...CHANNELS.map((value) => ({ value, label: notifChannelLabel(value) }))]} />
    </div>
    {filters.channel !== "in_app" && <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t(P + "filters.transport")}</span>
      <SelectMenu value={filters.transport} onChange={(transport) => onChange({ ...filters, transport })} ariaLabel={t(P + "filters.transport")} className="min-w-44"
        options={[all, ...options.Transports.map((value) => ({ value, label: transportLabel(value) }))]} />
    </div>}
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t(P + "filters.type")}</span>
      <SelectMenu value={filters.type} onChange={(type) => onChange({ ...filters, type })} ariaLabel={t(P + "filters.type")} className="min-w-52"
        options={[all, ...options.Types.map((value) => ({ value, label: typeLabel(value) }))]} />
    </div>
    <div className="flex items-center gap-2">
      <label htmlFor={testsId} className="inline-flex items-center gap-2 text-sm text-foreground">
        <Switch id={testsId} checked={filters.includeTests} onCheckedChange={(includeTests) => onChange({ ...filters, includeTests })} />
        {t(P + "filters.includeTests")}
      </label>
      <FieldHelp text={t(P + "filters.includeTestsHint")} />
    </div>
    <Button type="button" variant="outline" size="sm" busy={busy} onClick={onReload}>{t(P + "reload")}</Button>
  </div>
}
