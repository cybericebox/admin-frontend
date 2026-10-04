"use client"

import { useEffect, useState } from "react"
import { ApiError } from "@/api/client"
import { getEventSchedule } from "@/api/events/catalog"
import {
  getEventReservation, putEventReservation, type Conflict, type ReservationInput, type ReservationResult,
} from "@/api/resourceCalendar"
import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldHelp } from "@/components/ui/field-help"
import { LoadError } from "@/components/ui/load-error"
import { NumberInput } from "@/components/ui/number-input"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { localizedError } from "@/i18n/apiError"
import { tPlural } from "@/i18n/plural"
import { t } from "@/i18n/t"
import { isoToLocal, localToIso } from "@/lib/eventSchemas"
import { CODE_NO_RESERVATION, amountToText, isDoesNotFit, textToAmount, type AmountText } from "@/lib/resourceCalendar"
import { AllowConflictsDialog, Badge, formatAmount, formatWindow } from "./resourceView"

export type EditorForm = {
  teams: string
  perTeam: AmountText
  buffer: string
  dynamic: AmountText
  tailGap: string
  start: string
  end: string
}

const EMPTY_FORM: EditorForm = { teams: "", perTeam: { cpu: "", memoryMiB: "" }, buffer: "", dynamic: { cpu: "", memoryMiB: "" }, tailGap: "", start: "", end: "" }

/** The saved reservation as form text. The window end is the event end: the tail gap is added again on save. */
export function formFromResult(result: ReservationResult): EditorForm {
  const r = result.Reservation
  const end = new Date(Date.parse(r.To) - r.TailGapMinutes * 60_000).toISOString()
  return {
    teams: String(r.Teams), perTeam: amountToText(r.PerTeam), buffer: String(r.BufferPercent), dynamic: amountToText(r.Dynamic),
    tailGap: String(r.TailGapMinutes), start: isoToLocal(r.From), end: isoToLocal(end),
  }
}

const num = (text: string) => (text.trim() === "" ? undefined : Number(text))

/** The request body: only what is filled; a field left empty keeps the plan's default. Null when the form is invalid. */
export function inputFromForm(form: EditorForm, windowRequired = false): ReservationInput | "window" | null {
  const body: ReservationInput = {}
  const teams = num(form.teams)
  if (teams !== undefined) body.Teams = teams
  const perTeam = textToAmount(form.perTeam)
  if (perTeam) body.PerTeam = perTeam
  const buffer = num(form.buffer)
  if (buffer !== undefined) body.BufferPercent = buffer
  const dynamic = textToAmount(form.dynamic)
  if (dynamic) body.Dynamic = dynamic
  const tail = num(form.tailGap)
  if (tail !== undefined) body.TailGapMinutes = tail
  if (form.start || form.end || windowRequired) {
    if (!form.start || !form.end || Date.parse(localToIso(form.end)) <= Date.parse(localToIso(form.start))) return "window"
    body.WindowStart = localToIso(form.start)
    body.WindowEnd = localToIso(form.end)
  }
  return body
}

/** The event has a schedule when it is configured and has a finish; without one the backend needs the window. Unknown (not loaded) counts as scheduled. */
export const needsWindow = (schedule: { Configured: boolean; FinishAt: string | null } | null) => schedule !== null && !(schedule.Configured && schedule.FinishAt)

function Field({ label, help, required, children }: { label: string; help?: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5">
    <span className="flex items-center gap-1.5 text-sm font-medium">{label}{required && <span aria-hidden="true" className="-ml-1 text-sm text-destructive">*</span>}{help && <FieldHelp text={help} />}</span>
    {children}
  </div>
}

function AmountFields({ value, onChange, label, disabled }: { value: AmountText; onChange: (next: AmountText) => void; label: string; disabled: boolean }) {
  return <div className="grid grid-cols-2 gap-2">
    <NumberInput value={value.cpu} onChange={(cpu) => onChange({ ...value, cpu })} placeholder={t("admin.resources.editor.cpuMillicores")} aria-label={`${label}: ${t("admin.resources.editor.cpuMillicores")}`} disabled={disabled} />
    <NumberInput value={value.memoryMiB} onChange={(memoryMiB) => onChange({ ...value, memoryMiB })} placeholder={t("admin.resources.editor.memoryMiB")} aria-label={`${label}: ${t("admin.resources.editor.memoryMiB")}`} disabled={disabled} />
  </div>
}

function ConflictList({ conflicts }: { conflicts: Conflict[] }) {
  return <ul className="space-y-1 text-sm" data-testid="editor-conflicts">
    {conflicts.map((conflict) => <li key={`${conflict.From}-${conflict.To}`} className="flex flex-wrap items-center gap-2">
      <Badge tone="danger">{t(conflict.PoolShort ? "admin.resources.conflict.pool" : "admin.resources.conflict.range")}</Badge>
      <span className="tabular-nums">{formatWindow(conflict.From, conflict.To)}</span>
      {conflict.Unplaced > 0 && <span className="text-muted-foreground">{t("admin.resources.conflict.unplaced", { count: conflict.Unplaced })}</span>}
      <span className="text-muted-foreground">{t("admin.resources.conflict.short", { amount: formatAmount(conflict.Short) })}</span>
    </li>)}
  </ul>
}

function Preview({ result }: { result: ReservationResult }) {
  const r = result.Reservation
  const conflicts = result.Conflicts ?? []
  return <div className="space-y-2 rounded-md border border-border p-3 text-sm" data-testid="editor-preview">
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{t("admin.resources.editor.preview.title")}</span>
      {!r.Covered && <Badge tone="warn">{t("admin.resources.uncovered")}</Badge>}
      {conflicts.length === 0 && r.Unplaced === 0 && <Badge tone="ok">{t("admin.resources.editor.preview.fits")}</Badge>}
    </div>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      <dt className="text-muted-foreground">{t("admin.resources.editor.preview.window")}</dt><dd className="tabular-nums">{formatWindow(r.From, r.To)}</dd>
      <dt className="text-muted-foreground">{t("admin.resources.editor.preview.size")}</dt><dd className="tabular-nums">{formatAmount(r.Size)}</dd>
      <dt className="text-muted-foreground">{t("admin.resources.editor.preview.placement")}</dt>
      <dd>{(r.Placement ?? []).length === 0 ? "—" : (r.Placement ?? []).map((share) => tPlural("admin.resources.editor.preview.share", share.Units, { agent: share.AgentName })).join(", ")}</dd>
      {r.Unplaced > 0 && <><dt className="text-muted-foreground">{t("admin.resources.editor.preview.unplaced")}</dt><dd>{r.Unplaced}</dd></>}
    </dl>
    {conflicts.length > 0 && <ConflictList conflicts={conflicts} />}
  </div>
}

/**
 * The event reservation editor. Every field is optional and an empty one keeps the plan's
 * default. «Попередній перегляд» sends DryRun; «Зберегти» saves, and a 72504 asks whether to
 * keep it anyway (AllowConflicts).
 */
export function ReservationEditor({ target, canWrite, onClose, onSaved, onCancelReservation }: {
  target: { eventID: string; name: string } | null
  canWrite: boolean
  onClose: () => void
  onSaved: () => void
  onCancelReservation: (target: { eventID: string; name: string }) => void
}) {
  const eventID = target?.eventID ?? null
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading")
  const [loadError, setLoadError] = useState<unknown>(null)
  const [existing, setExisting] = useState(false)
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM)
  const [preview, setPreview] = useState<ReservationResult | null>(null)
  const [busy, setBusy] = useState<"preview" | "save" | null>(null)
  const [error, setError] = useState("")
  const [confirmConflicts, setConfirmConflicts] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [windowRequired, setWindowRequired] = useState(false)

  useEffect(() => {
    if (!eventID) return
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the editor reloads for each event it opens
    setPhase("loading"); setPreview(null); setError(""); setConfirmConflicts(false); setForm(EMPTY_FORM)
    // The schedule only decides the required marker: when it cannot be read, nothing is marked and the backend still checks.
    const schedule = getEventSchedule(eventID).then((s) => needsWindow(s), () => false)
    getEventReservation(eventID).then(async (result) => {
      const required = await schedule
      if (!alive) return
      setWindowRequired(required); setExisting(true); setForm(formFromResult(result)); setPhase("ready")
    }).catch(async (err: unknown) => {
      const required = await schedule
      if (!alive) return
      if (err instanceof ApiError && err.code === CODE_NO_RESERVATION) { setWindowRequired(required); setExisting(false); setPhase("ready") }
      else { setLoadError(err); setPhase("failed") }
    })
    return () => { alive = false }
  }, [eventID, attempt])

  const set = (patch: Partial<EditorForm>) => { setForm((current) => ({ ...current, ...patch })); setPreview(null); setError("") }
  const disabled = !canWrite || busy !== null

  async function send(mode: "preview" | "save", allowConflicts = false) {
    if (!eventID) return
    const input = inputFromForm(form, windowRequired)
    if (input === null || input === "window") { setError(t(windowRequired && !form.start && !form.end ? "admin.resources.editor.windowRequired" : "admin.resources.editor.invalidWindow")); return }
    setBusy(mode)
    setError("")
    try {
      const result = await putEventReservation(eventID, { ...input, DryRun: mode === "preview", ...(allowConflicts ? { AllowConflicts: true } : {}) })
      if (mode === "preview") { setPreview(result); return }
      toast.success(t(existing ? "admin.resources.editor.saved" : "admin.resources.editor.created"))
      setConfirmConflicts(false)
      onSaved()
    } catch (err) {
      if (isDoesNotFit(err)) {
        if (mode === "save") setConfirmConflicts(true)
        else setError(t("admin.resources.editor.noFit"))
      } else setError(localizedError(err))
    } finally {
      setBusy(null)
    }
  }

  return <>
    <Dialog open={target !== null && !confirmConflicts} onOpenChange={(open) => { if (!open && busy === null) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.resources.editor.title", { name: target?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t(existing ? "admin.resources.editor.descriptionSaved" : "admin.resources.editor.description")}</DialogDescription>
        </DialogHeader>
        {phase === "loading" && <LoadingArea className="min-h-56" label={t("admin.loading")} />}
        {phase === "failed" && <LoadError className="min-h-56" message={t("admin.resources.editor.loadError")} error={loadError} onRetry={() => setAttempt((n) => n + 1)} />}
        {phase === "ready" && <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.resources.editor.teams")}>
              <NumberInput value={form.teams} onChange={(teams) => set({ teams })} placeholder={t("admin.resources.editor.byPlan")} disabled={disabled} />
            </Field>
            <Field label={t("admin.resources.editor.buffer")} help={t("admin.resources.editor.bufferHelp")}>
              <NumberInput value={form.buffer} onChange={(buffer) => set({ buffer })} placeholder={t("admin.resources.editor.byPlan")} disabled={disabled} />
            </Field>
            <Field label={t("admin.resources.editor.perTeam")} help={t("admin.resources.editor.perTeamHelp")}>
              <AmountFields label={t("admin.resources.editor.perTeam")} value={form.perTeam} onChange={(perTeam) => set({ perTeam })} disabled={disabled} />
            </Field>
            <Field label={t("admin.resources.editor.dynamic")} help={t("admin.resources.editor.dynamicHelp")}>
              <AmountFields label={t("admin.resources.editor.dynamic")} value={form.dynamic} onChange={(dynamic) => set({ dynamic })} disabled={disabled} />
            </Field>
            <Field label={t("admin.resources.editor.windowStart")} help={t("admin.resources.editor.windowHelp")} required={windowRequired}>
              <DateTimePicker value={form.start} onChange={(start) => set({ start })} allowClear={!windowRequired} disabled={disabled} aria-label={t("admin.resources.editor.windowStart")} aria-required={windowRequired || undefined} />
            </Field>
            <Field label={t("admin.resources.editor.windowEnd")} required={windowRequired}>
              <DateTimePicker value={form.end} onChange={(end) => set({ end })} allowClear={!windowRequired} disabled={disabled} aria-label={t("admin.resources.editor.windowEnd")} aria-required={windowRequired || undefined} />
            </Field>
            <Field label={t("admin.resources.editor.tailGap")} help={t("admin.resources.editor.tailGapHelp")}>
              <NumberInput value={form.tailGap} onChange={(tailGap) => set({ tailGap })} placeholder="60" disabled={disabled} />
            </Field>
          </div>
          {preview && <Preview result={preview} />}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>}
        <DialogFooter className="sm:justify-between">
          <span>{canWrite && existing && phase === "ready" && target && <Button type="button" variant="outline" className="text-[var(--ib-danger)]" disabled={busy !== null} onClick={() => onCancelReservation(target)}>{t("admin.resources.editor.cancelReservation")}</Button>}</span>
          <span className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={onClose}>{t("admin.resources.editor.close")}</Button>
            {canWrite && phase === "ready" && <>
              <Button type="button" variant="secondary" busy={busy === "preview"} disabled={busy !== null} onClick={() => void send("preview")}>{t("admin.resources.editor.preview")}</Button>
              <Button type="button" busy={busy === "save"} disabled={busy !== null} onClick={() => void send("save")}>{t("admin.resources.editor.save")}</Button>
            </>}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AllowConflictsDialog open={target !== null && confirmConflicts} busy={busy === "save"} error={error} onCancel={() => { setConfirmConflicts(false); setError("") }} onConfirm={() => void send("save", true)} />
  </>
}
