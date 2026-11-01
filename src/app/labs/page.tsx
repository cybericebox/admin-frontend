"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { useRole } from "@/lib/useRole"
import { Button } from "@/components/ui/button"
import { FieldHelp } from "@/components/ui/field-help"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { NoAccess } from "@/components/rbac/NoAccess"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getCurrentCapacity, getCurrentLabs, getInfrastructureStatus, getInfrastructureSummary,
  type CapacityObservation, type CurrentLab, type InfrastructureStatus, type InfrastructureSummary, type Stand, type TestLab,
} from "@/api/infrastructure"
import { CapacityPanel } from "@/components/infrastructure/CapacityPanel"
import { StandDetailDialog, TestLabDetailDialog } from "@/components/infrastructure/LabDetailDialogs"
import { CurrentState } from "@/components/infrastructure/CurrentState"
import { RefreshIndicator } from "@/components/infrastructure/RefreshIndicator"
import { StandsTab } from "@/components/infrastructure/StandsTab"
import { TestLabsTab } from "@/components/infrastructure/TestLabsTab"
import { agentDisplayName } from "@/lib/infrastructureMonitoring"
import { formatNumber } from "@/lib/locale"
import { usePolling } from "@/lib/usePolling"
import { useUrlState } from "@/lib/useUrlState"
import { t } from "@/i18n/t"

const TABS = ["stands", "testLabs", "current", "capacity"]

// One short reason under the chip, only when the chip alone does not say it.
function warningLabel(status: InfrastructureStatus): string | null {
  return status.Warning && !status.Healthy ? t("admin.labs.warning.unhealthy") : null
}

function StateBadge({ good, children }: { good: boolean; children: React.ReactNode }) {
  return <Badge tone={good ? "ok" : "warn"}>{children}</Badge>
}

const dash = (value: number | null | undefined) => value === undefined || value === null ? "—" : formatNumber(value)
const percent = (value: number | null | undefined) => value === undefined || value === null ? "—" : `${formatNumber(value, { maximumFractionDigits: 1 })}%`

/** The KPI strip above the tabs: the figures the dashboard shows, here to read the tabs against. */
function Kpis({ summary }: { summary: InfrastructureSummary | null }) {
  const tiles: [string, string][] = [
    [t("admin.dashboard.standsActive"), summary ? dash(summary.Stands.Active + (summary.TestLabs?.Active ?? 0)) : "—"],
    [t("admin.dashboard.standsFailed"), summary ? dash(summary.Stands.Failed) : "—"],
    [t("admin.labs.kpi.testLabs"), summary?.TestLabs ? dash(summary.TestLabs.Active) : "—"],
    [t("admin.dashboard.clusterCpu"), percent(summary?.Capacity?.CPUPercent)],
    [t("admin.dashboard.clusterMemory"), percent(summary?.Capacity?.MemoryPercent)],
  ]
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {tiles.map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card px-4 py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{value}</dd></div>)}
  </dl>
}

function LabsPage() {
  const { can } = useRole()
  const allowed = can("infrastructure.read")
  const canWrite = can("infrastructure.write")
  const [url, setUrl] = useUrlState({ tab: "stands" })
  const tab = TABS.includes(url.tab) ? url.tab : "stands"
  // The dashboard links here with ?status=failed.
  const [initialStatus] = useState(() => typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search).get("status") ?? undefined)

  const [status, setStatus] = useState<InfrastructureStatus | null>(null)
  const [summary, setSummary] = useState<InfrastructureSummary | null>(null)
  const [current, setCurrent] = useState<CurrentLab[]>([])
  const [capacity, setCapacity] = useState<CapacityObservation[]>([])
  const [includeRecent, setIncludeRecent] = useState(false)
  const [error, setError] = useState("")
  const [labsError, setLabsError] = useState("")
  const [capacityError, setCapacityError] = useState("")
  const [causes, setCauses] = useState<{ status?: unknown; labs?: unknown; capacity?: unknown }>({})
  const recentRef = useRef(includeRecent)
  useEffect(() => { recentRef.current = includeRecent })

  const load = useCallback(async () => {
    const [nextStatus, nextSummary, nextLabs, nextCapacity] = await Promise.allSettled([getInfrastructureStatus(), getInfrastructureSummary(), getCurrentLabs(recentRef.current), getCurrentCapacity()])
    if (nextStatus.status === "fulfilled") { setStatus(nextStatus.value); setError("") } else setError(t("admin.labs.error.status"))
    if (nextSummary.status === "fulfilled") setSummary(nextSummary.value)
    if (nextLabs.status === "fulfilled") { setCurrent(nextLabs.value ?? []); setLabsError("") } else setLabsError(t("admin.labs.error.labs"))
    if (nextCapacity.status === "fulfilled") { setCapacity(nextCapacity.value ?? []); setCapacityError("") } else setCapacityError(t("admin.labs.error.capacity"))
    const reason = (result: PromiseSettledResult<unknown>) => result.status === "rejected" ? result.reason : undefined
    setCauses({ status: reason(nextStatus), labs: reason(nextLabs), capacity: reason(nextCapacity) })
  }, [])
  const { updatedAt, refreshing, refresh } = usePolling(load, allowed)
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } void refresh(true) }, [includeRecent, refresh])

  const [detailStand, setDetailStand] = useState<Stand | null>(null)
  const [detailLab, setDetailLab] = useState<TestLab | null>(null)

  const loading = updatedAt === null && !status && !error
  const connected = status?.Available === true
  const retry = () => void refresh(true)

  return <RequirePermission perm="infrastructure.read" fallback={<NoAccess message={t("admin.labs.noAccess")} />}>
    <div className="flex min-h-full min-w-0 flex-col gap-4 md:h-full md:min-h-0">
      {/* Nothing to refresh while the laboratory is not connected: the page keeps polling quietly and switches on its own. */}
      <PageHeader title={t("admin.labs.title")} sub={t("admin.labs.subtitle")} actions={connected ? <>
        <RefreshIndicator updatedAt={updatedAt} refreshing={refreshing} />
        <Button variant="outline" onClick={retry} disabled={refreshing}><RefreshCw className="mr-2 h-4 w-4" />{t("admin.labs.refresh")}</Button>
      </> : undefined} />
      {error && status && <LoadError message={error} error={causes.status} compact onRetry={retry} />}
      {loading ? <LoadingArea className="flex-1" label={t("admin.loading")} /> : !status ? error && <LoadError message={error} error={causes.status} onRetry={retry} className="flex-1" /> : !connected ? <EmptyState className="flex-1" message={t("admin.labs.notConnected")} /> : <>
        <Card className="shrink-0"><CardHeader><CardTitle className="flex items-center gap-1.5 text-base">{t("admin.labs.connection")}<FieldHelp text={t("admin.labs.connectionHelp")} /></CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><StateBadge good={status.Healthy}>{t(status.Healthy ? "admin.labs.state.available" : "admin.labs.state.attention")}</StateBadge></div>
          {warningLabel(status) && <p role="alert" className="text-sm text-muted-foreground">{warningLabel(status)}</p>}
          {status.Agents.length > 0 && <ul className="divide-y divide-border">{status.Agents.map((agent) => <li key={agent.ID} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 break-words font-medium">{agentDisplayName(agent)}</span><span className="shrink-0"><StateBadge good={agent.Healthy}>{t(agent.Healthy ? "admin.labs.agent.up" : "admin.labs.agent.down")}</StateBadge></span></li>)}</ul>}
        </CardContent></Card>
        <Kpis summary={summary} />
        <Tabs value={tab} onValueChange={(value) => setUrl({ tab: value })} className="flex min-h-0 flex-1 flex-col">
          <TabsList aria-label={t("admin.labs.tabsLabel")}>
            <TabsTrigger value="stands">{t("admin.labs.tab.stands")}</TabsTrigger>
            <TabsTrigger value="testLabs">{t("admin.labs.tab.testLabs")}</TabsTrigger>
            <TabsTrigger value="current">{t("admin.labs.tab.current")}</TabsTrigger>
            <TabsTrigger value="capacity">{t("admin.labs.tab.capacity")}</TabsTrigger>
          </TabsList>
          <TabsContent value="stands" className="mt-4 min-h-0 flex-1"><StandsTab canWrite={canWrite} initialStatus={initialStatus} onDetails={setDetailStand} /></TabsContent>
          <TabsContent value="testLabs" className="mt-4 min-h-0 flex-1"><TestLabsTab canWrite={canWrite} onDetails={setDetailLab} /></TabsContent>
          <TabsContent value="current" className="mt-4 min-h-0 flex-1 overflow-auto"><CurrentState rows={current} includeRecent={includeRecent} onIncludeRecent={setIncludeRecent} loadError={labsError} errorCause={causes.labs} onRetry={retry} /></TabsContent>
          <TabsContent value="capacity" className="mt-4 min-h-0 flex-1 overflow-auto"><CapacityPanel rows={capacity} agents={status.Agents} loadError={capacityError} errorCause={causes.capacity} onRetry={retry} /></TabsContent>
        </Tabs>
      </>}
      <StandDetailDialog stand={detailStand} canWrite={canWrite} onClose={() => setDetailStand(null)} />
      <TestLabDetailDialog lab={detailLab} canWrite={canWrite} onClose={() => setDetailLab(null)} />
    </div>
  </RequirePermission>
}

export default function Page() {
  return <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><LabsPage /></Suspense>
}
