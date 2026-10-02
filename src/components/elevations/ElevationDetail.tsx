"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { decideElevation, ELEVATION_WRITE_PERM, findElevation, type ElevationRequest } from "@/api/elevations"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { NotFoundScreen } from "@/components/NotFoundScreen"
import { NumberInput } from "@/components/ui/number-input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ApiError } from "@/api/client"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { useRole } from "@/lib/useRole"
import { StatusBadge } from "./ElevationsPage"

const MIB = 1024 ** 2
type Decision = "approve" | "reject"
type Edit = { cpu: string; memory: string }

/** The values a device would be approved with, and whether they are valid: positive, never above the request. */
function editState(device: ElevationRequest["Requested"][number], edit: Edit | undefined) {
  const cpu = edit ? Number(edit.cpu) : device.CPUMillicores
  const mib = edit ? Number(edit.memory) : Math.round(device.MemoryBytes / MIB)
  const requestedMib = Math.round(device.MemoryBytes / MIB)
  const changed = cpu !== device.CPUMillicores || mib !== requestedMib
  return {
    cpuInvalid: !(cpu > 0) || cpu > device.CPUMillicores,
    memoryInvalid: !(mib > 0) || mib > requestedMib,
    changed,
    value: { DeviceID: device.DeviceID, CPUMillicores: cpu, MemoryBytes: changed && mib !== requestedMib ? mib * MIB : device.MemoryBytes },
  }
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm text-foreground">{children}</dd></div>
}

export function ElevationDetail({ id }: { id: string }) {
  const { can } = useRole()
  const canReview = can(ELEVATION_WRITE_PERM)
  const [state, setState] = useState<{ id: string; item: ElevationRequest | null; error: unknown }>({ id: "", item: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [edits, setEdits] = useState<Record<string, Edit>>({})

  useEffect(() => {
    if (!id) return
    let cancelled = false
    findElevation(id)
      .then((item) => { if (!cancelled) setState({ id, item, error: item ? null : new ApiError(404, "not found") }) })
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

  const states = item.Requested.map((device) => editState(device, edits[device.DeviceID]))
  const editing = pending && canReview
  const invalid = states.some((state) => state.cpuInvalid || state.memoryInvalid)
  const reduced = states.some((state) => state.changed)
  const setEdit = (device: ElevationRequest["Requested"][number], field: keyof Edit, value: string) => setEdits((current) => {
    const edit: Edit = current[device.DeviceID] ?? { cpu: String(device.CPUMillicores), memory: String(Math.round(device.MemoryBytes / MIB)) }
    return { ...current, [device.DeviceID]: { ...edit, [field]: value } }
  })

  function open(next: Decision) { setNote(""); setError(""); setDecision(next) }

  async function confirm() {
    if (!decision || !item) return
    setBusy(true)
    setError("")
    try {
      const saved = await decideElevation(item.ID, {
        Approve: decision === "approve", Note: note.trim(),
        // Values go out only when something was lowered; otherwise the request is approved as it is.
        ...(decision === "approve" && reduced ? { Devices: states.map((state) => state.value) } : {}),
      })
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
        <Button type="button" disabled={invalid} onClick={() => open("approve")}>{t("admin.elevations.approve.action")}</Button>
      </div>}
    </div>
    {pending && !canReview && <p role="status" className="text-sm text-muted-foreground">{t("admin.elevations.noReview")}</p>}

    <Card className="space-y-4 p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
        <Fact label={t("admin.elevations.fact.author")}>{item.RequestedByName || "—"}</Fact>
        <Fact label={t("admin.elevations.fact.requested")}>{formatDateTime(item.RequestedAt)}</Fact>
        {!pending && <Fact label={t("admin.elevations.fact.reviewer")}>{item.DecidedByName || "—"}</Fact>}
        {!pending && <Fact label={t("admin.elevations.fact.reviewed")}>{formatDateTime(item.DecidedAt)}</Fact>}
      </dl>
      <div><p className="text-xs text-muted-foreground">{t("admin.elevations.reason")}</p><p data-testid="elevation-reason" className="whitespace-pre-wrap break-words text-sm text-foreground">{item.Reason || "—"}</p></div>
      {item.DecisionNote && <div><p className="text-xs text-muted-foreground">{t("admin.elevations.note")}</p><p className="whitespace-pre-wrap break-words text-sm text-foreground">{item.DecisionNote}</p></div>}
    </Card>

    <Card className="overflow-x-auto">
      <table data-testid="elevation-devices" className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="px-4 py-2 font-medium">{t("admin.elevations.col.device")}</th>
          <th className="px-4 py-2 font-medium">{t("admin.elevations.col.cpu")}</th>
          <th className="px-4 py-2 font-medium">{t("admin.elevations.col.memory")}</th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {item.Requested.map((device, index) => <tr key={device.DeviceID}>
            <td className="px-4 py-2 font-medium">{device.Name || device.DeviceID}</td>
            {editing ? <>
              <td className="px-4 py-2"><div className="flex items-center gap-2">
                <NumberInput value={edits[device.DeviceID]?.cpu ?? String(device.CPUMillicores)} onChange={(value) => setEdit(device, "cpu", value)}
                  aria-label={t("admin.elevations.edit.cpu", { name: device.Name || device.DeviceID })} aria-invalid={states[index].cpuInvalid || undefined} className="h-8 w-24" inputMode="numeric" />
                <span className="text-xs text-muted-foreground">{t("admin.elevations.edit.cpuUnit", { requested: formatCpu(device.CPUMillicores) })}</span>
              </div></td>
              <td className="px-4 py-2"><div className="flex items-center gap-2">
                <NumberInput value={edits[device.DeviceID]?.memory ?? String(Math.round(device.MemoryBytes / MIB))} onChange={(value) => setEdit(device, "memory", value)}
                  aria-label={t("admin.elevations.edit.memory", { name: device.Name || device.DeviceID })} aria-invalid={states[index].memoryInvalid || undefined} className="h-8 w-24" inputMode="numeric" />
                <span className="text-xs text-muted-foreground">{t("admin.elevations.edit.memoryUnit", { requested: formatBytes(device.MemoryBytes) })}</span>
              </div></td>
            </> : <>
              <td className="px-4 py-2">{formatCpu(device.CPUMillicores)}</td>
              <td className="px-4 py-2">{formatBytes(device.MemoryBytes)}</td>
            </>}
          </tr>)}
        </tbody>
      </table>
      {editing && <p className={invalid ? "border-t border-border px-4 py-2 text-xs text-[var(--ib-warn)]" : "border-t border-border px-4 py-2 text-xs text-muted-foreground"} role={invalid ? "alert" : undefined} data-testid="elevation-edit-hint">
        {t(invalid ? "admin.elevations.edit.invalid" : "admin.elevations.edit.hint")}
      </p>}
      {item.Approved.length > 0 && <p data-testid="elevation-approved" className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {t("admin.elevations.approvedValues")} {item.Approved.map((device) => `${device.Name || device.DeviceID}: ${formatCpu(device.CPUMillicores)} · ${formatBytes(device.MemoryBytes)}`).join("; ")}
      </p>}
    </Card>

    <ConfirmDialog open={decision !== null} busy={busy} error={error} tone={decision === "reject" ? "danger" : "default"}
      onCancel={() => setDecision(null)}
      title={decision ? t(`admin.elevations.${decision}.title`, { name: item.ExerciseName }) : ""}
      description={decision ? t(`admin.elevations.${decision}.body`) : undefined}
      confirmLabel={decision ? t(`admin.elevations.${decision}.confirm`) : ""}
      onConfirm={() => void confirm()}>
      {decision === "approve" && reduced && <p data-testid="elevation-reduced" className="text-sm text-foreground">{t("admin.elevations.approve.reduced")}</p>}
      <div className="space-y-1.5">
        <label htmlFor="elevation-note" className="text-sm font-medium">{t("admin.elevations.noteLabel")}</label>
        <Textarea id="elevation-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
    </ConfirmDialog>
  </div>
}
