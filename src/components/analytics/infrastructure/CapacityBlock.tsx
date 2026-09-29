"use client"

import { AnalyticsBlock, AnalyticsChart, CsvExportButton, lineOption } from "@/components/analytics"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { t } from "@/i18n/t"
import type { CapacityPoint, InfrastructureResource } from "./types"

const P = "admin.platformAnalytics.infrastructure."
const GIB = 1024 ** 3

/** CPU (cores) and memory (GiB) of the cluster: what the agents offer against what labs reserved. */
export function CapacityBlock({ res }: { res: InfrastructureResource }) {
  const points: CapacityPoint[] = res.data?.Capacity ?? []
  const empty = !res.data || points.length === 0
  const minutes = Math.max(1, Math.round((res.data?.CapacityStepSeconds ?? 60) / 60))
  const chart = (kind: "cpu" | "memory") => {
    const cpu = kind === "cpu"
    const scale = cpu ? 1000 : GIB
    const pick = (p: CapacityPoint, allocatable: boolean) => (cpu ? (allocatable ? p.AllocatableCPUMillicores : p.RequestedCPUMillicores) : (allocatable ? p.AllocatableMemoryBytes : p.RequestedMemoryBytes)) / scale
    return <div className="min-w-0">
      <h3 className="mb-1 text-sm font-medium text-foreground">{t(P + `capacity.${kind}`)}</h3>
      <AnalyticsChart height={260} ariaLabel={t(P + (cpu ? "capacity.cpuAria" : "capacity.memoryAria"))} loading={res.loading} error={res.error} empty={empty}
        emptyMessage={t(P + "capacity.empty")} errorMessage={t(P + "capacity.error")} onRetry={res.reload}
        option={(theme) => lineOption([
          { name: t(P + "capacity.allocatable"), data: points.map((p) => [p.At, pick(p, true)]) },
          { name: t(P + "capacity.requested"), area: true, data: points.map((p) => [p.At, pick(p, false)]) },
        ], { theme, valueFormatter: (value) => (cpu ? formatCpu(value * 1000) : formatBytes(value * GIB)) })} />
    </div>
  }
  return <AnalyticsBlock title={t(P + "capacity.title")} hint={t(P + "capacity.hint", { minutes })}
    actions={<CsvExportButton section="infrastructure" table="capacity" disabled={empty} />}>
    <div className="grid gap-6 lg:grid-cols-2">{chart("cpu")}{chart("memory")}</div>
  </AnalyticsBlock>
}
