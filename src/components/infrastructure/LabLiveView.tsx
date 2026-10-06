"use client"

import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Switch } from "@/components/ui/switch"
import { ImageWarningIcon, QueueBadge } from "@/components/infrastructure/LabIndicators"
import type { LabDevice, LabLive } from "@/api/infrastructure"
import { formatBytes } from "@/lib/infrastructureMonitoring"
import { formatListDateTime } from "@/lib/locale"
import { t } from "@/i18n/t"

const PHASES = ["Pending", "Provisioning", "Ready", "Failed", "Queued"] as const
const POD_STATES = ["Queued", "Starting", "Started", "Failed"] as const
const DEVICE_TYPES = ["container", "unmanaged-switch", "hub", "vpn", "internet"] as const
const FAILURE_REASONS = ["ImagePull", "CrashLoop", "Unschedulable", "StartupTimeout", "DoesNotFit"] as const

const known = (list: readonly string[], value: string) => list.includes(value) ? value : "unknown"

const PHASE_STYLE: Record<string, string> = {
  Ready: "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]",
  Failed: "bg-[var(--ib-danger-bg)] text-[var(--ib-danger)]",
  unknown: "bg-secondary/40 text-muted-foreground",
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${className ?? "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]"}`}>{children}</span>
}

function podStateStyle(state: string): string {
  return state === "Started" ? PHASE_STYLE.Ready : state === "Failed" ? PHASE_STYLE.Failed : state === "unknown" ? PHASE_STYLE.unknown : "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]"
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm text-foreground">{children}</dd></div>
}

function never(value: string | null | undefined): string {
  return value ? formatListDateTime(value) : t("admin.labs.detail.never")
}

function DeviceRow({ device, canWrite, onReset, onRescue }: { device: LabDevice; canWrite: boolean; onReset: (device: string) => void; onRescue: (device: string, enable: boolean) => void }) {
  const scheduling = device.Scheduling
  const snapshot = device.Snapshot
  const state = scheduling ? known(POD_STATES, scheduling.State) : null
  const label = device.LogicalName || device.Name
  return <li className="space-y-3 rounded-lg border border-border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="break-all font-medium text-foreground">{label}</span>
        {device.Type && <Chip className="bg-secondary/40 text-muted-foreground">{t(`admin.labs.detail.deviceType.${known(DEVICE_TYPES, device.Type)}`)}</Chip>}
        <Chip className={device.Ready ? PHASE_STYLE.Ready : undefined}>{t(device.Ready ? "admin.labs.detail.device.ready" : "admin.labs.detail.device.notReady")}</Chip>
        {state && <Chip className={podStateStyle(state)}>{t(`admin.labs.detail.pod.${state}`)}</Chip>}
        {snapshot?.Rescue && <Chip>{t("admin.labs.detail.rescue.active")}</Chip>}
      </div>
      {canWrite && snapshot && <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <Switch checked={snapshot.Rescue} onCheckedChange={(enable) => onRescue(device.Name, enable)} aria-label={`${t("admin.labs.detail.rescue.toggle")}: ${label}`} />
          {t("admin.labs.detail.rescue.toggle")}
        </label>
        <HoverTooltip text={t("admin.labs.detail.reset")}>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[var(--ib-danger)] hover:bg-[var(--ib-danger-bg)] hover:text-[var(--ib-danger)]" aria-label={`${t("admin.labs.detail.reset")}: ${label}`} onClick={() => onReset(device.Name)}>
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          </Button>
        </HoverTooltip>
      </div>}
    </div>
    {device.Reason && <p className="break-words text-sm text-muted-foreground">{t("admin.labs.detail.device.reason", { reason: device.Reason })}</p>}
    {scheduling?.Failure && <div role="alert" className="space-y-1 rounded-md bg-[var(--ib-danger-bg)] px-3 py-2 text-sm text-[var(--ib-danger)]">
      <p className="font-medium">{t(`admin.labs.detail.failure.${known(FAILURE_REASONS, scheduling.Failure.Reason)}`)}</p>
      {scheduling.Failure.Message && <p className="break-words">{scheduling.Failure.Message}</p>}
      <p className="text-xs">{t("admin.labs.detail.failure.meta", { restarts: scheduling.Failure.RestartCount, at: formatListDateTime(scheduling.Failure.At) })}</p>
    </div>}
    {scheduling && <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Fact label={t("admin.labs.detail.queuedAt")}>{formatListDateTime(scheduling.QueuedAt)}</Fact>
      <Fact label={t("admin.labs.detail.dispatchedAt")}>{formatListDateTime(scheduling.DispatchedAt)}</Fact>
      <Fact label={t("admin.labs.detail.startedAt")}>{formatListDateTime(scheduling.StartedAt)}</Fact>
    </dl>}
    {snapshot && <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Fact label={t("admin.labs.detail.snapshot.last")}>{never(snapshot.LastSnapshotAt)}</Fact>
      <Fact label={t("admin.labs.detail.snapshot.restored")}>{never(snapshot.RestoredAt)}</Fact>
      <Fact label={t("admin.labs.detail.snapshot.size")}>{formatBytes(snapshot.SizeBytes)}</Fact>
    </dl>}
    {snapshot?.Warning && <p className="break-words text-sm text-[var(--ib-warn)]">{t("admin.labs.detail.snapshot.warning", { warning: snapshot.Warning })}</p>}
  </li>
}

/** One lab down to its devices: phase, queue, image warnings, and per device the scheduler state, failure and snapshots. */
export function LabLiveView({ live, unavailable = false, canWrite, onReset, onRescue }: {
  live: LabLive | null
  unavailable?: boolean
  canWrite: boolean
  onReset: (device: string) => void
  onRescue: (device: string, enable: boolean) => void
}) {
  if (!live) return <EmptyState compact message={t(unavailable ? "admin.labs.detail.unavailable" : "admin.labs.detail.noLive")} />
  const phase = known(PHASES, live.Phase)
  const warning = [live.ImageWarning, live.GroupImageWarning].filter(Boolean).join(", ")
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Chip className={PHASE_STYLE[phase] ?? undefined}>{t(`admin.labs.detail.phase.${phase}`)}</Chip>
      {live.Queue && live.Queue.Position > 0 && <QueueBadge position={live.Queue.Position} length={live.Queue.Length} reason={live.Queue.Reason} />}
      {live.Queue && live.Queue.Pods > 0 && <span className="text-xs text-muted-foreground">{t("admin.labs.detail.queue.pods", { started: live.Queue.Pods - live.Queue.Pending, pods: live.Queue.Pods })}</span>}
      {live.Queue?.Message && <span className="break-words text-xs text-muted-foreground">{live.Queue.Message}</span>}
      {warning && <ImageWarningIcon detail={warning} />}
    </div>
    {live.Devices.length === 0 ? <EmptyState compact message={t("admin.labs.detail.noDevices")} />
      : <ul className="space-y-2">{live.Devices.map((device) => <DeviceRow key={device.Name} device={device} canWrite={canWrite} onReset={onReset} onRescue={onRescue} />)}</ul>}
  </div>
}
