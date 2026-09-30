"use client"

import { ExternalLink } from "lucide-react"
import { AnalyticsBlock } from "@/components/analytics/AnalyticsBlock"
import { KpiTile } from "@/components/analytics/KpiTile"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { t } from "@/i18n/t"
import { useEventSiteAddress } from "@/lib/eventSite"
import { getEventAnalyticsOverview, isForbidden } from "@/api/events/analytics"
import { formatCount, percent } from "./eventAnalyticsFormat"
import { EventIntegrityTable } from "./EventIntegrityTable"
import { EventUsageTable } from "./EventUsageTable"
import { useEventReport } from "./useEventReport"

const P = "admin.events.analytics"

function OpenSiteButton({ tag }: { tag: string }) {
  const { address } = useEventSiteAddress(tag, "/manage/analytics")
  if (!address) return null
  return <Button asChild variant="outline" size="sm"><a href={address} target="_blank" rel="noopener noreferrer">{t(`${P}.openSite`)}<ExternalLink aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" /></a></Button>
}

function Kpis({ eventID, tag }: { eventID: string; tag: string }) {
  const report = useEventReport(() => getEventAnalyticsOverview(eventID), eventID)
  const data = report.data
  const s = (key: string) => t(`${P}.stat.${key}`)
  const standTotal = data ? data.Stands.Creating + data.Stands.Ready + data.Stands.Failed : 0
  let body
  if (report.failed && !data) {
    body = <div className="rounded-lg border border-border" style={{ minHeight: 160 }}>
      {isForbidden(report.error) ? <EmptyState message={t(`${P}.noAccess`)} className="min-h-[inherit]" /> : <LoadError message={t(`${P}.loadFailed`)} error={report.error} onRetry={report.retry} className="min-h-[inherit]" />}
    </div>
  } else {
    const loading = report.loading
    body = <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile loading={loading} label={s("registered")} hint={s("registeredHint")} value={data && formatCount(data.Participants.Registered)} sub={data ? t(`${P}.stat.registeredNote`, { approved: data.Participants.Approved }) : undefined} />
      <KpiTile loading={loading} label={s("active")} hint={s("activeHint")} value={data && formatCount(data.Participants.Active)} />
      <KpiTile loading={loading} label={s("teamsAdmitted")} hint={s("teamsAdmittedHint")} value={data && formatCount(data.Teams.Admitted)} sub={data ? t(`${P}.stat.teamsIncomplete`, { count: data.Teams.Incomplete }) : undefined} />
      <KpiTile loading={loading} label={s("attempts")} hint={s("attemptsHint")} value={data && formatCount(data.Attempts)} sub={data ? t(`${P}.stat.attemptsNote`, { correct: data.Correct, share: percent(data.Correct, data.Attempts) }) : undefined} />
      <KpiTile loading={loading} label={s("solves")} hint={s("solvesHint")} value={data && formatCount(data.Solves)} />
      <KpiTile loading={loading} label={s("hints")} hint={s("hintsHint")} value={data && formatCount(data.HintsOpened)} sub={data ? t(`${P}.stat.hintsNote`, { points: formatCount(data.HintPoints) }) : undefined} />
      {(loading || standTotal > 0) && <KpiTile loading={loading} label={s("stands")} hint={s("standsHint")} value={data && formatCount(data.Stands.Ready)} sub={data ? t(`${P}.stat.standsNote`, { failed: data.Stands.Failed, creating: data.Stands.Creating }) : undefined} />}
    </div>
  }
  return <AnalyticsBlock title={t(`${P}.kpi.title`)} subtitle={t(`${P}.kpi.subtitle`)} actions={<OpenSiteButton tag={tag} />}>{body}</AnalyticsBlock>
}

/** The «Аналітика» tab of an event: key figures, VPN and web proxy usage per participant, the integrity evidence table and a way to the event site. Read-only. */
export function EventAnalyticsTab({ eventID, tag, canOpenJournal }: { eventID: string; tag: string; canOpenJournal: boolean }) {
  return <div className="space-y-5">
    <Kpis eventID={eventID} tag={tag} />
    <EventUsageTable eventID={eventID} />
    <EventIntegrityTable eventID={eventID} tag={tag} canOpenJournal={canOpenJournal} />
  </div>
}
