import type { ReactNode } from "react"
import type { AllocationView, ComputeView, ManagedGroupView, ManagedLabView } from "@/api/labLifecycle"
import { Badge } from "@/components/ui/badge"
import { t } from "@/i18n/t"
import { currentObservation, decimalCpu, decimalMemory } from "@/lib/labResourceObservation"
import { formatListDateTime } from "@/lib/locale"

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm text-foreground">{children}</dd></div>
}

/** The caller must establish parent currency; standalone facts default to unknown. */
export function AllocationFacts({ resources, current = false }: { resources: AllocationView; current?: boolean }) {
  const computeText = (value: ComputeView) => t("admin.labs.resources.computeValue", { cpu: decimalCpu(value.CPUMillicores), memory: decimalMemory(value.MemoryBytes) })
  const observed = current && resources.RuntimeState !== "Unknown" && resources.ObservedAt !== null && Number.isFinite(Date.parse(resources.ObservedAt))
  const unknown = t("admin.resources.observation.unknown")
  return <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <Fact label={t("admin.labs.resources.configuredRequests")}>{computeText(resources.ConfiguredRequests)}</Fact>
    <Fact label={t("admin.labs.resources.configuredLimits")}>{computeText(resources.ConfiguredLimits)}</Fact>
    <Fact label={t("admin.labs.resources.held")}>{observed || resources.AllocatedRequests.CPUMillicores !== "0" || resources.AllocatedRequests.MemoryBytes !== "0" ? computeText(resources.AllocatedRequests) : unknown}</Fact>
    <Fact label={t("admin.labs.resources.used")}>{observed && resources.UsageAvailable ? computeText(resources.Used) : unknown}</Fact>
    <Fact label={t("admin.labs.resources.released")}>{observed ? computeText(resources.ReleasedRequests) : unknown}</Fact>
    <Fact label={t("admin.labs.resources.snapshotQuota")}>{observed || resources.SnapshotQuotaBytes !== "0" ? decimalMemory(resources.SnapshotQuotaBytes) : unknown}</Fact>
    <Fact label={t("admin.labs.resources.physicalStorage")}>{observed && resources.PhysicalStorageBytesAvailable ? decimalMemory(resources.PhysicalStorageBytes) : t("admin.labs.resources.physicalUnknown")}</Fact>
    <Fact label={t("admin.labs.resources.runtime")}>{t(`admin.labs.resources.runtime.${observed ? resources.RuntimeState : "Unknown"}`)}</Fact>
    <Fact label={t("admin.labs.resources.storage")}>{t(`admin.labs.resources.storage.${!observed && resources.StorageState === "Deleted" ? "Unknown" : resources.StorageState}`)}</Fact>
    <Fact label={t("admin.labs.resources.observedAt")}>{formatListDateTime(resources.ObservedAt)}</Fact>
    <Fact label={t("admin.labs.resources.releasedAt")}>{observed ? formatListDateTime(resources.ReleasedAt) : unknown}</Fact>
  </dl>
}

export function LifecycleFacts({ lab, stale = false }: { lab: ManagedLabView; stale?: boolean }) {
  const current = !stale && currentObservation(lab)
  return <section data-lab-id={lab.ID} aria-label={t("admin.labs.lifecycle.title")} className="space-y-3 rounded-lg border border-border p-3">
    <div className="flex flex-wrap gap-2">
      {lab.ClosedAt !== null && <Badge className="h-auto! min-h-6 whitespace-normal! py-1! leading-snug!">{t("admin.labs.lifecycle.logicalClosed", { reason: t(`admin.labs.lifecycle.closeReason.${lab.CloseReason ?? "unknown"}`) })}</Badge>}
      <Badge tone={lab.ActualState === "StopFailed" ? "danger" : "neutral"}>{t(`admin.labs.lifecycle.actual.${lab.ActualState}`)}</Badge>
      <Badge className="h-auto! min-h-6 whitespace-normal! py-1! leading-snug!" tone={current ? "neutral" : "warn"}>{t(current ? "admin.labs.lifecycle.observationCurrent" : "admin.labs.lifecycle.observationUnknown")}</Badge>
    </div>
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Fact label={t("admin.labs.lifecycle.desired")}>{t(`admin.labs.lifecycle.desired.${lab.DesiredState}`)}</Fact>
      <Fact label={t("admin.labs.lifecycle.actual")}>{t(`admin.labs.lifecycle.actual.${lab.ActualState}`)}</Fact>
      {lab.SnapshotPolicy && <Fact label={t("admin.labs.lifecycle.snapshotPolicy")}>{t(`admin.labs.lifecycle.policy.${lab.SnapshotPolicy}`)}</Fact>}
      <Fact label={t("admin.labs.lifecycle.snapshot")}>{t(`admin.labs.lifecycle.snapshot.${lab.SnapshotState}`)}</Fact>
      <Fact label={t("admin.labs.lifecycle.closedAt")}>{formatListDateTime(lab.ClosedAt)}</Fact>
      <Fact label={t("admin.labs.lifecycle.stoppedAt")}>{formatListDateTime(lab.ActualStoppedAt)}</Fact>
      <Fact label={t("admin.labs.lifecycle.retentionUntil")}>{formatListDateTime(lab.RetentionUntil)}</Fact>
      <Fact label={t("admin.labs.lifecycle.observedAt")}>{formatListDateTime(lab.ObservedAt)}</Fact>
    </dl>
    <p className="text-xs text-muted-foreground">{t("admin.labs.lifecycle.snapshotHelp")}</p>
    {(lab.FailureCode || lab.FailureMessage) && <dl className="grid grid-cols-1 gap-3 rounded-md bg-[var(--ib-danger-bg)] p-3 sm:grid-cols-2">
      {lab.FailureCode && <Fact label={t("admin.labs.lifecycle.failureCode")}>{lab.FailureCode}</Fact>}
      {lab.FailureMessage && <Fact label={t("admin.labs.lifecycle.failureMessage")}>{lab.FailureMessage}</Fact>}
    </dl>}
    <AllocationFacts resources={lab.Resources} current={current} />
  </section>
}

export function GroupLifecycleFacts({ group, stale = false }: { group: ManagedGroupView; stale?: boolean }) {
  const current = !stale && currentObservation(group)
  return <section data-group-name={group.Name} aria-label={t("admin.labs.group.title")} className="space-y-3 rounded-lg border border-border p-3">
    <h3 className="font-medium text-foreground">{t("admin.labs.group.title")}</h3>
    <div className="flex flex-wrap gap-2">
      <Badge tone={group.ActualState === "StopFailed" ? "danger" : "neutral"}>{t(`admin.labs.lifecycle.actual.${group.ActualState}`)}</Badge>
      <Badge className="h-auto! min-h-6 max-w-full whitespace-normal! py-1! leading-snug!" tone={group.Ready && current ? "ok" : "warn"}>{t(group.Ready && current ? "admin.labs.group.ready" : "admin.labs.group.notReady")}</Badge>
    </div>
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Fact label={t("admin.labs.lifecycle.desired")}>{t(`admin.labs.lifecycle.desired.${group.DesiredState}`)}</Fact>
      <Fact label={t("admin.labs.lifecycle.actual")}>{t(`admin.labs.lifecycle.actual.${group.ActualState}`)}</Fact>
      <Fact label={t("admin.labs.lifecycle.observedAt")}>{formatListDateTime(group.ObservedAt)}</Fact>
    </dl>
    <p className="text-xs text-muted-foreground">{t("admin.labs.group.prepareHelp")}</p>
    {(group.FailureCode || group.FailureMessage) && <dl className="grid grid-cols-1 gap-3 rounded-md bg-[var(--ib-danger-bg)] p-3 sm:grid-cols-2">
      {group.FailureCode && <Fact label={t("admin.labs.lifecycle.failureCode")}>{group.FailureCode}</Fact>}
      {group.FailureMessage && <Fact label={t("admin.labs.lifecycle.failureMessage")}>{group.FailureMessage}</Fact>}
    </dl>}
    <AllocationFacts resources={group.Resources} current={current} />
  </section>
}
