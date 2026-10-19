"use client"

import type { PartPhase, ReservationPart } from "@/api/resourceCalendar"
import { t } from "@/i18n/t"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { Badge, formatWindow, type Tone } from "./resourceView"

const PHASE_TONE: Record<Exclude<PartPhase, "">, Tone> = { Pending: "muted", Active: "ok", Ending: "warn", Ended: "muted" }

/** The phase of a part as text and tone; before the agent's first report it says the state is not known yet. */
export function partPhase(phase: PartPhase): { label: string; tone: Tone } {
  return phase ? { label: t(`admin.resources.parts.phase.${phase}`), tone: PHASE_TONE[phase] } : { label: t("admin.resources.parts.phase.none"), tone: "muted" }
}

/**
 * «Розподіл по кластерах»: the reservation as the agents hold it, one part per agent — its period, what runs in it
 * against what it reserves, its phase and whether the agent has the last change.
 */
export function ReservationParts({ parts }: { parts: ReservationPart[] | null | undefined }) {
  const shown = (parts ?? []).filter((part) => !part.Retiring)
  if (shown.length === 0) return null
  return <section aria-labelledby="reservation-parts-title" className="space-y-2" data-testid="reservation-parts">
    <h3 id="reservation-parts-title" className="text-sm font-medium">{t("admin.resources.parts.title")}</h3>
    <ul className="space-y-2">
      {shown.map((part) => {
        const phase = partPhase(part.Phase)
        return <li key={part.PartID} className="space-y-1 rounded-md border border-border p-3 text-sm" data-testid={`part-${part.PartID}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{part.AgentName || part.AgentID}</span>
            <Badge tone={phase.tone}>{phase.label}</Badge>
            {part.Synced && !part.SyncError ? <Badge tone="ok">{t("admin.resources.parts.synced")}</Badge> : null}
            {part.ShrinkHeld && <Badge tone="warn">{t("admin.resources.alarms.kind.cluster_shrink_held")}</Badge>}
          </div>
          <p className="text-muted-foreground tabular-nums">{formatWindow(part.From, part.To)}</p>
          <p className="tabular-nums">{t("admin.resources.parts.used", {
            cpu: formatCpu(part.Used.CPUMillicores), memory: formatBytes(part.Used.MemoryBytes),
            cpuTotal: formatCpu(part.Amount.CPUMillicores), memoryTotal: formatBytes(part.Amount.MemoryBytes),
          })}</p>
          {part.SyncError && <p role="alert" className="text-xs text-destructive">{t("admin.resources.parts.syncError", { error: part.SyncError })}</p>}
        </li>
      })}
    </ul>
  </section>
}
