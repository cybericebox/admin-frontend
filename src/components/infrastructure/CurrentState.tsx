"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TableState, TableWrap, Th, TimeText } from "@/components/common/DsTable"
import { Switch } from "@/components/ui/switch"
import { FieldHelp } from "@/components/ui/field-help"
import type { CurrentLab } from "@/api/infrastructure"
import { MonitoringFacts } from "@/components/infrastructure/MonitoringFacts"
import { formatListDateTime } from "@/lib/locale"
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
      <CardTitle className="flex items-center gap-1.5 text-base">{t("admin.labs.obs.title")}<FieldHelp text={t("admin.labs.obs.titleHelp")} /></CardTitle>
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={includeRecent} onCheckedChange={onIncludeRecent} aria-label={t("admin.labs.obs.includeRecent")} />
        <span>{t("admin.labs.obs.includeRecent")}</span>
        <FieldHelp text={t("admin.labs.obs.includeRecentHelp")} />
      </span>
    </CardHeader>
    <CardContent>
      <TableWrap label={t("admin.labs.obs.title")} rows={4}>
        <table aria-label={t("admin.labs.obs.title")} className="ib-table">
          <thead><tr><Th>{t("admin.labs.obs.event")}</Th><Th>{t("admin.labs.obs.team")}</Th><Th>{t("admin.labs.obs.observed")}</Th><Th>{t("admin.labs.obs.data")}</Th></tr></thead>
          {loadError ? <TableState colSpan={4} kind="error" message={loadError} error={errorCause} onRetry={onRetry} />
            : rows.length === 0 ? <TableState colSpan={4} kind="empty" message={t("admin.labs.obs.empty")} />
            : <tbody>
              {rows.map((row) => <tr key={`${row.EventID}:${row.EventTeamID}:${row.LabGroupName}`}>
                <td className="ib-table__name">{row.EventName}</td>
                <td>{row.TeamName || t("admin.labs.moderatorsTeam")}<span className="block text-xs text-muted-foreground">{row.LabGroupName}</span></td>
                <td className="ib-table__dim"><TimeText iso={row.UpdatedAt}>{formatListDateTime(row.UpdatedAt)}</TimeText></td>
                <td className="!whitespace-normal"><details><summary className="cursor-pointer text-primary">{t("admin.labs.obs.viewMetrics")}</summary><MonitoringFacts payload={row.Payload} /></details></td>
              </tr>)}
            </tbody>}
        </table>
      </TableWrap>
    </CardContent>
  </Card>
}
