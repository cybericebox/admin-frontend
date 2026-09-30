"use client"

import type { ReactNode } from "react"
import type { LabResources } from "@/api/infrastructure"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { t } from "@/i18n/t"

/** One resource of a lab: the live usage, else the requested amount marked as such, else a dash. */
export function ResourceCell({ resources, kind }: { resources?: LabResources; kind: "cpu" | "memory" }) {
  if (!resources?.Known) return <span className="text-muted-foreground">—</span>
  const live = resources.UsageAvailable
  const value = kind === "cpu"
    ? formatCpu(live ? resources.CPUMillicores : resources.RequestedCPUMillicores)
    : formatBytes(live ? resources.MemoryBytes : resources.RequestedMemoryBytes)
  const note: ReactNode = live ? null : <span className="ml-1 text-xs text-muted-foreground">{t("admin.labs.resources.requested")}</span>
  return <span className="whitespace-nowrap tabular-nums">{value}{note}</span>
}
