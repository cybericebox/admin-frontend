"use client"

import { KpiTile, SectionPage, useAnalyticsResource } from "@/components/analytics"
import { formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"
import { CapacityBlock } from "./CapacityBlock"
import { FailuresBlock } from "./FailuresBlock"
import { PeaksBlock } from "./PeaksBlock"
import { StandHoursBlock } from "./StandHoursBlock"
import type { InfrastructureData } from "./types"

const P = "admin.platformAnalytics.infrastructure."

function Body() {
  const { data, loading, error, reload } = useAnalyticsResource<InfrastructureData>("infrastructure")
  const res = { data, loading, error, reload }
  const failed = !loading && error !== undefined
  const tile = { loading, empty: failed || !data }
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiTile {...tile} label={t(P + "kpi.activeNow")} hint={t(P + "kpi.activeNowHint")} href="/labs" value={data && formatNumber(data.Stands.Active)}
        sub={data ? t(P + "kpi.activeNowSub", { ready: formatNumber(data.Stands.Ready), creating: formatNumber(data.Stands.Creating) }) : undefined} />
      <KpiTile {...tile} label={t(P + "kpi.failedNow")} hint={t(P + "kpi.failedNowHint")} href="/labs?status=failed" value={data && formatNumber(data.Stands.Failed)}
        sub={data ? t(P + "kpi.failedNowSub", { removed: formatNumber(data.Stands.Removed) }) : undefined} />
      <KpiTile {...tile} label={t(P + "kpi.standHours")} hint={t(P + "kpi.standHoursHint")} value={data && formatNumber(data.StandHours.TotalHours, { maximumFractionDigits: 1 })}
        sub={data ? t(P + "kpi.standHoursSub", { count: formatNumber(data.StandHours.TotalEvents) }) : undefined} />
      <KpiTile {...tile} label={t(P + "kpi.peak")} hint={t(P + "kpi.peakHint")} value={data && formatNumber(data.PeakMax)}
        sub={data ? t(P + `kpi.peakSub.${data.Bucket}`) : undefined} />
      <KpiTile {...tile} label={t(P + "kpi.failedLabs")} hint={t(P + "kpi.failedLabsHint")} value={data && formatNumber(data.FailedLabs)}
        sub={data ? t(P + "kpi.failedLabsSub", { count: formatNumber(data.FailedStands) }) : undefined} />
    </div>
    <PeaksBlock res={res} />
    <StandHoursBlock res={res} />
    <FailuresBlock res={res} />
    <CapacityBlock res={res} />
  </div>
}

/** Platform analytics, «Інфраструктура»: stand-hours, peaks, failures and cluster capacity. Auto refresh is offered, off by default. */
export function InfrastructureAnalytics() {
  return <SectionPage title={t("admin.platformAnalytics.infrastructure.title")} subtitle={t("admin.platformAnalytics.infrastructure.subtitle")} autoRefresh="off">
    <Body />
  </SectionPage>
}
