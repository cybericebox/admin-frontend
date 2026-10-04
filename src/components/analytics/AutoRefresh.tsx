"use client"

import { useId } from "react"
import { RefreshIndicator } from "@/components/infrastructure/RefreshIndicator"
import { FieldHelp } from "@/components/ui/field-help"
import { Switch } from "@/components/ui/switch"
import { t } from "@/i18n/t"
import { POLL_INTERVAL_MS } from "@/lib/usePolling"

/** «Автооновлення» toggle plus the time since the last update (the crest shows while a refresh runs). */
export function AutoRefresh({ enabled, onChange, updatedAt, refreshing }: { enabled: boolean; onChange: (enabled: boolean) => void; updatedAt: number | null; refreshing: boolean }) {
  const id = useId()
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-foreground">
      <Switch id={id} checked={enabled} onCheckedChange={onChange} />
      {t("admin.platformAnalytics.autoRefresh.label")}
    </label>
    <FieldHelp text={t("admin.platformAnalytics.autoRefresh.help", { seconds: POLL_INTERVAL_MS / 1000 })} />
    {enabled && <RefreshIndicator updatedAt={updatedAt} refreshing={refreshing} />}
  </div>
}
