"use client"

import { AnalyticsBlock, AnalyticsChart, CsvExportButton, lineOption } from "@/components/analytics"
import { t } from "@/i18n/t"
import type { AnalyticsParams } from "@/api/platformAnalytics"
import type { MailResource } from "./types"

const P = "admin.platformAnalytics.mail."

export function DailyBlock({ res, params }: { res: MailResource; params: AnalyticsParams }) {
  const days = res.data?.Daily ?? []
  const empty = !res.data || res.data.Total === 0
  return <AnalyticsBlock title={t(P + "daily.title")} hint={t(P + "daily.hint")}
    actions={<CsvExportButton section="mail" table="daily" params={params} disabled={empty} />}>
    <AnalyticsChart height={300} ariaLabel={t(P + "daily.aria")} loading={res.loading} error={res.error} empty={empty}
      emptyMessage={t(P + "daily.empty")} errorMessage={t(P + "daily.error")} onRetry={res.reload}
      option={(theme) => lineOption([
        { name: t(P + "daily.sent"), area: true, data: days.map((d) => [d.Day, d.Sent]) },
        { name: t(P + "daily.failed"), data: days.map((d) => [d.Day, d.Failed]) },
      ], { theme, minInterval: 1 })} />
  </AnalyticsBlock>
}
