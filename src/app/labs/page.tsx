"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { useRole } from "@/lib/useRole"
import { Button } from "@/components/ui/button"
import { FieldHelp } from "@/components/ui/field-help"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { NoAccess } from "@/components/rbac/NoAccess"
import { PageHeader } from "@/components/ui/page-header"
import { toast } from "@/components/ui/toast"
import {
  getCurrentCapacity, getCurrentLabs, getInfrastructureStatus, listStandEvents, listStands, listTestLabs, recreateStand, terminateTestLab,
  type CapacityObservation, type CurrentLab, type InfrastructureStatus, type Stand, type StandEventOption, type TestLab,
} from "@/api/infrastructure"
import { CapacityPanel } from "@/components/infrastructure/CapacityPanel"
import { StandDetailDialog, TestLabDetailDialog } from "@/components/infrastructure/LabDetailDialogs"
import { CurrentState } from "@/components/infrastructure/CurrentState"
import { RefreshIndicator } from "@/components/infrastructure/RefreshIndicator"
import { StandsTable, teamLabel, type StandsFilters } from "@/components/infrastructure/StandsTable"
import { TestLabsTable, testLabAuthor, type TestLabsFilters } from "@/components/infrastructure/TestLabsTable"
import { localizedError } from "@/i18n/apiError"
import { agentDisplayName } from "@/lib/infrastructureMonitoring"
import { usePolling } from "@/lib/usePolling"
import { t } from "@/i18n/t"

// One short reason under the chip, only when the chip alone does not say it.
function warningLabel(status: InfrastructureStatus): string | null {
  return status.Warning && !status.Healthy ? t("admin.labs.warning.unhealthy") : null
}

function StateBadge({ good, children }: { good: boolean; children: React.ReactNode }) {
  return <Badge tone={good ? "ok" : "warn"}>{children}</Badge>
}

function LabsPage() {
  const params = useSearchParams()
  const { can } = useRole()
  const allowed = can("infrastructure.read")
  const canWrite = can("infrastructure.write")

  const [status, setStatus] = useState<InfrastructureStatus | null>(null)
  const [current, setCurrent] = useState<CurrentLab[]>([])
  const [capacity, setCapacity] = useState<CapacityObservation[]>([])
  const [stands, setStands] = useState<Stand[] | null>(null)
  const [standsTotal, setStandsTotal] = useState(0)
  const [standsLoading, setStandsLoading] = useState(false)
  const [testLabs, setTestLabs] = useState<TestLab[] | null>(null)
  const [testLabsTotal, setTestLabsTotal] = useState(0)
  const [testLabsFilters, setTestLabsFilters] = useState<TestLabsFilters>({ search: "", page: 1, pageSize: 25 })
  const [testLabsSearchInput, setTestLabsSearchInput] = useState("")
  const [testLabsError, setTestLabsError] = useState("")
  const [standEvents, setStandEvents] = useState<StandEventOption[]>([])
  const [includeRecent, setIncludeRecent] = useState(false)
  const [filters, setFilters] = useState<StandsFilters>(() => ({ eventId: params.get("eventId") ?? "", status: params.get("status") ?? "", kind: params.get("kind") ?? "", search: "", page: 1, pageSize: 25 }))
  const [searchInput, setSearchInput] = useState("")
  const [error, setError] = useState("")
  const [labsError, setLabsError] = useState("")
  const [capacityError, setCapacityError] = useState("")
  const [standsError, setStandsError] = useState("")
  // Rejection reasons of the last load, so LoadError can show the error code.
  const [causes, setCauses] = useState<{ status?: unknown; labs?: unknown; capacity?: unknown; stands?: unknown; testLabs?: unknown }>({})

  const filtersRef = useRef(filters)
  const testLabsFiltersRef = useRef(testLabsFilters)
  const recentRef = useRef(includeRecent)
  useEffect(() => { filtersRef.current = filters; testLabsFiltersRef.current = testLabsFilters; recentRef.current = includeRecent })

  const load = useCallback(async () => {
    setStandsLoading(true)
    const [nextStatus, nextLabs, nextCapacity, nextStands, nextEvents, nextTestLabs] = await Promise.allSettled([
      getInfrastructureStatus(), getCurrentLabs(recentRef.current), getCurrentCapacity(), listStands(filtersRef.current), listStandEvents(), listTestLabs(testLabsFiltersRef.current),
    ])
    if (nextStatus.status === "fulfilled") { setStatus(nextStatus.value); setError("") } else setError(t("admin.labs.error.status"))
    if (nextLabs.status === "fulfilled") { setCurrent(nextLabs.value ?? []); setLabsError("") } else setLabsError(t("admin.labs.error.labs"))
    if (nextCapacity.status === "fulfilled") { setCapacity(nextCapacity.value ?? []); setCapacityError("") } else setCapacityError(t("admin.labs.error.capacity"))
    if (nextStands.status === "fulfilled") { setStands(nextStands.value.Items ?? []); setStandsTotal(nextStands.value.Total ?? 0); setStandsError("") } else setStandsError(t("admin.labs.error.stands"))
    const reason = (result: PromiseSettledResult<unknown>) => result.status === "rejected" ? result.reason : undefined
    if (nextTestLabs.status === "fulfilled") { setTestLabs(nextTestLabs.value.Items ?? []); setTestLabsTotal(nextTestLabs.value.Total ?? 0); setTestLabsError("") } else setTestLabsError(t("admin.labs.error.testLabs"))
    setCauses({ status: reason(nextStatus), labs: reason(nextLabs), capacity: reason(nextCapacity), stands: reason(nextStands), testLabs: reason(nextTestLabs) })
    if (nextEvents.status === "fulfilled") setStandEvents(nextEvents.value ?? [])
    setStandsLoading(false)
  }, [])

  const { updatedAt, refreshing, refresh } = usePolling(load, allowed)

  // Filters and the recent toggle change the request itself: reload straight away.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    void refresh(true)
  }, [filters, testLabsFilters, includeRecent, refresh])

  useEffect(() => {
    const next = searchInput.trim()
    if (next === filtersRef.current.search) return
    const id = setTimeout(() => setFilters((value) => ({ ...value, search: next, page: 1 })), 300)
    return () => clearTimeout(id)
  }, [searchInput])

  useEffect(() => {
    const next = testLabsSearchInput.trim()
    if (next === testLabsFiltersRef.current.search) return
    const id = setTimeout(() => setTestLabsFilters((value) => ({ ...value, search: next, page: 1 })), 300)
    return () => clearTimeout(id)
  }, [testLabsSearchInput])

  const [target, setTarget] = useState<Stand | null>(null)
  const [busy, setBusy] = useState(false)
  const [recreateError, setRecreateError] = useState<string | null>(null)

  async function runRecreate() {
    if (!target) return
    setBusy(true)
    setRecreateError(null)
    try {
      await recreateStand(target.EventID, target.TeamID)
      toast.success(t("admin.labs.stands.recreated"))
      setTarget(null)
      void refresh(true)
    } catch (e) {
      setRecreateError(localizedError(e))
    } finally {
      setBusy(false)
    }
  }

  const [detailStand, setDetailStand] = useState<Stand | null>(null)
  const [detailLab, setDetailLab] = useState<TestLab | null>(null)
  // The open detail follows the freshest row of its list (queue, warning), keeping the last one if the row left the page.
  const shownStand = detailStand && (stands?.find((item) => item.EventID === detailStand.EventID && item.TeamID === detailStand.TeamID) ?? detailStand)
  const shownLab = detailLab && (testLabs?.find((item) => item.ID === detailLab.ID) ?? detailLab)

  const [labTarget, setLabTarget] = useState<TestLab | null>(null)
  const [labBusy, setLabBusy] = useState(false)
  const [labError, setLabError] = useState<string | null>(null)

  async function runTerminate() {
    if (!labTarget) return
    setLabBusy(true)
    setLabError(null)
    try {
      await terminateTestLab(labTarget.ID)
      toast.success(t("admin.labs.testLabs.terminated"))
      setLabTarget(null)
      void refresh(true)
    } catch (e) {
      setLabError(localizedError(e))
    } finally {
      setLabBusy(false)
    }
  }

  const loading = updatedAt === null && !status && !error
  const connected = status?.Available === true
  const retry = () => void refresh(true)

  return <RequirePermission perm="infrastructure.read" fallback={<NoAccess message={t("admin.labs.noAccess")} />}>
    <div className="flex min-h-full flex-col gap-5">
      {/* Nothing to refresh while the laboratory is not connected: the page keeps polling quietly and switches on its own. */}
      <PageHeader title={t("admin.labs.title")} sub={t("admin.labs.subtitle")} actions={connected ? <>
        <RefreshIndicator updatedAt={updatedAt} refreshing={refreshing} />
        <Button variant="outline" onClick={retry} disabled={refreshing}><RefreshCw className="mr-2 h-4 w-4" />{t("admin.labs.refresh")}</Button>
      </> : undefined} />
      {error && status && <LoadError message={error} error={causes.status} compact onRetry={retry} />}
      {loading ? <LoadingArea className="flex-1" label={t("admin.loading")} /> : !status ? error && <LoadError message={error} error={causes.status} onRetry={retry} className="flex-1" /> : !connected ? <EmptyState className="flex-1" message={t("admin.labs.notConnected")} /> : <>
        <Card><CardHeader><CardTitle className="flex items-center gap-1.5 text-base">{t("admin.labs.connection")}<FieldHelp text={t("admin.labs.connectionHelp")} /></CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><StateBadge good={status.Healthy}>{t(status.Healthy ? "admin.labs.state.available" : "admin.labs.state.attention")}</StateBadge></div>
          {warningLabel(status) && <p role="alert" className="text-sm text-muted-foreground">{warningLabel(status)}</p>}
          {status.Agents.length > 0 && <ul className="divide-y divide-border">{status.Agents.map((agent) => <li key={agent.ID} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="font-medium">{agentDisplayName(agent)}</span><StateBadge good={agent.Healthy}>{t(agent.Healthy ? "admin.labs.agent.up" : "admin.labs.agent.down")}</StateBadge></li>)}</ul>}
        </CardContent></Card>
        <StandsTable filters={filters} searchInput={searchInput} onSearchInput={setSearchInput} onFilters={(patch) => setFilters((value) => ({ ...value, ...patch }))}
          events={standEvents} items={stands} total={standsTotal} loading={standsLoading} error={standsError} errorCause={causes.stands} canWrite={canWrite} onRetry={retry}
          onRecreate={(stand) => { setRecreateError(null); setTarget(stand) }} onDetails={setDetailStand} />
        <TestLabsTable filters={testLabsFilters} searchInput={testLabsSearchInput} onSearchInput={setTestLabsSearchInput} onFilters={(patch) => setTestLabsFilters((value) => ({ ...value, ...patch }))}
          items={testLabs} total={testLabsTotal} loading={standsLoading} error={testLabsError} errorCause={causes.testLabs} canWrite={canWrite} onRetry={retry}
          onTerminate={(lab) => { setLabError(null); setLabTarget(lab) }} onDetails={setDetailLab} />
        <CurrentState rows={current} includeRecent={includeRecent} onIncludeRecent={setIncludeRecent} loadError={labsError} errorCause={causes.labs} onRetry={retry} />
        <CapacityPanel rows={capacity} agents={status.Agents} loadError={capacityError} errorCause={causes.capacity} onRetry={retry} />
      </>}
      <StandDetailDialog stand={detailStand ? shownStand : null} canWrite={canWrite} onClose={() => setDetailStand(null)} />
      <TestLabDetailDialog lab={detailLab ? shownLab : null} canWrite={canWrite} onClose={() => setDetailLab(null)} />
      <ConfirmDialog open={target !== null} onCancel={() => { if (!busy) setTarget(null) }} tone="danger" busy={busy} error={recreateError}
        title={t("admin.labs.stands.recreate.title")}
        description={target ? t("admin.labs.stands.recreate.body", { event: target.EventName || target.EventTag, team: teamLabel(target) }) : undefined}
        confirmLabel={t("admin.labs.stands.recreate.confirm")}
        onConfirm={() => void runRecreate()} />
      <ConfirmDialog open={labTarget !== null} onCancel={() => { if (!labBusy) setLabTarget(null) }} tone="danger" busy={labBusy} error={labError}
        title={t("admin.labs.testLabs.terminate.title")}
        description={labTarget ? t("admin.labs.testLabs.terminate.body", { exercise: labTarget.ExerciseName, author: testLabAuthor(labTarget) }) : undefined}
        confirmLabel={t("admin.labs.testLabs.terminate.confirm")}
        onConfirm={() => void runTerminate()} />
    </div>
  </RequirePermission>
}

export default function Page() {
  return <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><LabsPage /></Suspense>
}
