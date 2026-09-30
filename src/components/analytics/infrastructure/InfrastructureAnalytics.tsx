"use client"

import { KpiTile, SectionPage, useAnalyticsResource } from "@/components/analytics"
import { formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"
import { CapacityBlock } from "./CapacityBlock"
import { FailuresBlock } from "./FailuresBlock"
import { KindHoursBlock } from "./KindHoursBlock"
import { ResourcesBlock } from "./ResourcesBlock"
import { PeaksBlock } from "./PeaksBlock"
import { StandHoursBlock } from "./StandHoursBlock"
import type { InfrastructureData } from "./types"

const P = "admin.platformAnalytics.infrastructure."

function Body() {
  const { data, loading, error, reload } = useAnalyticsResource<InfrastructureData>("infrastructure")
  const res = { data, loading, error, reload }
  const failed = !loading && error !== undefined
  const tile = { loading, empty: failed || !data }
  // Older reports carry team stands only: every lab kind then reads as zero.
  const kindHours = (kind: string) => formatNumber(data?.StandHours.Kinds?.find((k) => k.Kind === kind)?.Hours ?? 0, { maximumFractionDigits: 1 })
  const moderatorsActive = data?.Moderators?.Active ?? 0
  const testActive = data?.TestLabs?.Active ?? 0
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiTile {...tile} label={t(P + "kpi.activeNow")} hint={t(P + "kpi.activeNowHint")} href="/labs" value={data && formatNumber(data.Stands.Active + testActive)}
        sub={data ? t(P + "kpi.activeNowSub", { events: formatNumber(data.Stands.Active - moderatorsActive), moderators: formatNumber(moderatorsActive), tests: formatNumber(testActive) }) : undefined} />
      <KpiTile {...tile} label={t(P + "kpi.failedNow")} hint={t(P + "kpi.failedNowHint")} href="/labs?status=failed" value={data && formatNumber(data.Stands.Failed)}
        sub={data ? t(P + "kpi.failedNowSub", { removed: formatNumber(data.Stands.Removed) }) : undefined} />
      <KpiTile {...tile} label={t(P + "kpi.standHours")} hint={t(P + "kpi.standHoursHint")} value={data && formatNumber(data.StandHours.AllHours ?? data.StandHours.TotalHours, { maximumFractionDigits: 1 })}
        sub={data ? t(P + "kpi.standHoursSub", { events: kindHours("event"), moderators: kindHours("moderators"), tests: kindHours("test") }) : undefined} />
      <KpiTile {...tile} label={t(P + "kpi.peak")} hint={t(P + "kpi.peakHint")} value={data && formatNumber(data.AllPeakMax ?? data.PeakMax)}
        sub={data ? t(P + `kpi.peakSub.${data.Bucket}`) : undefined} />
      <KpiTile {...tile} label={t(P + "kpi.failedLabs")} hint={t(P + "kpi.failedLabsHint")} value={data && formatNumber(data.FailedLabs)}
        sub={data ? t(P + "kpi.failedLabsSub", { count: formatNumber(data.FailedStands) }) : undefined} />
    </div>
    <PeaksBlock res={res} />
    <KindHoursBlock res={res} />
    <ResourcesBlock res={res} />
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
