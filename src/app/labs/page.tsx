"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { apiGet } from "@/api/client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { useRole } from "@/lib/useRole"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { capacityMetrics, formatBytes, formatCpu, monitoringUpdateDetails } from "@/lib/infrastructureMonitoring"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"

type Agent = { id: string; key: string; name: string; configured: boolean; healthy: boolean }
type Status = {
  Available: boolean
  Healthy: boolean
  mode: string
  agents: Agent[]
  capabilities: { laboratories: boolean }
  warning?: { code: string; message: string }
}
type Observation = {
  id: string
  agentId: string
  observedAt: string
  payload: unknown
  snapshot?: boolean
  eventId?: string
  eventTeamId?: string
  labGroupName?: string
}

function modeLabel(mode: string): string {
  switch (mode) {
    case "available": return t("admin.labs.mode.available")
    case "unhealthy": return t("admin.labs.mode.unhealthy")
    case "missing_config": return t("admin.labs.mode.missingConfig")
    default: return t("admin.labs.unknownState")
  }
}

function phaseLabel(phase: string): string {
  switch (phase.toLowerCase()) {
    case "ready": return t("admin.labs.phase.ready")
    case "running": return t("admin.labs.phase.running")
    case "pending": return t("admin.labs.phase.pending")
    case "creating": return t("admin.labs.phase.creating")
    case "failed": return t("admin.labs.phase.failed")
    case "suspended": return t("admin.labs.phase.suspended")
    case "stopped": return t("admin.labs.phase.stopped")
    default: return t("admin.labs.unknownState")
  }
}

function resourceKindLabel(kind: string): string {
  switch (kind.toLowerCase()) {
    case "lab": return t("admin.labs.kind.lab")
    case "group": case "labgroup": return t("admin.labs.kind.group")
    case "client": case "labgroupclient": return t("admin.labs.kind.client")
    case "policy": case "labgroupaccesspolicy": return t("admin.labs.kind.policy")
    default: return t("admin.labs.kind.resource")
  }
}

function warningLabel(status: Status): string | null {
  if (!status.warning) return null
  if (!status.Available) return t("admin.labs.warning.notConfigured")
  if (!status.Healthy) return t("admin.labs.warning.unhealthy")
  return t("admin.labs.warning.attention")
}

function StateBadge({ good, children }: { good: boolean; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${good ? "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]" : "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]"}`}>{children}</span>
}

function ResourceBar({ label, requested, allocatable, format }: { label: string; requested: number | null; allocatable: number | null; format: (value: number | null) => string }) {
  const hasScale = requested !== null && allocatable !== null && allocatable > 0
  const overcommitted = hasScale && requested > allocatable
  return <div className="space-y-1.5">
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-medium text-foreground">{label}</span><span className="tabular-nums text-muted-foreground">{format(requested)} / {format(allocatable)}</span></div>
    {hasScale ? <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuenow={Math.min(requested, allocatable)} aria-valuemax={allocatable} className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${overcommitted ? "bg-[var(--ib-warn)]" : "bg-primary"}`} style={{ width: `${Math.min(100, requested / allocatable * 100)}%` }} /></div> : <p className="text-xs text-muted-foreground">{t("admin.labs.noScale")}</p>}
    {overcommitted && <p className="text-xs text-[var(--ib-warn)]">{t("admin.labs.overcommitted")}</p>}
  </div>
}

function CapacityPanel({ rows, agents, loadError }: { rows: Observation[]; agents: Agent[]; loadError: string }) {
  return <Card>
    <CardHeader><CardTitle className="text-base">{t("admin.labs.capacity.title")}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      {loadError && <p role="alert" className="text-sm text-[var(--ib-danger)]">{loadError}</p>}
      {rows.length === 0 ? !loadError && <EmptyState message={t("admin.labs.capacity.empty")} compact /> : rows.map((row) => {
        const agent = agents.find((item) => item.id === row.agentId || item.key === row.agentId)
        const name = agent?.name || agent?.key || row.agentId
        const metrics = capacityMetrics(row.payload)
        return <section key={row.id} className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">{name}</h3><time dateTime={row.observedAt} className="text-xs text-muted-foreground">{new Date(row.observedAt).toLocaleString("uk-UA")}</time></div>
          {metrics ? <>
            <div className="grid gap-4 md:grid-cols-2">
              <ResourceBar label={t("admin.labs.capacity.cpuLabel", { name })} requested={metrics.requestedCpuMillicores} allocatable={metrics.allocatableCpuMillicores} format={formatCpu} />
              <ResourceBar label={t("admin.labs.capacity.memoryLabel", { name })} requested={metrics.requestedMemoryBytes} allocatable={metrics.allocatableMemoryBytes} format={formatBytes} />
            </div>
            {metrics.nodes.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-primary">{t("admin.labs.capacity.nodes", { count: metrics.nodes.length })}</summary><div className="mt-3 space-y-3 border-l border-border pl-3">{metrics.nodes.map((node) => <div key={node.name} className="grid gap-2 md:grid-cols-[minmax(8rem,1fr)_1fr_1fr]"><span className="font-medium">{node.name}</span><span className="tabular-nums text-muted-foreground">{t("admin.labs.cpuUsage", { used: formatCpu(node.requestedCpuMillicores), total: formatCpu(node.allocatableCpuMillicores) })}</span><span className="tabular-nums text-muted-foreground">{t("admin.labs.memoryUsage", { used: formatBytes(node.requestedMemoryBytes), total: formatBytes(node.allocatableMemoryBytes) })}</span></div>)}</div></details>}
          </> : <p className="text-sm text-muted-foreground">{t("admin.labs.capacity.pending")}</p>}
        </section>
      })}
    </CardContent>
  </Card>
}

function ObservationFacts({ payload }: { payload: unknown }) {
  const details = monitoringUpdateDetails(payload)
  if (Object.values(details).every((items) => items.length === 0)) return <EmptyState message={t("admin.labs.facts.empty")} compact className="mt-2 min-w-72" />
  const section = "space-y-1 border-t border-border py-2 first:border-t-0 first:pt-0"
  return <div className="mt-2 min-w-72 text-xs text-foreground">
    {details.groups.length > 0 && <section className={section}><h4 className="font-semibold">{t("admin.labs.facts.groups")}</h4>{details.groups.map((group, index) => <p key={index}>{group.name || t("admin.labs.facts.unnamed")}{group.phase && ` · ${phaseLabel(group.phase)}`}{group.vpnRegistered !== null && t(group.vpnRegistered ? "admin.labs.facts.vpnConnected" : "admin.labs.facts.vpnDisconnected")}</p>)}</section>}
    {details.labs.length > 0 && <section className={section}><h4 className="font-semibold">{t("admin.labs.facts.labs")}</h4>{details.labs.map((lab, index) => <div key={index} className="space-y-1"><p className="font-medium">{lab.name || t("admin.labs.facts.unnamed")}{lab.phase && <span className="font-normal text-muted-foreground"> · {phaseLabel(lab.phase)}</span>}</p>{lab.devices.map((device, deviceIndex) => <div key={deviceIndex} className="flex flex-wrap gap-x-3 pl-3"><span>{device.name || t("admin.labs.facts.unnamed")}</span><span className="tabular-nums">{t("admin.labs.facts.cpu", { value: formatCpu(device.cpu) })}</span><span>{t("admin.labs.facts.memory", { value: formatBytes(device.memory) })}</span>{device.restarts !== null && <span>{t("admin.labs.facts.restarts", { count: device.restarts })}</span>}</div>)}</div>)}</section>}
    {details.clients.length > 0 && <section className={section}><h4 className="font-semibold">{t("admin.labs.facts.clients")}</h4>{details.clients.map((client, index) => <div key={index} className="flex flex-wrap gap-x-3"><span className="font-medium">{client.name || t("admin.labs.facts.unnamed")}</span>{client.ip && <span>{client.ip}</span>}{client.received !== null && <span>{t("admin.labs.facts.received", { value: formatBytes(client.received) })}</span>}{client.sent !== null && <span>{t("admin.labs.facts.sent", { value: formatBytes(client.sent) })}</span>}</div>)}</section>}
    {details.rules.length > 0 && <section className={section}><h4 className="font-semibold">{t("admin.labs.facts.rules")}</h4>{details.rules.map((rule, index) => <div key={index} className="flex flex-wrap gap-x-3"><span>{t("admin.labs.facts.rule", { client: rule.client || t("admin.labs.facts.client"), lab: rule.lab || t("admin.labs.facts.lab") })}</span><span>{rule.action === "LAB_GROUP_ACCESS_ACTION_DENY" ? t("admin.labs.facts.denied") : rule.action === "LAB_GROUP_ACCESS_ACTION_ALLOW" ? t("admin.labs.facts.allowed") : t("admin.labs.facts.unknownState")}</span>{rule.packets !== null && rule.bytes !== null && <span>{t("admin.labs.facts.traffic", { packets: rule.packets, bytes: formatBytes(rule.bytes) })}</span>}</div>)}</section>}
    {details.deleted.length > 0 && <section className={section}><h4 className="font-semibold">{t("admin.labs.facts.deleted")}</h4>{details.deleted.map((item, index) => <p key={index}><span>{t("admin.labs.facts.deletedItem", { name: item.name || t("admin.labs.facts.unnamedLower") })}</span>{item.kind && <span className="text-muted-foreground"> ({resourceKindLabel(item.kind)})</span>}</p>)}</section>}
  </div>
}

function Observations({ title, rows, empty, loadError }: { title: string; rows: Observation[]; empty: string; loadError: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {loadError && <p role="alert" className="mb-3 text-sm text-[var(--ib-danger)]">{loadError}</p>}
        {rows.length === 0 ? !loadError && <EmptyState message={empty} compact /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-2 pr-4 font-medium">{t("admin.labs.obs.source")}</th><th className="py-2 pr-4 font-medium">{t("admin.labs.obs.observed")}</th><th className="py-2 font-medium">{t("admin.labs.obs.data")}</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => <tr key={row.id}>
                  <td className="py-2 pr-4"><span className="font-medium">{row.labGroupName || row.agentId}</span>{row.eventId && <span className="block text-xs text-muted-foreground">{row.eventId}</span>}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">{new Date(row.observedAt).toLocaleString("uk-UA")}{row.snapshot === false && <span className="block text-xs">{t("admin.labs.obs.partial")}</span>}</td>
                  <td className="py-2"><details><summary className="cursor-pointer text-primary">{t("admin.labs.obs.viewMetrics")}</summary><ObservationFacts payload={row.payload} /></details></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Page() {
  const allowed = useRole().can("infrastructure.read")
  const [status, setStatus] = useState<Status | null>(null)
  const [labs, setLabs] = useState<Observation[]>([])
  const [capacity, setCapacity] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [labsError, setLabsError] = useState("")
  const [capacityError, setCapacityError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    setLabsError("")
    setCapacityError("")
    const [nextStatus, nextLabs, nextCapacity] = await Promise.allSettled([
      apiGet<Status>("/api/infrastructure/status"),
      apiGet<Observation[]>("/api/infrastructure/monitoring/current"),
      apiGet<Observation[]>("/api/infrastructure/monitoring/capacity/current"),
    ])
    if (nextStatus.status === "fulfilled") setStatus(nextStatus.value)
    else {
      setError(t("admin.labs.error.status"))
    }
    if (nextLabs.status === "fulfilled") setLabs(nextLabs.value ?? [])
    else setLabsError(t("admin.labs.error.labs"))
    if (nextCapacity.status === "fulfilled") setCapacity(nextCapacity.value ?? [])
    else setCapacityError(t("admin.labs.error.capacity"))
    setLoading(false)
  }, [])

  useEffect(() => { if (allowed) queueMicrotask(() => void load()) }, [allowed, load])

  return <RequirePermission perm="infrastructure.read" fallback={<p className="text-sm text-muted-foreground">{t("admin.labs.noAccess")}</p>}>
    <div className="flex min-h-full flex-col gap-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-foreground">{t("admin.labs.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("admin.labs.subtitle")}</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t("admin.labs.refresh")}</Button></div>
      {error && <p role="alert" className="rounded-md bg-[var(--ib-danger-bg)] p-3 text-sm text-[var(--ib-danger)]">{error}</p>}
      {loading && !status ? <LoadingArea className="flex-1" label={t("admin.loading")} /> : status && <>
        <Card><CardHeader><CardTitle className="text-base">{t("admin.labs.connection")}</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><StateBadge good={status.Available && status.Healthy}>{t(status.Available ? status.Healthy ? "admin.labs.state.available" : "admin.labs.state.attention" : "admin.labs.state.disconnected")}</StateBadge><span className="text-sm text-muted-foreground">{t("admin.labs.modeLine", { mode: modeLabel(status.mode) })}</span></div>
          {warningLabel(status) && <p role="alert" className="text-sm text-[var(--ib-warn)]">{warningLabel(status)}</p>}
          {status.agents.length === 0 ? <EmptyState message={t("admin.labs.noAgents")} compact /> : <ul className="divide-y divide-border">{status.agents.map((agent) => <li key={agent.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="font-medium">{agent.name || agent.key}</span><StateBadge good={agent.healthy}>{t(agent.healthy ? "admin.labs.agent.up" : "admin.labs.agent.down")}</StateBadge></li>)}</ul>}
        </CardContent></Card>
        <Observations title={t("admin.labs.obs.title")} rows={labs} empty={t("admin.labs.obs.empty")} loadError={labsError} />
        <CapacityPanel rows={capacity} agents={status.agents} loadError={capacityError} />
      </>}
    </div>
  </RequirePermission>
}
