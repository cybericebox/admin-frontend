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
import { toast } from "@/components/ui/toast"
import {
  getCurrentCapacity, getCurrentLabs, getInfrastructureStatus, listStandEvents, listStands, recreateStand,
  type CapacityObservation, type CurrentLab, type InfrastructureStatus, type Stand, type StandEventOption,
} from "@/api/infrastructure"
import { CapacityPanel } from "@/components/infrastructure/CapacityPanel"
import { CurrentState } from "@/components/infrastructure/CurrentState"
import { RefreshIndicator } from "@/components/infrastructure/RefreshIndicator"
import { StandsTable, teamLabel, type StandsFilters } from "@/components/infrastructure/StandsTable"
import { localizedError } from "@/i18n/apiError"
import { usePolling } from "@/lib/usePolling"
import { t } from "@/i18n/t"

function modeLabel(mode: string): string {
  switch (mode) {
    case "available": return t("admin.labs.mode.available")
    case "unhealthy": return t("admin.labs.mode.unhealthy")
    case "missing_config": return t("admin.labs.mode.missingConfig")
    default: return t("admin.labs.unknownState")
  }
}

function warningLabel(status: InfrastructureStatus): string | null {
  if (!status.Warning) return null
  if (!status.Healthy) return t("admin.labs.warning.unhealthy")
  return t("admin.labs.warning.attention")
}

function StateBadge({ good, children }: { good: boolean; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${good ? "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]" : "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]"}`}>{children}</span>
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
  const [standEvents, setStandEvents] = useState<StandEventOption[]>([])
  const [includeRecent, setIncludeRecent] = useState(false)
  const [filters, setFilters] = useState<StandsFilters>(() => ({ eventId: params.get("eventId") ?? "", status: params.get("status") ?? "", search: "", page: 1, pageSize: 25 }))
  const [searchInput, setSearchInput] = useState("")
  const [error, setError] = useState("")
  const [labsError, setLabsError] = useState("")
  const [capacityError, setCapacityError] = useState("")
  const [standsError, setStandsError] = useState("")
  // Rejection reasons of the last load, so LoadError can show the error code.
  const [causes, setCauses] = useState<{ status?: unknown; labs?: unknown; capacity?: unknown; stands?: unknown }>({})

  const filtersRef = useRef(filters)
  const recentRef = useRef(includeRecent)
  useEffect(() => { filtersRef.current = filters; recentRef.current = includeRecent })

  const load = useCallback(async () => {
    setStandsLoading(true)
    const [nextStatus, nextLabs, nextCapacity, nextStands, nextEvents] = await Promise.allSettled([
      getInfrastructureStatus(), getCurrentLabs(recentRef.current), getCurrentCapacity(), listStands(filtersRef.current), listStandEvents(),
    ])
    if (nextStatus.status === "fulfilled") { setStatus(nextStatus.value); setError("") } else setError(t("admin.labs.error.status"))
    if (nextLabs.status === "fulfilled") { setCurrent(nextLabs.value ?? []); setLabsError("") } else setLabsError(t("admin.labs.error.labs"))
    if (nextCapacity.status === "fulfilled") { setCapacity(nextCapacity.value ?? []); setCapacityError("") } else setCapacityError(t("admin.labs.error.capacity"))
    if (nextStands.status === "fulfilled") { setStands(nextStands.value.Items ?? []); setStandsTotal(nextStands.value.Total ?? 0); setStandsError("") } else setStandsError(t("admin.labs.error.stands"))
    const reason = (result: PromiseSettledResult<unknown>) => result.status === "rejected" ? result.reason : undefined
    setCauses({ status: reason(nextStatus), labs: reason(nextLabs), capacity: reason(nextCapacity), stands: reason(nextStands) })
    if (nextEvents.status === "fulfilled") setStandEvents(nextEvents.value ?? [])
    setStandsLoading(false)
  }, [])

  const { updatedAt, refreshing, refresh } = usePolling(load, allowed)

  // Filters and the recent toggle change the request itself: reload straight away.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    void refresh(true)
  }, [filters, includeRecent, refresh])

  useEffect(() => {
    const next = searchInput.trim()
    if (next === filtersRef.current.search) return
    const id = setTimeout(() => setFilters((value) => ({ ...value, search: next, page: 1 })), 300)
    return () => clearTimeout(id)
  }, [searchInput])

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

  const loading = updatedAt === null && !status && !error
  const connected = status?.Available === true
  const retry = () => void refresh(true)

  return <RequirePermission perm="infrastructure.read" fallback={<p className="text-sm text-muted-foreground">{t("admin.labs.noAccess")}</p>}>
    <div className="flex min-h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold text-foreground">{t("admin.labs.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("admin.labs.subtitle")}</p></div>
        {/* Nothing to refresh while the laboratory is not connected: the page keeps polling quietly and switches on its own. */}
        {connected && <div className="flex items-center gap-3">
          <RefreshIndicator updatedAt={updatedAt} refreshing={refreshing} />
          <Button variant="outline" onClick={retry} disabled={refreshing}><RefreshCw className="mr-2 h-4 w-4" />{t("admin.labs.refresh")}</Button>
        </div>}
      </div>
      {error && status && <LoadError message={error} error={causes.status} compact onRetry={retry} />}
      {loading ? <LoadingArea className="flex-1" label={t("admin.loading")} /> : !status ? error && <LoadError message={error} error={causes.status} onRetry={retry} className="flex-1" /> : !connected ? <EmptyState className="flex-1" message={t("admin.labs.notConnected")} /> : <>
        <Card><CardHeader><CardTitle className="flex items-center gap-1.5 text-base">{t("admin.labs.connection")}<FieldHelp text={t("admin.labs.connectionHelp")} /></CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><StateBadge good={status.Healthy}>{t(status.Healthy ? "admin.labs.state.available" : "admin.labs.state.attention")}</StateBadge><span className="text-sm text-muted-foreground">{t("admin.labs.modeLine", { mode: modeLabel(status.Mode) })}</span></div>
          {warningLabel(status) && <p role="alert" className="text-sm text-[var(--ib-warn)]">{warningLabel(status)}</p>}
          {status.Agents.length > 0 && <ul className="divide-y divide-border">{status.Agents.map((agent) => <li key={agent.ID} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="font-medium">{agent.Name || agent.Key}</span><StateBadge good={agent.Healthy}>{t(agent.Healthy ? "admin.labs.agent.up" : "admin.labs.agent.down")}</StateBadge></li>)}</ul>}
        </CardContent></Card>
        <StandsTable filters={filters} searchInput={searchInput} onSearchInput={setSearchInput} onFilters={(patch) => setFilters((value) => ({ ...value, ...patch }))}
          events={standEvents} items={stands} total={standsTotal} loading={standsLoading} error={standsError} errorCause={causes.stands} canWrite={canWrite} onRetry={retry}
          onRecreate={(stand) => { setRecreateError(null); setTarget(stand) }} />
        <CurrentState rows={current} includeRecent={includeRecent} onIncludeRecent={setIncludeRecent} loadError={labsError} errorCause={causes.labs} onRetry={retry} />
        <CapacityPanel rows={capacity} agents={status.Agents} loadError={capacityError} errorCause={causes.capacity} onRetry={retry} />
      </>}
      <ConfirmDialog open={target !== null} onCancel={() => { if (!busy) setTarget(null) }} tone="danger" busy={busy} error={recreateError}
        title={t("admin.labs.stands.recreate.title")}
        description={target ? t("admin.labs.stands.recreate.body", { event: target.EventName || target.EventTag, team: teamLabel(target) }) : undefined}
        confirmLabel={t("admin.labs.stands.recreate.confirm")}
        onConfirm={() => void runRecreate()} />
    </div>
  </RequirePermission>
}

export default function Page() {
  return <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><LabsPage /></Suspense>
}
