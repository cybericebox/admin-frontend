"use client"
import { useCallback, useEffect, useState } from "react"
import { getErrorGroup, setErrorGroupStatus, type ErrorGroupDetail, type ErrorSample } from "@/api/errorJournal"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { ApiError } from "@/api/client"
import { t } from "@/i18n/t"
import { errorOr } from "@/i18n/apiError"
import { formatDateTime, formatNumber } from "@/lib/locale"
import { createStatusQueue } from "@/lib/statusQueue"
import { useErrorStream } from "@/lib/errorStream"
import { useUserNames } from "@/lib/userNames"
import { useRole } from "@/lib/useRole"
import { KindBadge, StatusSwitch } from "./shared"

const MAX_SAMPLES = 50

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd></div>
}

function SampleCard({ sample, userName }: { sample: ErrorSample; userName?: { name: string; href: string } }) {
  const details = Object.entries(sample.Details ?? {})
  return (
    <article className="rounded-lg border border-border bg-card p-4" aria-label={t("admin.errors.sample.at", { time: formatDateTime(sample.OccurredAt) })}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{formatDateTime(sample.OccurredAt)}</h3>
        {sample.RequestID && <span className="font-mono text-xs text-muted-foreground">{t("admin.errors.sample.requestIDLine", { id: sample.RequestID })}</span>}
      </div>
      {/* Untrusted text: always rendered as text, never as markup. */}
      {sample.Message && <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-sm text-foreground">{sample.Message}</pre>}
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {sample.Method && <Field label={t("admin.errors.sample.method")}>{sample.Method}</Field>}
        {sample.Route && <Field label={t("admin.errors.sample.route")}><span className="font-mono">{sample.Route}</span></Field>}
        {sample.HTTPStatus != null && <Field label={t("admin.errors.sample.status")}>{sample.HTTPStatus}</Field>}
        {sample.UserID && <Field label={t("admin.errors.sample.user")}><a href={`/users/detail/?id=${encodeURIComponent(sample.UserID)}`} className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">{userName?.name ?? sample.UserID.slice(0, 8)}</a></Field>}
        {sample.Role && <Field label={t("admin.errors.sample.role")}>{sample.Role}</Field>}
        {sample.Permission && <Field label={t("admin.errors.sample.permission")}><span className="font-mono">{sample.Permission}</span></Field>}
        {sample.Limiter && <Field label={t("admin.errors.sample.limiter")}><span className="font-mono">{sample.Limiter}</span></Field>}
        {details.map(([name, value]) => <Field key={name} label={name}>{value}</Field>)}
      </dl>
      {sample.Stack && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary">{t("admin.errors.sample.stack")}</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">{sample.Stack}</pre>
        </details>
      )}
    </article>
  )
}

export function ErrorGroupDetailPage({ groupID }: { groupID: string }) {
  const { can } = useRole()
  const canWrite = can("platform.errors.write")
  const [detail, setDetail] = useState<ErrorGroupDetail | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    getErrorGroup(groupID)
      .then((value) => { if (active) { setDetail(value); setFailure(null) } })
      .catch((cause) => { if (active) setFailure(cause ?? new Error("failed")) })
    return () => { active = false }
  }, [groupID, reload])

  const resync = useCallback(() => setReload((value) => value + 1), [])
  useErrorStream({
    enabled: can("platform.errors.read"),
    onEvent: (event) => {
      if (event.Group.ID !== groupID) return
      setDetail((current) => {
        if (!current) return current
        const samples = event.Sample && !current.Samples.some((s) => s.ID === event.Sample!.ID) ? [event.Sample, ...current.Samples].slice(0, MAX_SAMPLES) : current.Samples
        return { Group: event.Group, Samples: samples }
      })
    },
    onResync: resync,
  })

  const [queue] = useState(() => createStatusQueue({
    patch: setErrorGroupStatus,
    optimistic: (_id, next) => setDetail((current) => current ? { ...current, Group: { ...current.Group, Status: next } } : current),
    confirmed: (group) => setDetail((current) => current && JSON.stringify(current.Group) !== JSON.stringify(group) ? { ...current, Group: group } : current),
    failed: (_id, back, error) => {
      setDetail((current) => current ? { ...current, Group: { ...current.Group, Status: back } } : current)
      toast.error(errorOr(error, t("admin.errors.statusError")))
    },
  }))

  const names = useUserNames((detail?.Samples ?? []).map((sample) => sample.UserID))
  const group = detail?.Group
  const missing = failure instanceof ApiError && failure.status === 404 && !detail

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title={group?.Title ?? t("admin.nav.errors")} crumbs={[{ label: t("admin.nav.errors"), href: "/errors" }, { label: group?.Title ?? t("admin.loading") }]} />
      {missing ? <EmptyState message={t("admin.errors.notFound")} className="flex-1" />
        : failure && !detail ? <LoadError message={t("admin.errors.detailLoadError")} error={failure} onRetry={resync} className="flex-1" />
        : !detail || !group ? <LoadingArea className="flex-1" label={t("admin.loading")} />
        : <>
          <header className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2"><KindBadge kind={group.Kind} />{group.Source && <span className="break-all font-mono text-xs text-muted-foreground">{group.Source}</span>}</div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Field label={t("admin.errors.col.occurrences")}>{formatNumber(group.Occurrences)}</Field>
              <Field label={t("admin.errors.col.firstSeen")}>{formatDateTime(group.FirstSeenAt)}</Field>
              <Field label={t("admin.errors.col.lastSeen")}>{formatDateTime(group.LastSeenAt)}</Field>
              <Field label={t("admin.errors.detail.notified")}>{group.LastNotifiedAt ? formatDateTime(group.LastNotifiedAt) : t("admin.errors.detail.neverNotified")}</Field>
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusSwitch status={group.Status} readOnly={!canWrite} label={t("admin.errors.statusFor", { title: group.Title })} onChange={(next) => queue.set(group.ID, group.Status, next)} />
              <span className="text-xs text-muted-foreground">{t(`admin.errors.statusHint.${group.Status}`)}</span>
            </div>
          </header>
          <section aria-label={t("admin.errors.detail.samples")} className="min-h-0 flex-1 space-y-3 overflow-auto">
            <h2 className="text-sm font-semibold text-foreground">{t("admin.errors.detail.samples")}</h2>
            {detail.Samples.length === 0 ? <EmptyState message={t("admin.errors.detail.noSamples")} /> : detail.Samples.map((sample) => <SampleCard key={sample.ID} sample={sample} userName={sample.UserID ? names[sample.UserID] : undefined} />)}
          </section>
        </>}
    </div>
  )
}
