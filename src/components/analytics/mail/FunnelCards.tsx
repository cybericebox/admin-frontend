"use client"

import type { ReactNode } from "react"
import { FieldHelp } from "@/components/ui/field-help"
import { Spinner } from "@/components/ui/spinner"
import { formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"
import { formatFunnelDuration, formatFunnelRate } from "./funnel"
import type { MailFunnels } from "./types"

const F = "admin.platformAnalytics.mail.funnel."

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums text-foreground">{value}</p></div>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">{label}</span><span className="tabular-nums text-foreground">{value}</span></div>
}

function Card({ name, first, second, rows, loading, empty }: {
  name: "invitations" | "registration" | "applications"
  first?: number
  second?: number
  rows: { label: string; value: string }[]
  loading: boolean
  empty: boolean
}) {
  const dash = t(F + "noValue")
  const count = (value: number | undefined) => (empty || value === undefined ? dash : formatNumber(value))
  return <section data-testid={`funnel-${name}`} className="flex min-h-[10rem] min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
    <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">{t(`${F}${name}.title`)}<FieldHelp text={t(`${F}${name}.hint`)} /></h3>
    {loading
      ? <div className="flex flex-1 items-center justify-center"><Spinner size="md" label={t("admin.loading")} /></div>
      : <>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t(`${F}${name}.first`)} value={count(first)} />
          <Stat label={t(`${F}${name}.second`)} value={count(second)} />
        </div>
        <div className="mt-auto space-y-1">{rows.map((row) => <Row key={row.label} label={row.label} value={empty ? dash : row.value} />)}</div>
      </>}
  </section>
}

/** Conversion funnels of the platform: invitations, registration and applications. Transport / type filters do not apply. */
export function FunnelCards({ funnels, loading, failed }: { funnels: MailFunnels | undefined; loading: boolean; failed: boolean }) {
  const empty = failed || !funnels
  const inv = funnels?.Invitations
  const reg = funnels?.Registration
  const app = funnels?.Applications
  return <div className="grid gap-4 md:grid-cols-3" data-testid="mail-funnels">
    <Card name="invitations" loading={loading} empty={empty} first={inv?.Sent} second={inv?.Accepted}
      rows={[{ label: t(F + "conversion"), value: formatFunnelRate(inv?.AcceptRate) }, { label: t(F + "median"), value: formatFunnelDuration(inv?.MedianAcceptSeconds) }]} />
    <Card name="registration" loading={loading} empty={empty} first={reg?.Started} second={reg?.Completed}
      rows={[{ label: t(F + "conversion"), value: formatFunnelRate(reg?.CompletionRate) }]} />
    <Card name="applications" loading={loading} empty={empty} first={app?.Submitted} second={app?.Decided}
      rows={[
        { label: t(F + "conversion"), value: formatFunnelRate(app?.DecidedRate) },
        { label: t(F + "approved"), value: formatFunnelRate(app?.ApprovedRate) },
        { label: t(F + "rejected"), value: formatFunnelRate(app?.RejectedRate) },
        { label: t(F + "median"), value: formatFunnelDuration(app?.MedianDecisionSeconds) },
      ]} />
  </div>
}
