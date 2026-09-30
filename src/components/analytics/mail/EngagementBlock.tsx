"use client"

import { AnalyticsBlock, AnalyticsChart, lineOption } from "@/components/analytics"
import { t } from "@/i18n/t"
import type { AnalyticsParams } from "@/api/platformAnalytics"
import type { MailResource } from "./types"

const P = "admin.platformAnalytics.mail."

/** Per-day opens and clicks of the emails sent with tracking. Opens are approximate. */
export function EngagementBlock({ res }: { res: MailResource; params: AnalyticsParams }) {
  const days = res.data?.Daily ?? []
  const empty = !res.data || !res.data.Tracked
  return <AnalyticsBlock title={t(P + "engagement.title")} hint={t(P + "engagement.hint")}>
    <AnalyticsChart height={300} ariaLabel={t(P + "engagement.aria")} loading={res.loading} error={res.error} empty={empty}
      emptyMessage={t(P + "engagement.empty")} errorMessage={t(P + "engagement.error")} onRetry={res.reload}
      option={(theme) => lineOption([
        { name: t(P + "engagement.opened"), area: true, data: days.map((d) => [d.Day, d.Opened ?? 0]) },
        { name: t(P + "engagement.clicked"), data: days.map((d) => [d.Day, d.Clicked ?? 0]) },
      ], { theme, minInterval: 1 })} />
  </AnalyticsBlock>
}
