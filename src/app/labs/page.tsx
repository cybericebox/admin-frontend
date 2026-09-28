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
    case "available": return "доступно"
    case "unhealthy": return "потребує уваги"
    case "missing_config": return "не налаштовано"
    default: return "невідомий стан"
  }
}

function phaseLabel(phase: string): string {
  switch (phase.toLowerCase()) {
    case "ready": return "готово"
    case "running": return "працює"
    case "pending": return "очікує"
    case "creating": return "створюється"
    case "failed": return "помилка"
    case "suspended": return "призупинено"
    case "stopped": return "зупинено"
    default: return "невідомий стан"
  }
}

function resourceKindLabel(kind: string): string {
  switch (kind.toLowerCase()) {
    case "lab": return "лабораторія"
    case "group": case "labgroup": return "група"
    case "client": case "labgroupclient": return "VPN-клієнт"
    case "policy": case "labgroupaccesspolicy": return "правило доступу"
    default: return "ресурс"
  }
}

function warningLabel(status: Status): string | null {
  if (!status.warning) return null
  if (!status.Available) return "Агент лабораторій не налаштований."
  if (!status.Healthy) return "Агент лабораторій не відповідає на перевірку стану."
  return "Інфраструктура потребує уваги."
}

function StateBadge({ good, children }: { good: boolean; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${good ? "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]" : "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]"}`}>{children}</span>
}

function ResourceBar({ label, requested, allocatable, format }: { label: string; requested: number | null; allocatable: number | null; format: (value: number | null) => string }) {
  const hasScale = requested !== null && allocatable !== null && allocatable > 0
  const overcommitted = hasScale && requested > allocatable
  return <div className="space-y-1.5">
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-medium text-foreground">{label}</span><span className="tabular-nums text-muted-foreground">{format(requested)} / {format(allocatable)}</span></div>
    {hasScale ? <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuenow={Math.min(requested, allocatable)} aria-valuemax={allocatable} className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${overcommitted ? "bg-[var(--ib-warn)]" : "bg-primary"}`} style={{ width: `${Math.min(100, requested / allocatable * 100)}%` }} /></div> : <p className="text-xs text-muted-foreground">Немає даних для порівняння.</p>}
    {overcommitted && <p className="text-xs text-[var(--ib-warn)]">Перевищено доступну ємність.</p>}
  </div>
}

function CapacityPanel({ rows, agents, loadError }: { rows: Observation[]; agents: Agent[]; loadError: string }) {
  return <Card>
    <CardHeader><CardTitle className="text-base">Ресурси кластера</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      {loadError && <p role="alert" className="text-sm text-[var(--ib-danger)]">{loadError}</p>}
      {rows.length === 0 ? !loadError && <EmptyState message="Немає даних про ресурси кластера." compact /> : rows.map((row) => {
        const agent = agents.find((item) => item.id === row.agentId || item.key === row.agentId)
        const name = agent?.name || agent?.key || row.agentId
        const metrics = capacityMetrics(row.payload)
        return <section key={row.id} className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">{name}</h3><time dateTime={row.observedAt} className="text-xs text-muted-foreground">{new Date(row.observedAt).toLocaleString("uk-UA")}</time></div>
          {metrics ? <>
            <div className="grid gap-4 md:grid-cols-2">
              <ResourceBar label={`CPU агента ${name}`} requested={metrics.requestedCpuMillicores} allocatable={metrics.allocatableCpuMillicores} format={formatCpu} />
              <ResourceBar label={`Пам’ять агента ${name}`} requested={metrics.requestedMemoryBytes} allocatable={metrics.allocatableMemoryBytes} format={formatBytes} />
            </div>
            {metrics.nodes.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-primary">Вузли ({metrics.nodes.length})</summary><div className="mt-3 space-y-3 border-l border-border pl-3">{metrics.nodes.map((node) => <div key={node.name} className="grid gap-2 md:grid-cols-[minmax(8rem,1fr)_1fr_1fr]"><span className="font-medium">{node.name}</span><span className="tabular-nums text-muted-foreground">CPU: {formatCpu(node.requestedCpuMillicores)} / {formatCpu(node.allocatableCpuMillicores)}</span><span className="tabular-nums text-muted-foreground">Пам’ять: {formatBytes(node.requestedMemoryBytes)} / {formatBytes(node.allocatableMemoryBytes)}</span></div>)}</div></details>}
          </> : <p className="text-sm text-muted-foreground">Показники ємності ще не отримано.</p>}
        </section>
      })}
    </CardContent>
  </Card>
}

function ObservationFacts({ payload }: { payload: unknown }) {
  const details = monitoringUpdateDetails(payload)
  if (Object.values(details).every((items) => items.length === 0)) return <p className="mt-2 text-muted-foreground">Показників у цьому оновленні немає.</p>
  const section = "space-y-1 border-t border-border py-2 first:border-t-0 first:pt-0"
  return <div className="mt-2 min-w-72 text-xs text-foreground">
    {details.groups.length > 0 && <section className={section}><h4 className="font-semibold">Групи лабораторій</h4>{details.groups.map((group, index) => <p key={index}>{group.name || "Без назви"}{group.phase && ` · ${phaseLabel(group.phase)}`}{group.vpnRegistered !== null && ` · VPN ${group.vpnRegistered ? "підключено" : "не підключено"}`}</p>)}</section>}
    {details.labs.length > 0 && <section className={section}><h4 className="font-semibold">Лабораторії та пристрої</h4>{details.labs.map((lab, index) => <div key={index} className="space-y-1"><p className="font-medium">{lab.name || "Без назви"}{lab.phase && <span className="font-normal text-muted-foreground"> · {phaseLabel(lab.phase)}</span>}</p>{lab.devices.map((device, deviceIndex) => <div key={deviceIndex} className="flex flex-wrap gap-x-3 pl-3"><span>{device.name || "Без назви"}</span><span>CPU: <span className="tabular-nums">{formatCpu(device.cpu)}</span></span><span>Пам’ять: {formatBytes(device.memory)}</span>{device.restarts !== null && <span>Перезапусків: {device.restarts}</span>}</div>)}</div>)}</section>}
    {details.clients.length > 0 && <section className={section}><h4 className="font-semibold">VPN-клієнти</h4>{details.clients.map((client, index) => <div key={index} className="flex flex-wrap gap-x-3"><span className="font-medium">{client.name || "Без назви"}</span>{client.ip && <span>{client.ip}</span>}{client.received !== null && <span>Отримано: {formatBytes(client.received)}</span>}{client.sent !== null && <span>Передано: {formatBytes(client.sent)}</span>}</div>)}</section>}
    {details.rules.length > 0 && <section className={section}><h4 className="font-semibold">Правила доступу</h4>{details.rules.map((rule, index) => <div key={index} className="flex flex-wrap gap-x-3"><span>{rule.client || "Клієнт"} → {rule.lab || "лабораторія"}</span><span>{rule.action === "LAB_GROUP_ACCESS_ACTION_DENY" ? "Заборонено" : rule.action === "LAB_GROUP_ACCESS_ACTION_ALLOW" ? "Дозволено" : "Стан невідомий"}</span>{rule.packets !== null && rule.bytes !== null && <span>{rule.packets} пакетів, {formatBytes(rule.bytes)}</span>}</div>)}</section>}
    {details.deleted.length > 0 && <section className={section}><h4 className="font-semibold">Видалені ресурси</h4>{details.deleted.map((item, index) => <p key={index}><span>Видалено: {item.name || "без назви"}</span>{item.kind && <span className="text-muted-foreground"> ({resourceKindLabel(item.kind)})</span>}</p>)}</section>}
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
              <thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-2 pr-4 font-medium">Джерело</th><th className="py-2 pr-4 font-medium">Спостереження</th><th className="py-2 font-medium">Дані</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => <tr key={row.id}>
                  <td className="py-2 pr-4"><span className="font-medium">{row.labGroupName || row.agentId}</span>{row.eventId && <span className="block text-xs text-muted-foreground">{row.eventId}</span>}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">{new Date(row.observedAt).toLocaleString("uk-UA")}{row.snapshot === false && <span className="block text-xs">Часткове оновлення</span>}</td>
                  <td className="py-2"><details><summary className="cursor-pointer text-primary">Переглянути показники</summary><ObservationFacts payload={row.payload} /></details></td>
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
      setError("Не вдалося завантажити стан інфраструктури. Спробуйте ще раз.")
    }
    if (nextLabs.status === "fulfilled") setLabs(nextLabs.value ?? [])
    else setLabsError("Не вдалося завантажити спостереження лабораторій.")
    if (nextCapacity.status === "fulfilled") setCapacity(nextCapacity.value ?? [])
    else setCapacityError("Не вдалося завантажити ресурси кластера.")
    setLoading(false)
  }, [])

  useEffect(() => { if (allowed) queueMicrotask(() => void load()) }, [allowed, load])

  return <RequirePermission perm="infrastructure.read" fallback={<p className="text-sm text-muted-foreground">Немає доступу до інфраструктури.</p>}>
    <div className="flex min-h-full flex-col gap-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-foreground">Лабораторії</h2><p className="mt-1 text-sm text-muted-foreground">Стан агентів і останні спостереження ресурсів платформи.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Оновити</Button></div>
      {error && <p role="alert" className="rounded-md bg-[var(--ib-danger-bg)] p-3 text-sm text-[var(--ib-danger)]">{error}</p>}
      {loading && !status ? <LoadingArea className="flex-1" label="Завантаження…" /> : status && <>
        <Card><CardHeader><CardTitle className="text-base">Підключення</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><StateBadge good={status.Available && status.Healthy}>{status.Available ? status.Healthy ? "Доступна" : "Потребує уваги" : "Не підключена"}</StateBadge><span className="text-sm text-muted-foreground">Режим: {modeLabel(status.mode)}</span></div>
          {warningLabel(status) && <p role="alert" className="text-sm text-[var(--ib-warn)]">{warningLabel(status)}</p>}
          {status.agents.length === 0 ? <p className="text-sm text-muted-foreground">Агентів не налаштовано. Динамічні лабораторії недоступні.</p> : <ul className="divide-y divide-border">{status.agents.map((agent) => <li key={agent.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="font-medium">{agent.name || agent.key}</span><StateBadge good={agent.healthy}>{agent.healthy ? "Працює" : "Недоступний"}</StateBadge></li>)}</ul>}
        </CardContent></Card>
        <Observations title="Останні оновлення лабораторій" rows={labs} empty="Немає спостережень лабораторій." loadError={labsError} />
        <CapacityPanel rows={capacity} agents={status.agents} loadError={capacityError} />
      </>}
    </div>
  </RequirePermission>
}
