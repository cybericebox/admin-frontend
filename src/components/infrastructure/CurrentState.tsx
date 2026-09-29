"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { Switch } from "@/components/ui/switch"
import { FieldHelp } from "@/components/ui/field-help"
import type { CurrentLab } from "@/api/infrastructure"
import { MonitoringFacts } from "@/components/infrastructure/MonitoringFacts"
import { formatDateTime } from "@/lib/locale"
import { t } from "@/i18n/t"

// The full merged current state of every lab group of the shown events.
export function CurrentState({ rows, includeRecent, onIncludeRecent, loadError, errorCause, onRetry }: {
  rows: CurrentLab[]
  includeRecent: boolean
  onIncludeRecent: (value: boolean) => void
  loadError: string
  errorCause?: unknown
  onRetry: () => void
}) {
  return <Card>
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
      <CardTitle className="text-base">{t("admin.labs.obs.title")}</CardTitle>
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={includeRecent} onCheckedChange={onIncludeRecent} aria-label={t("admin.labs.obs.includeRecent")} />
        <span>{t("admin.labs.obs.includeRecent")}</span>
        <FieldHelp text={t("admin.labs.obs.includeRecentHelp")} />
      </span>
    </CardHeader>
    <CardContent>
      {loadError ? <LoadError message={loadError} error={errorCause} compact onRetry={onRetry} /> : rows.length === 0 ? <EmptyState message={t("admin.labs.obs.empty")} compact /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-2 pr-4 font-medium">{t("admin.labs.obs.event")}</th><th className="py-2 pr-4 font-medium">{t("admin.labs.obs.team")}</th><th className="py-2 pr-4 font-medium">{t("admin.labs.obs.observed")}</th><th className="py-2 font-medium">{t("admin.labs.obs.data")}</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => <tr key={`${row.EventID}:${row.EventTeamID}:${row.LabGroupName}`}>
                <td className="py-2 pr-4 font-medium">{row.EventName}</td>
                <td className="py-2 pr-4">{row.TeamName || t("admin.labs.moderatorsTeam")}<span className="block text-xs text-muted-foreground">{row.LabGroupName}</span></td>
                <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">{formatDateTime(row.UpdatedAt)}</td>
                <td className="py-2"><details><summary className="cursor-pointer text-primary">{t("admin.labs.obs.viewMetrics")}</summary><MonitoringFacts payload={row.Payload} /></details></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </CardContent>
  </Card>
}
