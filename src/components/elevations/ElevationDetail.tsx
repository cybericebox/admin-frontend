"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { decideElevation, ELEVATION_WRITE_PERM, getElevation, getResourcePresets, type ElevationRequest, type ResourcePreset } from "@/api/elevations"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { NotFoundScreen } from "@/components/NotFoundScreen"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ApiError } from "@/api/client"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { useRole } from "@/lib/useRole"
import { StatusBadge } from "./ElevationsPage"

type Decision = "approve" | "reject"
type Device = ElevationRequest["Requested"][number]
const PRESET_IDS = ["micro", "small", "medium", "large", "xlarge", "huge"]

/** Presets a device may be approved with: the requested block or any smaller offered one. */
function allowedPresets(device: Device, presets: ResourcePreset[]) {
  return presets.filter((preset) => preset.Blocks <= device.Blocks)
}

function presetName(blocks: number, presets: ResourcePreset[]): string {
  const preset = presets.find((item) => item.Blocks === blocks)
  return preset && PRESET_IDS.includes(preset.ID) ? t(`admin.res.preset.${preset.ID}`) : t("admin.elevations.blocksCount", { count: blocks })
}

function sizeText(device: { CPUMillicores: number; MemoryBytes: number }) {
  return `${formatCpu(device.CPUMillicores)} · ${formatBytes(device.MemoryBytes)}`
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
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [presets, setPresets] = useState<ResourcePreset[]>([])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getElevation(id)
      .then((item) => { if (!cancelled) setState({ id, item, error: null }) })
      .catch((cause) => { if (!cancelled) setState({ id, item: null, error: cause }) })
    return () => { cancelled = true }
  }, [id, attempt])

  useEffect(() => {
    if (!canReview) return
    let cancelled = false
    getResourcePresets().then((list) => { if (!cancelled) setPresets(list) }).catch(() => {})
    return () => { cancelled = true }
  }, [canReview])

  const settled = state.id === id
  const item = settled ? state.item : null
  const retry = () => { setState({ id: "", item: null, error: null }); setAttempt((value) => value + 1) }

  if (!id || (settled && state.error instanceof ApiError && state.error.status === 404)) return <NotFoundScreen block title={t("admin.elevations.notFound")} />
  if (!settled) return <LoadingArea className="h-full" label={t("admin.loading")} />
  if (!item) return <LoadError message={t("admin.elevations.error.load")} error={state.error} onRetry={retry} className="h-full" />

  const pending = item.Status === "pending"

  const editing = pending && canReview
  const approvedBlocks = (device: Device) => edits[device.DeviceID] ?? device.Blocks
  const reduced = item.Requested.some((device) => approvedBlocks(device) !== device.Blocks)
  const setEdit = (device: Device, blocks: number) => setEdits((current) => ({ ...current, [device.DeviceID]: blocks }))

  function open(next: Decision) { setNote(""); setError(""); setDecision(next) }

  async function confirm() {
    if (!decision || !item) return
    setBusy(true)
    setError("")
    try {
      const saved = await decideElevation(item.ID, {
        Approve: decision === "approve", Note: note.trim(),
        // Blocks go out only when something was lowered; otherwise the request is approved as it is.
        ...(decision === "approve" && reduced ? { Devices: item.Requested.map((device) => ({ DeviceID: device.DeviceID, Blocks: approvedBlocks(device) })) } : {}),
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
        <Button type="button" onClick={() => open("approve")}>{t("admin.elevations.approve.action")}</Button>
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
          <th className="px-4 py-2 font-medium">{t("admin.elevations.col.requested")}</th>
          <th className="px-4 py-2 font-medium">{t("admin.elevations.col.cpu")}</th>
          <th className="px-4 py-2 font-medium">{t("admin.elevations.col.memory")}</th>
          {editing && <th className="px-4 py-2 font-medium">{t("admin.elevations.col.approved")}</th>}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {item.Requested.map((device) => {
            const name = device.Name || device.DeviceID
            const options = allowedPresets(device, presets)
            return <tr key={device.DeviceID}>
              <td className="px-4 py-2 font-medium">{name}</td>
              <td className="px-4 py-2">{presetName(device.Blocks, presets)}</td>
              <td className="px-4 py-2">{formatCpu(device.CPUMillicores)}</td>
              <td className="px-4 py-2">{formatBytes(device.MemoryBytes)}</td>
              {editing && <td className="px-4 py-2">
                {options.some((preset) => preset.Blocks === device.Blocks)
                  ? <Select value={String(approvedBlocks(device))} onChange={(event) => setEdit(device, Number(event.target.value))}
                      aria-label={t("admin.elevations.edit.block", { name })} className="h-8 min-w-56">
                      {options.map((preset) => <option key={preset.ID} value={preset.Blocks}>{presetName(preset.Blocks, presets)} · {sizeText(preset)}</option>)}
                    </Select>
                  : <span className="text-xs text-muted-foreground">{presetName(device.Blocks, presets)}</span>}
              </td>}
            </tr>
          })}
        </tbody>
      </table>
      {editing && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground" data-testid="elevation-edit-hint">{t("admin.elevations.edit.hint")}</p>}
      {item.Approved.length > 0 && <p data-testid="elevation-approved" className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {t("admin.elevations.approvedValues")} {item.Approved.map((device) => `${device.Name || device.DeviceID}: ${presetName(device.Blocks, presets)} · ${sizeText(device)}`).join("; ")}
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
