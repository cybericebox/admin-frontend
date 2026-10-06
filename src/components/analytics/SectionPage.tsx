"use client"

import { Suspense, useCallback, useMemo, useState, type ReactNode } from "react"
import { ErrorPage } from "@/components/ErrorPage"
import { PageHeader } from "@/components/ui/page-header"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"
import { AutoRefresh } from "./AutoRefresh"
import { PeriodFilter } from "./PeriodFilter"
import { SectionContext, type SectionContextValue } from "./sectionContext"
import { usePlatformPeriod, type PlatformPeriod } from "./usePlatformPeriod"

type Props = {
  title: string
  subtitle?: string
  /** Show the period presets (default true). */
  showPeriod?: boolean
  /** Undefined hides the auto-refresh control; "off" shows it off by default, "on" on by default. */
  autoRefresh?: "off" | "on"
  /** Extra controls next to the period filter (e.g. a CSV button). */
  actions?: ReactNode
  /** Content, or a function of the period. Resources inside read the period from the shell themselves. */
  children: ReactNode | ((period: PlatformPeriod) => ReactNode)
}

function Inner({ title, subtitle, showPeriod = true, autoRefresh, actions, children }: Props) {
  const period = usePlatformPeriod()
  const [auto, setAuto] = useState(autoRefresh === "on")
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(0)
  const [forbidden, setForbidden] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const reportUpdated = useCallback((at: number) => setUpdatedAt(at), [])
  const reportBusy = useCallback((delta: 1 | -1) => setBusy((count) => Math.max(0, count + delta)), [])
  const value = useMemo<SectionContextValue>(() => ({ period, autoRefresh: auto, reportUpdated, reportBusy, reportForbidden: setForbidden }), [period, auto, reportUpdated, reportBusy])
  return <SectionContext.Provider value={value}>
    <div className="space-y-6">
      <PageHeader title={title} sub={subtitle} actions={<>
        {autoRefresh && <AutoRefresh enabled={auto} onChange={setAuto} updatedAt={updatedAt} refreshing={busy > 0} />}
        {actions}
        {showPeriod && <PeriodFilter preset={period.preset} onChange={period.setPreset} />}
      </>} />
      {forbidden
        ? <ErrorPage mode="block" status={403} title={t("admin.platformAnalytics.forbidden")} text={t("error.page.body")} onRetry={() => { setForbidden(false); setAttempt((n) => n + 1) }} />
        : <div key={attempt}>{typeof children === "function" ? children(period) : children}</div>}
    </div>
  </SectionContext.Provider>
}

/**
 * Shell of every platform analytics page: title, subtitle, period presets (?period=),
 * optional auto-refresh, then the content. It owns the Suspense boundary that
 * useSearchParams needs. A 403 from any useAnalyticsResource inside replaces the
 * content with the admin error screen.
 */
export function SectionPage(props: Props) {
  return <Suspense fallback={<LoadingArea className="min-h-64" label={t("admin.loading")} />}><Inner {...props} /></Suspense>
}
