import type { ComputeView, ResourceObservation } from "@/api/labLifecycle"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { t } from "@/i18n/t"
import { decimalCpu, decimalMemory } from "@/lib/labResourceObservation"
import { formatListDateTime } from "@/lib/locale"

const BLOCK = "min-h-112 sm:min-h-56"

/** Held already includes PendingStarts and GroupServices; all amounts remain producer-owned. */
export function ObservationFacts({ observation, stale = false }: { observation: ResourceObservation | null; stale?: boolean }) {
  if (!observation) return <EmptyState compact className={BLOCK} message={t("admin.resources.observation.unknown")} />
  const current = !stale && observation.ObservedAt !== null
  const unknown = !current || !observation.Complete
  const computeText = (value: ComputeView) => t("admin.labs.resources.computeValue", { cpu: decimalCpu(value.CPUMillicores), memory: decimalMemory(value.MemoryBytes) })
  const zeroHeld = observation.Held.CPUMillicores === "0" && observation.Held.MemoryBytes === "0"
  const rows = [
    { key: "held", label: t("admin.resources.observation.knownHeld"), value: unknown && zeroHeld ? t("admin.resources.observation.unknown") : computeText(observation.Held), testID: "observation-held" },
    { key: "pending", label: t("admin.resources.observation.pendingStarts"), value: computeText(observation.PendingStarts) },
    { key: "group", label: t("admin.resources.observation.groupServices"), value: computeText(observation.GroupServices) },
    { key: "quota", label: t("admin.labs.resources.snapshotQuota"), value: decimalMemory(observation.Held.SnapshotQuotaBytes) },
    { key: "storage", label: t("admin.labs.resources.physicalStorage"), value: current && observation.PhysicalStorageBytesAvailable ? decimalMemory(observation.PhysicalStorageBytes) : t("admin.resources.observation.unknown"), testID: "observation-storage" },
    { key: "at", label: t("admin.labs.resources.observedAt"), value: formatListDateTime(observation.ObservedAt) },
  ]
  return <section aria-label={t("admin.resources.observation.title")} className={`${BLOCK} space-y-3`}>
    <Badge data-testid="observation-state" tone={unknown ? "warn" : "neutral"} className="h-auto! min-h-6 whitespace-normal! py-1! leading-snug!">
      {t(unknown ? "admin.resources.observation.incomplete" : "admin.resources.observation.complete")}
    </Badge>
    {unknown && <p className="text-xs text-muted-foreground">{t("admin.resources.observation.unknownHelp")}</p>}
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map((row) => <div key={row.key} className="min-w-0"><dt className="text-xs text-muted-foreground">{row.label}</dt><dd data-testid={row.testID} className="break-words text-sm tabular-nums text-foreground">{row.value}</dd></div>)}
    </dl>
  </section>
}
