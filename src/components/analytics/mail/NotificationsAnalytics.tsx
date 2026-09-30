"use client"

import { useMemo, useState } from "react"
import { KpiTile, SectionPage, useAnalyticsResource } from "@/components/analytics"
import { formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"
import { ChannelTableBlock } from "./ChannelTableBlock"
import { DailyBlock } from "./DailyBlock"
import { ErrorsBlock } from "./ErrorsBlock"
import { FunnelCards } from "./FunnelCards"
import { KeyTableBlock } from "./KeyTableBlock"
import { MailFiltersBar } from "./MailFiltersBar"
import { percent, transportLabel, typeLabel } from "./labels"
import type { MailData, MailFilters, MailOptions } from "./types"

const P = "admin.platformAnalytics.mail."
const NO_OPTIONS: MailOptions = { Transports: [], Types: [] }

function Body() {
  const [filters, setFilters] = useState<MailFilters>({ channel: "", transport: "", type: "", includeTests: false })
  // The query and the CSV exports carry the same filters.
  const params = useMemo(() => ({ channel: filters.channel, transport: filters.transport, type: filters.type, includeTests: filters.includeTests ? "true" : undefined }), [filters])
  const { data, loading, error, reload } = useAnalyticsResource<MailData>("mail", params)
  const res = { data, loading, error, reload }

  // The option lists come with the report; keep the last ones while a refetch is loading, so the selects do not blink.
  const [options, setOptions] = useState<MailOptions>(NO_OPTIONS)
  if (data && data.Options !== options) setOptions(data.Options)

  const failed = !loading && error !== undefined
  const tile = { loading, empty: failed || !data }
  return <div className="space-y-6">
    <MailFiltersBar filters={filters} options={options} onChange={setFilters} onReload={reload} busy={loading} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile {...tile} label={t(P + "kpi.total")} hint={t(P + "kpi.totalHint")} value={data && formatNumber(data.Total)}
        sub={data ? t(P + "kpi.totalSub", { sent: formatNumber(data.Sent) }) : undefined} />
      <KpiTile {...tile} label={t(P + "kpi.failed")} hint={t(P + "kpi.failedHint")} href="/notifications/logs" value={data && formatNumber(data.Failed)} />
      <KpiTile {...tile} label={t(P + "kpi.rate")} hint={t(P + "kpi.rateHint")} value={data && percent(data.FailureRate, formatNumber)} />
      <KpiTile {...tile} label={t(P + "kpi.fallbacks")} hint={t(P + "kpi.fallbacksHint")} value={data && formatNumber(data.Fallbacks)} />
    </div>
    <FunnelCards funnels={data?.Funnels} loading={loading} failed={failed} />
    <DailyBlock res={res} params={params} />
    <div className="grid gap-6 lg:grid-cols-2">
      <ChannelTableBlock res={res} params={params} />
      <KeyTableBlock res={res} params={params} title={t(P + "byType.title")} hint={t(P + "byType.hint")} table="by_type" keyHeader={t(P + "col.type")} label={typeLabel} rows={data?.ByType} />
    </div>
    {/* Transport and SMTP failure reasons exist for email only. */}
    {filters.channel !== "in_app" && <>
      <KeyTableBlock res={res} params={params} title={t(P + "byTransport.title")} hint={t(P + "byTransport.hint")} table="by_transport" keyHeader={t(P + "col.transport")} label={transportLabel} rows={data?.ByTransport} />
      <ErrorsBlock res={res} params={params} />
    </>}
  </div>
}

/** Platform analytics, «Сповіщення»: delivery health of the email and in-app channels. No auto refresh, only a manual reload. */
export function NotificationsAnalytics() {
  return <SectionPage title={t("admin.platformAnalytics.mail.title")} subtitle={t("admin.platformAnalytics.mail.subtitle")}>
    <Body />
  </SectionPage>
}
