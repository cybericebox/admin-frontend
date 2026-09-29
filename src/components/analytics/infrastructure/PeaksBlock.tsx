"use client"

import { AnalyticsBlock, AnalyticsChart, CsvExportButton, lineOption } from "@/components/analytics"
import { t } from "@/i18n/t"
import type { InfrastructureResource } from "./types"

const P = "admin.platformAnalytics.infrastructure."

export function PeaksBlock({ res }: { res: InfrastructureResource }) {
  const peaks = res.data?.Peaks
  const empty = !res.data || res.data.PeakMax === 0
  return <AnalyticsBlock title={t(P + "peaks.title")} hint={t(P + "peaks.hint")}
    actions={<CsvExportButton section="infrastructure" table="peaks" disabled={empty} />}>
    <AnalyticsChart height={300} ariaLabel={t(P + "peaks.aria")} loading={res.loading} error={res.error} empty={empty}
      emptyMessage={t(P + "peaks.empty")} errorMessage={t(P + "peaks.error")} onRetry={res.reload}
      option={(theme) => lineOption([{ name: t(P + "peaks.series"), area: true, data: (peaks ?? []).map((p) => [p.At, p.Peak]) }], { theme, minInterval: 1, legend: false })} />
  </AnalyticsBlock>
}
