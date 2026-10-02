"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { approveElevation, ELEVATION_PERM, getElevation, rejectElevation, type ElevationRequest } from "@/api/elevations"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { NotFoundScreen } from "@/components/NotFoundScreen"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ApiError } from "@/api/client"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { useRole } from "@/lib/useRole"
import { cn } from "@/utils/cn"
import { StatusBadge } from "./ElevationsPage"
import { CEILING, FRAME, deviceLevel, hasCeilingDevice } from "./elevationView"

const MIB = 1024 ** 2
type Decision = "approve" | "reject"

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm text-foreground">{children}</dd></div>
}

export function ElevationDetail({ id }: { id: string }) {
  const { can } = useRole()
  const canReview = can(ELEVATION_PERM)
  const [state, setState] = useState<{ id: string; item: ElevationRequest | null; error: unknown }>({ id: "", item: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getElevation(id)
      .then((item) => { if (!cancelled) setState({ id, item, error: null }) })
      .catch((cause) => { if (!cancelled) setState({ id, item: null, error: cause }) })
    return () => { cancelled = true }
  }, [id, attempt])

  const settled = state.id === id
  const item = settled ? state.item : null
  const retry = () => { setState({ id: "", item: null, error: null }); setAttempt((value) => value + 1) }

  if (!id || (settled && state.error instanceof ApiError && state.error.status === 404)) return <NotFoundScreen block title={t("admin.elevations.notFound")} />
  if (!settled) return <LoadingArea className="h-full" label={t("admin.loading")} />
  if (!item) return <LoadError message={t("admin.elevations.error.load")} error={state.error} onRetry={retry} className="h-full" />

  const pending = item.Status === "pending"
  const ceiling = hasCeilingDevice(item.Devices)

  function open(next: Decision) { setNote(""); setError(""); setDecision(next) }

  async function confirm() {
    if (!decision || !item) return
    setBusy(true)
    setError("")
    try {
      const saved = await (decision === "approve" ? approveElevation : rejectElevation)(item.ID, note.trim())
      setState({ id, item: saved, error: null })
      setDecision(null)
      toast.success(t(`admin.elevations.${decision}.done`))
    } catch (cause) {
      setError(localizedError(cause))
    } finally {
      setBusy(false)
    }
  }

  return <div className="flex min-h-full flex-col gap-5">
    <Link href="/elevations" className="w-fit text-sm text-primary hover:underline">← {t("admin.elevations.back")}</Link>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h2 className="truncate text-xl font-semibold text-foreground">{item.ExerciseName}</h2>
        <StatusBadge status={item.Status} />
      </div>
      {pending && canReview && <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => open("reject")}>{t("admin.elevations.reject.action")}</Button>
        <Button type="button" disabled={ceiling} onClick={() => open("approve")}>{t("admin.elevations.approve.action")}</Button>
      </div>}
    </div>
    {pending && !canReview && <p role="status" className="text-sm text-muted-foreground">{t("admin.elevations.noReview")}</p>}
    {pending && ceiling && <p role="alert" data-ceiling className="text-sm text-[var(--ib-warn)]">{t("admin.elevations.ceiling", { cpu: formatCpu(CEILING.cpu), memory: formatBytes(CEILING.memory * MIB) })}</p>}

    <Card className="space-y-4 p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
        <Fact label={t("admin.elevations.fact.author")}>{item.RequestedByName || "—"}</Fact>
        <Fact label={t("admin.elevations.fact.requested")}>{formatDateTime(item.RequestedAt)}</Fact>
        {!pending && <Fact label={t("admin.elevations.fact.reviewer")}>{item.ReviewedByName || "—"}</Fact>}
        {!pending && <Fact label={t("admin.elevations.fact.reviewed")}>{formatDateTime(item.ReviewedAt)}</Fact>}
      </dl>
      <div><p className="text-xs text-muted-foreground">{t("admin.elevations.reason")}</p><p data-testid="elevation-reason" className="whitespace-pre-wrap break-words text-sm text-foreground">{item.Reason || "—"}</p></div>
      {item.ReviewNote && <div><p className="text-xs text-muted-foreground">{t("admin.elevations.note")}</p><p className="whitespace-pre-wrap break-words text-sm text-foreground">{item.ReviewNote}</p></div>}
    </Card>

    <Card className="overflow-x-auto">
      <table data-testid="elevation-devices" className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="px-4 py-2 font-medium">{t("admin.elevations.col.device")}</th>
          <th className="px-4 py-2 font-medium">{t("admin.elevations.col.variant")}</th>
          <th className="px-4 py-2 font-medium">{t("admin.elevations.col.cpu")}</th>
          <th className="px-4 py-2 font-medium">{t("admin.elevations.col.memory")}</th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {item.Devices.map((device) => <tr key={device.DeviceID} data-level={deviceLevel(device)}>
            <td className="px-4 py-2 font-medium">{device.DeviceName || device.DeviceID}</td>
            <td className="px-4 py-2 text-muted-foreground">{device.Variant}</td>
            <td className={cn("px-4 py-2", deviceLevel(device) === "ceiling" && "text-[var(--ib-warn)]")}>{device.CPU}</td>
            <td className={cn("px-4 py-2", deviceLevel(device) === "ceiling" && "text-[var(--ib-warn)]")}>{device.Memory}</td>
          </tr>)}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{t("admin.elevations.frameNote", { cpu: formatCpu(FRAME.cpu), memory: formatBytes(FRAME.memory * MIB), maxCpu: formatCpu(CEILING.cpu), maxMemory: formatBytes(CEILING.memory * MIB) })}</p>
    </Card>

    <ConfirmDialog open={decision !== null} busy={busy} error={error} tone={decision === "reject" ? "danger" : "default"}
      onCancel={() => setDecision(null)}
      title={decision ? t(`admin.elevations.${decision}.title`, { name: item.ExerciseName }) : ""}
      description={decision ? t(`admin.elevations.${decision}.body`) : undefined}
      confirmLabel={decision ? t(`admin.elevations.${decision}.confirm`) : ""}
      onConfirm={() => void confirm()}>
      <div className="space-y-1.5">
        <label htmlFor="elevation-note" className="text-sm font-medium">{t("admin.elevations.noteLabel")}</label>
        <Textarea id="elevation-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
    </ConfirmDialog>
  </div>
}
