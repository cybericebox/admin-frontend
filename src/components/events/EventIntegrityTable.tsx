"use client"

import { AnalyticsBlock } from "@/components/analytics/AnalyticsBlock"
import { DataTable, type Column } from "@/components/analytics/DataTable"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { cn } from "@/utils/cn"
import { t } from "@/i18n/t"
import { useEventSiteAddress } from "@/lib/eventSite"
import {
  defaultIntegrityFilters, getEventAnalyticsAccess, getEventIntegrity, integrityJournalPath, integrityKinds, isForbidden,
  type IntegrityFilters, type IntegrityItem, type IntegrityKind, type IntegrityReviewedFilter, type IntegritySignal,
} from "@/api/events/analytics"
import { formatClock, formatCount, formatDateTime, kindLabel, kindReason, levelLabel, signalEvidence } from "./eventAnalyticsFormat"
import { REPORT_POLL_MS, useEventReport } from "./useEventReport"
import { useState } from "react"

const P = "admin.events.analytics.integrity"
const reviewedOptions: IntegrityReviewedFilter[] = ["no", "yes", "all"]
const BLOCK_HEIGHT = 320

function SignalChip({ signal }: { signal: IntegritySignal }) {
  const tone = signal.Kind === "cross_flag" ? "bg-destructive/10 text-destructive" : signal.Info ? "bg-secondary text-muted-foreground" : "bg-[var(--ib-warn-bg,hsl(var(--secondary)))] text-foreground"
  const label = signal.Info ? t(`${P}.infoKind`, { kind: kindLabel(signal.Kind) }) : kindLabel(signal.Kind)
  return <span title={kindReason(signal.Kind)} className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tone)}>{label}</span>
}

function SignalEvidence({ signal, item }: { signal: IntegritySignal; item: IntegrityItem }) {
  return <li className="space-y-1" data-signal={signal.Kind}>
    <div className="flex flex-wrap items-start gap-2"><SignalChip signal={signal} /><span className="min-w-0 text-sm text-foreground">{signalEvidence(signal, item.Level)}</span></div>
    {signal.Teams.length > 0 && signal.Kind !== "follows_solve" && signal.Kind !== "shared_wrong" && <p className="text-xs text-muted-foreground">{t(`${P}.teamsInvolved`, { teams: signal.Teams.map((team) => team.Name).join(", ") })}</p>}
    {signal.Answers.length > 0 && <ul className="space-y-1.5 pl-3">{signal.Answers.map((answer) => <li key={answer.Value} className="text-xs">
      <code className="break-all rounded bg-secondary px-1.5 py-0.5 font-mono text-foreground">{answer.Value}</code>
      <ol className="mt-1 space-y-0.5 text-muted-foreground">{answer.Order.map((entry, position) => <li key={`${entry.TeamID}-${entry.At}`}>{t(`${P}.answerOrder`, { n: position + 1, team: entry.TeamName, time: formatClock(entry.At) })}</li>)}</ol>
    </li>)}</ul>}
  </li>
}

// The attempts journal lives on the event site; only an assigned write moderator may open it.
function JournalLink({ tag, item }: { tag: string; item: IntegrityItem }) {
  const { address } = useEventSiteAddress(tag, integrityJournalPath(item))
  if (!address) return null
  return <Button asChild variant="outline" size="sm"><a href={address} target="_blank" rel="noopener noreferrer">{t(`${P}.openJournal`)}</a></Button>
}

function NoAccess({ message }: { message: string }) {
  return <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card" style={{ minHeight: BLOCK_HEIGHT }}><div className="flex flex-1"><EmptyState className="flex-1" message={message} /></div></div>
}

/**
 * «Доброчесність» of one event, read-only: every flagged solve with all of its signals and
 * their evidence, so nobody needs the raw attempts. Hints for a person to review, never a
 * verdict. Only the platform `admin` role sees it; `admin_viewer` gets a 403 and the
 * no-access state.
 */
export function EventIntegrityTable({ eventID, tag, canOpenJournal }: { eventID: string; tag: string; canOpenJournal: boolean }) {
  const [filters, setFilters] = useState<IntegrityFilters>(defaultIntegrityFilters)
  const access = useEventReport(() => getEventAnalyticsAccess(eventID), eventID, { pollMs: 0 })
  const allowed = access.data?.Sensitive === true
  const report = useEventReport(() => getEventIntegrity(eventID, filters), `${eventID}|${filters.signal}|${filters.reviewed}`, { enabled: allowed, pollMs: REPORT_POLL_MS })
  const data = report.data
  const title = t(`${P}.title`)

  let body
  if (access.failed && !isForbidden(access.error)) body = <div className="rounded-lg border border-border bg-card" style={{ minHeight: BLOCK_HEIGHT }}><LoadError message={t(`${P}.loadFailed`)} error={access.error} onRetry={access.retry} className="min-h-[inherit]" /></div>
  else if (access.loading) body = <div className="rounded-lg border border-border bg-card" style={{ minHeight: BLOCK_HEIGHT }}><LoadingArea className="h-full min-h-[inherit]" label={t("admin.loading")} /></div>
  else if (access.failed || !allowed || (report.failed && isForbidden(report.error))) body = <NoAccess message={t(`${P}.noAccess`)} />
  else {
    const columns: Column<IntegrityItem>[] = [
      { key: "team", header: t(`${P}.col.team`), cell: (item) => <span className="font-medium text-foreground">{item.TeamName}</span> },
      { key: "task", header: t(`${P}.col.task`), cell: (item) => <span className="flex flex-wrap items-center gap-2"><span className="font-medium text-foreground">{item.ChallengeName}</span><span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{levelLabel(item.Level)}</span></span> },
      { key: "time", header: t(`${P}.col.time`), className: "whitespace-nowrap", cell: (item) => item.Solved ? formatDateTime(item.At) : <span className="text-muted-foreground">{t(`${P}.unsolved`)}</span> },
      { key: "signals", header: t(`${P}.col.signals`), className: "min-w-[22rem] max-w-xl", cell: (item) => <ul className="space-y-2">{item.Signals.map((signal, index) => <SignalEvidence key={`${signal.Kind}-${index}`} signal={signal} item={item} />)}</ul> },
      { key: "review", header: t(`${P}.col.review`), cell: (item) => item.Review
        ? <div className="space-y-0.5 text-xs"><p className="font-medium text-foreground">{t(`${P}.reviewed`)}</p><p className="text-muted-foreground">{t(`${P}.reviewedBy`, { name: item.Review.ReviewedBy || t(`${P}.reviewerUnknown`), date: formatDateTime(item.Review.ReviewedAt) })}</p>{item.Review.Note && <p className="text-foreground">{t(`${P}.reviewNote`, { note: item.Review.Note })}</p>}</div>
        : <span className="text-xs text-muted-foreground">{t(`${P}.notReviewed`)}</span> },
    ]
    if (canOpenJournal) columns.push({ key: "journal", header: t(`${P}.openJournal`), cell: (item) => <JournalLink tag={tag} item={item} /> })
    const narrowed = filters.signal !== null || filters.reviewed !== defaultIntegrityFilters.reviewed
    body = <>
      <p className="mb-3 text-sm text-muted-foreground">{t(`${P}.notice`)}</p>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label={t(`${P}.signalFilter`)}>
        {integrityKinds.map((kind: IntegrityKind) => <button key={kind} type="button" aria-pressed={filters.signal === kind} title={kindReason(kind)} data-kind={kind}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-accent aria-pressed:bg-secondary aria-pressed:font-medium"
          onClick={() => setFilters((current) => ({ ...current, signal: current.signal === kind ? null : kind }))}>
          {kindLabel(kind)} <span className="tabular-nums text-muted-foreground">{data ? formatCount(data.Counts[kind]) : "–"}</span>
        </button>)}
      </div>
      <div className="mb-3 inline-flex rounded-lg bg-muted p-1" role="group" aria-label={t(`${P}.reviewedFilter`)}>
        {reviewedOptions.map((value) => <button key={value} type="button" aria-pressed={filters.reviewed === value}
          className="rounded-md px-3 py-1 text-sm text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground"
          onClick={() => setFilters((current) => ({ ...current, reviewed: value }))}>{t(`${P}.reviewedOption.${value}`)}</button>)}
      </div>
      {data && data.Total > data.Items.length && <p role="status" className="mb-3 text-sm text-muted-foreground">{t(`${P}.truncated`, { shown: data.Items.length, total: data.Total })}</p>}
      <DataTable columns={columns} rows={data?.Items} rowKey={(item) => item.TeamChallengeID} loading={report.loading} error={report.failed ? report.error : undefined} onRetry={report.retry}
        errorMessage={t(`${P}.loadFailed`)} emptyMessage={t(narrowed ? `${P}.emptyFiltered` : `${P}.empty`)} minHeight={BLOCK_HEIGHT} ariaLabel={t(`${P}.tableLabel`)} />
    </>
  }
  return <AnalyticsBlock title={title}>{body}</AnalyticsBlock>
}
