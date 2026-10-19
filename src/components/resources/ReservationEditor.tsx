"use client"

import { FieldValidation } from "@/components/ui/field-validation"
import { useEffect, useRef, useState } from "react"
import { ApiError } from "@/api/client"
import { getEventSchedule } from "@/api/events/catalog"
import {
  getEventReservation, putEventReservation, type ReservationInput, type ReservationResult,
} from "@/api/resourceCalendar"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { useSavedDraft } from "@/lib/useSavedDraft"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldHelp } from "@/components/ui/field-help"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { LoadError } from "@/components/ui/load-error"
import { NumberInput } from "@/components/ui/number-input"
import { LoadingArea } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { formatCpu } from "@/lib/infrastructureMonitoring"
import { isoToLocal, localToIso } from "@/lib/eventSchemas"
import { CODE_NO_RESERVATION, formatGBValue, gbText, gbToAmount, shrinksBelowUse } from "@/lib/resourceCalendar"
import { formatWindow } from "./resourceView"
import { ReservationParts } from "./ReservationParts"
import { ShrinkDialog } from "./ReservationDialogs"

/** The live check waits this long after the last edit. */
export const PREVIEW_DELAY_MS = 400

export type EditorForm = {
  /** The maximum number of teams. */
  teams: string
  buffer: string
  /** Memory for tasks added during the event, in GB. */
  dynamicGB: string
  /** Minutes before the event start. */
  startLead: string
  /** Minutes after the event end. */
  tailGap: string
  /** A fixed start and end replace the two offsets. */
  fixed: boolean
  start: string
  end: string
}

const EMPTY_FORM: EditorForm = { teams: "", buffer: "0", dynamicGB: "0", startLead: "", tailGap: "", fixed: false, start: "", end: "" }

/** The saved reservation as form text; the window is shown as the two offsets unless the event has no schedule to be relative to. */
export function formFromResult(result: ReservationResult, windowRequired = false): EditorForm {
  const r = result.Reservation
  return {
    teams: String(r.Teams), buffer: String(r.BufferPercent), dynamicGB: gbText(r.Dynamic.MemoryBytes),
    startLead: String(r.StartLeadMinutes), tailGap: String(r.TailGapMinutes),
    fixed: windowRequired, start: isoToLocal(r.From), end: isoToLocal(r.To),
  }
}

const whole = (text: string) => (text.trim() !== "" && /^\d+$/.test(text.trim()) ? Number(text) : null)

/**
 * The request body. "window" when the fixed window is incomplete or ends before it starts; null when a number
 * is missing or out of range.
 */
export function inputFromForm(form: EditorForm): ReservationInput | "window" | null {
  const teams = whole(form.teams)
  const buffer = whole(form.buffer)
  const dynamic = gbToAmount(form.dynamicGB)
  if (teams === null || teams < 1 || buffer === null || buffer > 200 || dynamic === null) return null
  const body: ReservationInput = { Teams: teams, BufferPercent: buffer, Dynamic: dynamic }
  if (form.fixed) {
    if (!form.start || !form.end || Date.parse(localToIso(form.end)) <= Date.parse(localToIso(form.start))) return "window"
    body.WindowStart = localToIso(form.start)
    body.WindowEnd = localToIso(form.end)
    return body
  }
  const lead = whole(form.startLead)
  const tail = whole(form.tailGap)
  if (lead === null || tail === null) return null
  body.StartLeadMinutes = lead
  body.TailGapMinutes = tail
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

/** What the reservation holds, in GB. Information only: no verdict on whether it fits. */
export function Summary({ result, used }: { result: ReservationResult; used: number | null }) {
  const r = result.Reservation
  const total = formatGBValue(r.Size.MemoryBytes)
  return <div className="space-y-1.5 rounded-md bg-muted/40 p-4 text-sm" data-testid="editor-summary">
    <HoverTooltip text={t("admin.resources.editor.summary.cpuHint", { cpu: formatCpu(r.Size.CPUMillicores) })}>
      <p tabIndex={0} className="text-lg font-semibold tabular-nums">{t("admin.resources.editor.summary.total", { gb: total })}</p>
    </HoverTooltip>
    <p className="text-muted-foreground tabular-nums">{t("admin.resources.editor.summary.perTeam", { gb: formatGBValue(r.PerTeam.MemoryBytes) })}</p>
    {used !== null && <p className="tabular-nums">{t("admin.resources.editor.summary.used", { used: formatGBValue(used), total })}</p>}
    <p className="tabular-nums">{t("admin.resources.editor.summary.window", { window: formatWindow(r.From, r.To) })}</p>
  </div>
}

/**
 * The event reservation editor. Every field holds its real value. The summary follows the form through a
 * debounced dry run and shows the size in GB and how much is used, never a verdict on whether it fits. Saving
 * never blocks on the fit either: a shortage is the event moderator's concern.
 */
export function ReservationEditor({ target, canWrite, onClose, onSaved, onCancelReservation }: {
  target: { eventID: string; name: string } | null
  canWrite: boolean
  onClose: () => void
  onSaved: (close: boolean) => void
  onCancelReservation: (target: { eventID: string; name: string }) => void
}) {
  const eventID = target?.eventID ?? null
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading")
  const [loadError, setLoadError] = useState<unknown>(null)
  const [existing, setExisting] = useState(false)
  const [windowRequired, setWindowRequired] = useState(false)
  const { draft: form, setDraft: setForm, dirty, accept } = useSavedDraft(EMPTY_FORM, inputFromForm)
  const [summary, setSummary] = useState<ReservationResult | null>(null)
  const [used, setUsed] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [windowError, setWindowError] = useState("")
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  // The saved reservation with its parts (what runs where): a change below it asks first.
  const [saved, setSaved] = useState<ReservationResult | null>(null)
  const [shrinkAsk, setShrinkAsk] = useState(false)
  const revision = useRef(0)

  useEffect(() => {
    if (!eventID) return
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the editor reloads for each event it opens
    setWindowError(""); setPhase("loading"); setSummary(null); setSaved(null); setShrinkAsk(false); setUsed(null); setError(""); setForm(EMPTY_FORM); accept(EMPTY_FORM, inputFromForm(EMPTY_FORM))
    // The schedule only decides whether the fixed window is required: when it cannot be read, nothing is forced and the backend still checks.
    const schedule = getEventSchedule(eventID).then((s) => needsWindow(s), () => false)
    getEventReservation(eventID).then(async (result) => {
      const required = await schedule
      if (!alive) return
      setWindowRequired(required); setExisting(true); setSummary(result); setSaved(result); setUsed(result.Reservation.Used.MemoryBytes)
      accept(formFromResult(result, required)); setPhase("ready")
    }).catch(async (err: unknown) => {
      const required = await schedule
      if (!alive) return
      if (!(err instanceof ApiError && err.code === CODE_NO_RESERVATION)) { setLoadError(err); setPhase("failed"); return }
      setWindowRequired(required); setExisting(false)
      // A new reservation starts from what the event's plan gives, so the fields hold real values.
      const planned = await putEventReservation(eventID, { DryRun: true, AllowConflicts: true }).catch(() => null)
      if (!alive) return
      if (planned) { setSummary(planned); accept(formFromResult(planned, required)) }
      else if (required) { const next = { ...EMPTY_FORM, fixed: true }; setForm(next); accept(next) }
      setPhase("ready")
    })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only opening/retrying an event resets this editor
  }, [eventID, attempt, accept, setForm])

  // The live check: the summary follows the form.
  useEffect(() => {
    if (!eventID || phase !== "ready" || !dirty) return
    const input = inputFromForm(form)
    if (input === null || input === "window") return
    const submitted = revision.current
    const timer = setTimeout(() => {
      putEventReservation(eventID, { ...input, DryRun: true, AllowConflicts: true })
        .then((result) => { if (revision.current === submitted) setSummary(result) })
        .catch(() => undefined)
    }, PREVIEW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [eventID, phase, dirty, form])

  const set = (patch: Partial<EditorForm>) => { revision.current += 1; setWindowError(""); setForm((current) => ({ ...current, ...patch })); setError("") }
  const disabled = !canWrite

  async function save(forceShrink = false) {
    if (!eventID || !canWrite || busy || (existing && !dirty)) return
    const input = inputFromForm(form)
    if (input === "window") { setWindowError(t(windowRequired && !form.start && !form.end ? "admin.resources.editor.windowRequired" : "admin.resources.editor.invalidWindow")); return }
    if (input === null) { setError(t("admin.resources.editor.invalid")); return }
    setBusy(true)
    setError("")
    try {
      // A change below what already runs is asked first: the cluster would delete the labs that do not fit.
      if (!forceShrink && saved && (saved.Reservation.Parts ?? []).some((part) => part.Groups > 0)) {
        const preview = await putEventReservation(eventID, { ...input, DryRun: true, AllowConflicts: true })
        if (shrinksBelowUse(saved.Reservation.Parts, preview.Reservation.Size, preview.Reservation.To, saved.Reservation.To)) {
          setShrinkAsk(true)
          return
        }
      }
      const result = await putEventReservation(eventID, { ...input, AllowConflicts: true, ...(forceShrink ? { ForceShrink: true } : {}) })
      toast.success(t(existing ? "admin.resources.editor.saved" : "admin.resources.editor.created"))
      setExisting(true)
      setSummary(result)
      setSaved(result)
      setShrinkAsk(false)
      onSaved(accept(formFromResult(result, windowRequired), input))
    } catch (err) {
      if (err instanceof ApiError && err.code === 22501) setWindowError(localizedError(err))
      else setError(localizedError(err))
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{t("admin.resources.editor.title", { name: target?.name ?? "" })}</DialogTitle>
        <DialogDescription>{t("admin.resources.editor.description")}</DialogDescription>
      </DialogHeader>
      {phase === "loading" && <LoadingArea className="min-h-56" label={t("admin.loading")} />}
      {phase === "failed" && <LoadError className="min-h-56" message={t("admin.resources.editor.loadError")} error={loadError} onRetry={() => setAttempt((n) => n + 1)} />}
      {phase === "ready" && <div className="space-y-4">
        {summary && <Summary result={summary} used={existing ? used : null} />}
        {saved && <ReservationParts parts={saved.Reservation.Parts} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.resources.editor.teams")} help={t("admin.resources.editor.teamsHelp")}>
            <NumberInput value={form.teams} onChange={(teams) => set({ teams })} aria-label={t("admin.resources.editor.teams")} disabled={disabled} />
          </Field>
          <Field label={t("admin.resources.editor.buffer")} help={t("admin.resources.editor.bufferHelp")}>
            <NumberInput value={form.buffer} onChange={(buffer) => set({ buffer })} aria-label={t("admin.resources.editor.buffer")} disabled={disabled} />
          </Field>
          <Field label={t("admin.resources.editor.dynamic")} help={t("admin.resources.editor.dynamicHelp")}>
            <NumberInput decimal value={form.dynamicGB} onChange={(dynamicGB) => set({ dynamicGB })} aria-label={t("admin.resources.editor.dynamic")} disabled={disabled} />
          </Field>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={form.fixed} onCheckedChange={(fixed) => set({ fixed })} disabled={disabled || windowRequired} aria-label={t("admin.resources.editor.fixed")} />
            {t("admin.resources.editor.fixed")}<FieldHelp text={t(windowRequired ? "admin.resources.editor.fixedRequiredHelp" : "admin.resources.editor.fixedHelp")} />
          </label>
          {form.fixed ? <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.resources.editor.windowStart")} required={windowRequired}>
              <DateTimePicker aria-invalid={Boolean(windowError && !form.start)} aria-describedby={windowError && !form.start ? "reservation-window-error" : undefined} value={form.start} onChange={(start) => set({ start })} disabled={disabled} aria-label={t("admin.resources.editor.windowStart")} aria-required={windowRequired || undefined} />
            </Field>
            <Field label={t("admin.resources.editor.windowEnd")} required={windowRequired}>
              <FieldValidation errorId="reservation-window-error" label={t("admin.resources.editor.windowEnd")} error={windowError}><DateTimePicker value={form.end} onChange={(end) => set({ end })} disabled={disabled} aria-label={t("admin.resources.editor.windowEnd")} aria-required={windowRequired || undefined} /></FieldValidation>
            </Field>
          </div> : <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.resources.editor.startLead")} help={t("admin.resources.editor.startLeadHelp")}>
              <NumberInput value={form.startLead} onChange={(startLead) => set({ startLead })} aria-label={t("admin.resources.editor.startLead")} disabled={disabled} />
            </Field>
            <Field label={t("admin.resources.editor.tailGap")} help={t("admin.resources.editor.tailGapHelp")}>
              <NumberInput value={form.tailGap} onChange={(tailGap) => set({ tailGap })} aria-label={t("admin.resources.editor.tailGap")} disabled={disabled} />
            </Field>
          </div>}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>}
      <DialogFooter className="sm:justify-between">
        <span>{canWrite && existing && phase === "ready" && target && <Button type="button" variant="ghost" className="text-[var(--ib-danger)]" disabled={busy} onClick={() => onCancelReservation(target)}>{t("admin.resources.editor.cancelReservation")}</Button>}</span>
        <span className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("admin.resources.editor.close")}</Button>
          {canWrite && phase === "ready" && <SaveButton type="button" dirty={!existing || dirty} busy={busy} disabled={busy} onClick={() => void save()}>{t("admin.resources.editor.save")}</SaveButton>}
        </span>
      </DialogFooter>
    </DialogContent>
    <ShrinkDialog open={shrinkAsk} busy={busy} error={shrinkAsk ? error : undefined} onCancel={() => setShrinkAsk(false)} onConfirm={() => void save(true)} />
  </Dialog>
}
