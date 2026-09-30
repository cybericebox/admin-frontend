"use client"

import { AnalyticsBlock, AnalyticsChart, CsvExportButton, lineOption } from "@/components/analytics"
import { t } from "@/i18n/t"
import type { InfrastructureResource, PeakPoint } from "./types"

const P = "admin.platformAnalytics.infrastructure."

export function PeaksBlock({ res }: { res: InfrastructureResource }) {
  const data = res.data
  const testPeaks = data?.TestLabPeaks ?? []
  const withTests = testPeaks.some((p) => p.Peak > 0)
  const empty = !data || (data.AllPeakMax ?? data.PeakMax) === 0
  const series = (peaks: PeakPoint[], name: string, area = false) => ({ name, area, data: peaks.map((p): [string, number] => [p.At, p.Peak]) })
  // Without test labs the chart is the team stand line alone, as before.
  const lines = !data ? [] : withTests
    ? [series(data.AllPeaks ?? [], t(P + "peaks.seriesAll"), true), series(data.Peaks, t(P + "peaks.series")), series(testPeaks, t(P + "peaks.seriesTests"))]
    : [series(data.Peaks, t(P + "peaks.series"), true)]
  return <AnalyticsBlock title={t(P + "peaks.title")} hint={t(P + "peaks.hint")}
    actions={<CsvExportButton section="infrastructure" table="peaks" disabled={empty} />}>
    <AnalyticsChart height={300} ariaLabel={t(P + "peaks.aria")} loading={res.loading} error={res.error} empty={empty}
      emptyMessage={t(P + "peaks.empty")} errorMessage={t(P + "peaks.error")} onRetry={res.reload}
      option={(theme) => lineOption(lines, { theme, minInterval: 1, legend: withTests })} />
  </AnalyticsBlock>
}
