"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import type { CapacityObservation, InfrastructureAgent } from "@/api/infrastructure"
import { capacityMetrics, formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { formatDateTime } from "@/lib/locale"
import { t } from "@/i18n/t"

function ResourceBar({ label, requested, allocatable, format }: { label: string; requested: number | null; allocatable: number | null; format: (value: number | null) => string }) {
  const hasScale = requested !== null && allocatable !== null && allocatable > 0
  const overcommitted = hasScale && requested > allocatable
  return <div className="space-y-1.5">
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-medium text-foreground">{label}</span><span className="tabular-nums text-muted-foreground">{format(requested)} / {format(allocatable)}</span></div>
    {hasScale ? <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuenow={Math.min(requested, allocatable)} aria-valuemax={allocatable} className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${overcommitted ? "bg-[var(--ib-warn)]" : "bg-primary"}`} style={{ width: `${Math.min(100, requested / allocatable * 100)}%` }} /></div> : <p className="text-xs text-muted-foreground">{t("admin.labs.noScale")}</p>}
    {overcommitted && <p className="text-xs text-[var(--ib-warn)]">{t("admin.labs.overcommitted")}</p>}
  </div>
}

export function CapacityPanel({ rows, agents, loadError, errorCause, onRetry }: { rows: CapacityObservation[]; agents: InfrastructureAgent[]; loadError: string; errorCause?: unknown; onRetry: () => void }) {
  return <Card id="capacity" className="scroll-mt-4">
    <CardHeader><CardTitle className="text-base">{t("admin.labs.capacity.title")}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      {loadError ? <LoadError message={loadError} error={errorCause} compact onRetry={onRetry} /> : rows.length === 0 ? <EmptyState message={t("admin.labs.capacity.empty")} compact /> : rows.map((row) => {
        const agent = agents.find((item) => item.ID === row.AgentID || item.Key === row.AgentID)
        const name = agent?.Name || agent?.Key || row.AgentID
        const metrics = capacityMetrics(row.Payload)
        return <section key={row.ID} className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">{name}</h3><time dateTime={row.ObservedAt} className="text-xs text-muted-foreground">{formatDateTime(row.ObservedAt)}</time></div>
          {metrics ? <>
            <div className="grid gap-4 md:grid-cols-2">
              <ResourceBar label={t("admin.labs.capacity.cpuLabel", { name })} requested={metrics.requestedCpuMillicores} allocatable={metrics.allocatableCpuMillicores} format={formatCpu} />
              <ResourceBar label={t("admin.labs.capacity.memoryLabel", { name })} requested={metrics.requestedMemoryBytes} allocatable={metrics.allocatableMemoryBytes} format={formatBytes} />
            </div>
            {metrics.nodes.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-primary">{t("admin.labs.capacity.nodes", { count: metrics.nodes.length })}</summary><div className="mt-3 space-y-3 pl-3">{metrics.nodes.map((node) => <div key={node.name} className="grid gap-2 md:grid-cols-[minmax(8rem,1fr)_1fr_1fr]"><span className="font-medium">{node.name}</span><span className="tabular-nums text-muted-foreground">{t("admin.labs.cpuUsage", { used: formatCpu(node.requestedCpuMillicores), total: formatCpu(node.allocatableCpuMillicores) })}</span><span className="tabular-nums text-muted-foreground">{t("admin.labs.memoryUsage", { used: formatBytes(node.requestedMemoryBytes), total: formatBytes(node.allocatableMemoryBytes) })}</span></div>)}</div></details>}
          </> : <p className="text-sm text-muted-foreground">{t("admin.labs.capacity.pending")}</p>}
        </section>
      })}
    </CardContent>
  </Card>
}
