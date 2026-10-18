"use client"
import { TriangleAlert } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { ApiError } from "@/api/client"
import { getPolicyRetention, type PolicyPeriod, type PolicyRetention } from "@/api/privacyPolicy"
import { getLimitSettings, resetLimitSettings, saveLimitSettings, type LimitCard, type LimitField, type LimitKind, type LimitSettings } from "@/api/platformLimits"
import { localizedError } from "@/i18n/apiError"
import { tPlural } from "@/i18n/plural"
import { t } from "@/i18n/t"
import { bestUnit, fromBase, toBase, type Unit } from "@/lib/limitUnits"
import { useRole } from "@/lib/useRole"
import { cn } from "@/utils/cn"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { FieldValidation } from "@/components/ui/field-validation"
import { LoadError } from "@/components/ui/load-error"
import { NumberInput, parseNumberInput } from "@/components/ui/number-input"
import { SaveButton } from "@/components/ui/save-button"
import { Select } from "@/components/ui/select"
import { LoadingArea, Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"

export type LimitGroup = { titleKey?: string; keys: string[] }

type Entry = { text: string; unit?: Unit }
type Draft = Record<string, Entry>

// Cross-field rules, checked when both keys are on the card (the server checks them too).
const RULES: { key: string; other: string; holds: (value: number, other: number) => boolean; message: string }[] = [
  { key: "InactivityGrace", other: "InactiveAccount", holds: (value, other) => value < other, message: "admin.limits.error.lessThan" },
  { key: "LeaseMax", other: "Lease", holds: (value, other) => value >= other, message: "admin.limits.error.atLeast" },
  { key: "EntryBytes", other: "UnpackedBytes", holds: (value, other) => value <= other, message: "admin.limits.error.atMost" },
]

/** Room for the loaded form (two columns of ~6.5rem rows, group headings, buttons), so loader → data does not shift. */
export function reservedHeight(groups: LimitGroup[], withButtons: boolean): string {
  const rem = groups.reduce((sum, group) => sum + (group.titleKey ? 1.75 : 0) + Math.ceil(group.keys.length / 2) * 6.5, 0)
    + Math.max(0, groups.length - 1) * 1.5 + (withButtons ? 4.5 : 0)
  return `${rem}rem`
}

/** «36 год», «3 дні», «512 МіБ», «1000»: the value in the largest allowed unit that divides it; `genitive` reads after «до» («3 років»). */
function formatAmount(kind: LimitKind, value: number, allowed: Unit[], genitive = false): string {
  const unit = bestUnit(kind, value, allowed)
  const count = fromBase(value, unit)
  return unit ? t("admin.limits.amount", { count, unit: tPlural(`admin.limits.${genitive ? "unitGen" : "unit"}.${unit}`, count) }) : String(count)
}

function draftOf(settings: LimitSettings, units: Record<string, Unit[]>): Draft {
  return Object.fromEntries(settings.Fields.map((field) => {
    const unit = bestUnit(field.Kind, field.Value, units[field.Key] ?? [])
    return [field.Key, { text: String(fromBase(field.Value, unit)), unit }]
  }))
}

/** The entry in base units (seconds, bytes); null when empty, NaN when not a positive whole base value. */
function baseOf(entry: Entry | undefined): number | null {
  const amount = parseNumberInput(entry?.text ?? "")
  if (amount === null || Number.isNaN(amount)) return amount
  const base = toBase(amount, entry?.unit)
  return Number.isSafeInteger(base) ? base : Number.NaN
}

function rangeMessage(field: LimitField, min: number, max: number, allowed: Unit[]): string {
  return t("admin.limits.error.range", { min: formatAmount(field.Kind, min, allowed), max: formatAmount(field.Kind, max, allowed) })
}

/** The field a validation error names (Status.Context.field), with the range when the server sends one. */
function serverField(err: unknown): { field: string; min?: number; max?: number } | null {
  if (!(err instanceof ApiError)) return null
  const context = (err.body as { Status?: { Context?: { field?: unknown; min?: unknown; max?: unknown } } } | null)?.Status?.Context
  if (!context || typeof context.field !== "string") return null
  return {
    field: context.field,
    min: typeof context.min === "number" ? context.min : undefined,
    max: typeof context.max === "number" ? context.max : undefined,
  }
}

/**
 * A card of typed integer limits (durations, sizes, counts) for one settings object. Loads itself; each
 * field is a number with a unit, the default and the privacy-policy note shown only when the value differs from them. The
 * save sends every field in base units, busies only its own button and keeps edits typed meanwhile.
 */
export function LimitSettingsCard({ card, title, description, groups, units, labelKey }: {
  card: LimitCard
  title: string
  description?: string
  groups: LimitGroup[]
  units: Record<string, Unit[]>
  labelKey: (key: string) => string
}) {
  const canWrite = useRole().can("platform.settings.write")
  const idPrefix = useId()
  const [settings, setSettings] = useState<LimitSettings | null>(null)
  const [loadError, setLoadError] = useState<{ cause: unknown } | null>(null)
  // The Privacy Policy's periods (retention card only): they cap the values and fill the note under the fields.
  // A failed load only costs the note and the check, never the saving.
  const [policy, setPolicy] = useState<{ status: "loading" } | { status: "error"; cause: unknown } | { status: "ready"; periods: PolicyRetention }>({ status: "loading" })
  const [draft, setDraft] = useState<Draft>({})
  const [checked, setChecked] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [saveBusy, setSaveBusy] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState("")
  const edits = useRef(0)
  // The newest save/reset: an older answer arriving later is dropped.
  const requestSeq = useRef(0)
  // The units are fixed for the life of the card: one source for the load, the save and the render.
  const [fixedUnits] = useState(units)
  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft }, [draft])

  const load = useCallback(async () => {
    setLoadError(null)
    setSettings(null)
    try {
      const next = await getLimitSettings(card)
      setSettings(next)
      setDraft(draftOf(next, fixedUnits))
    } catch (cause) {
      setLoadError({ cause })
    }
  }, [card, fixedUnits])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const loadPolicy = useCallback(async () => {
    setPolicy({ status: "loading" })
    try {
      setPolicy({ status: "ready", periods: await getPolicyRetention() })
    } catch (cause) {
      setPolicy({ status: "error", cause })
    }
  }, [])

  useEffect(() => { if (card === "retention") queueMicrotask(() => void loadPolicy()) }, [card, loadPolicy])

  /** The Policy's period for a published field in seconds; none while the Policy is not loaded or does not name the field. */
  const policyOf = (field: LimitField): PolicyPeriod | undefined => (field.InPrivacyPolicy && policy.status === "ready" ? policy.periods[field.Key] : undefined)

  const fields = settings?.Fields ?? []
  const byKey = new Map(fields.map((field) => [field.Key, field]))
  // Only grouped fields render, so only they are validated and can show a server error.
  const rendered = new Set(groups.flatMap((group) => group.keys))
  const shown = fields.filter((field) => rendered.has(field.Key))
  const allowed = (key: string) => fixedUnits[key] ?? []

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    for (const field of shown) {
      const base = baseOf(draft[field.Key])
      if (base === null) errors[field.Key] = t("admin.limits.error.required")
      else if (Number.isNaN(base) || base < field.Min || base > field.Max) errors[field.Key] = rangeMessage(field, field.Min, field.Max, allowed(field.Key))
    }
    for (const rule of RULES) {
      if (!rendered.has(rule.key) || !rendered.has(rule.other) || !byKey.has(rule.key) || !byKey.has(rule.other) || errors[rule.key] || errors[rule.other]) continue
      const value = baseOf(draft[rule.key]) as number
      const other = baseOf(draft[rule.other]) as number
      if (!rule.holds(value, other)) errors[rule.key] = t(rule.message, { field: t(labelKey(rule.other)) })
    }
    return errors
  }

  const clientErrors = checked ? validate() : {}
  const dirty = fields.some((field) => baseOf(draft[field.Key]) !== field.Value)

  function edit(key: string, change: Partial<Entry>) {
    edits.current += 1
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...change } }))
    setServerErrors((current) => {
      if (!(key in current)) return current
      const rest = { ...current }
      delete rest[key]
      return rest
    })
  }

  async function save() {
    if (saveBusy || !dirty || !settings) return
    setChecked(true)
    if (Object.keys(validate()).length > 0) return
    setSaveBusy(true)
    setServerErrors({})
    const seen = edits.current
    const seq = ++requestSeq.current
    const submitted = draftRef.current
    const values = Object.fromEntries(fields.map((field) => [field.Key, baseOf(draft[field.Key]) as number]))
    try {
      const next = await saveLimitSettings(card, values)
      if (seq !== requestSeq.current) return
      setSettings(next)
      // Edits typed while the save was running stay in the form.
      if (edits.current === seen) { setDraft(draftOf(next, fixedUnits)); setChecked(false) }
      toast.success(t("admin.limits.saved"))
    } catch (err) {
      if (seq !== requestSeq.current) return
      const named = serverField(err)
      const field = named && rendered.has(named.field) ? byKey.get(named.field) : undefined
      if (named && field) {
        // The field was edited during the save: the error is about the old value.
        if (draftRef.current[field.Key] === submitted[field.Key]) {
          const message = named.min !== undefined && named.max !== undefined ? rangeMessage(field, named.min, named.max, allowed(field.Key)) : localizedError(err)
          setServerErrors({ [field.Key]: message })
        } else {
          toast.error(localizedError(err))
        }
      } else {
        toast.error(localizedError(err))
      }
    } finally {
      setSaveBusy(false)
    }
  }

  async function reset() {
    setResetBusy(true)
    setResetError("")
    const seq = ++requestSeq.current
    try {
      const next = await resetLimitSettings(card)
      if (seq !== requestSeq.current) { setResetting(false); return }
      edits.current += 1
      setSettings(next)
      setDraft(draftOf(next, fixedUnits))
      setChecked(false)
      setServerErrors({})
      setResetting(false)
      toast.success(t("admin.limits.resetDone"))
    } catch (err) {
      if (seq !== requestSeq.current) setResetting(false)
      else setResetError(localizedError(err))
    } finally {
      setResetBusy(false)
    }
  }

  /**
   * The Policy phrase under a published field, in the Policy's own wording. «до N» is an upper bound: longer is danger, shorter
   * warning. The other phrasings («через N», «понад N», …) are exact promises: any difference is danger.
   * Shown only on a mismatch; never blocks saving.
   */
  function policyNote(field: LimitField, base: number | null, fieldUnits: Unit[]) {
    const period = policyOf(field)
    if (period === undefined) return null
    const { kind, seconds } = period
    const value = formatAmount(field.Kind, seconds, fieldUnits, kind === "upTo")
    if (base === null || Number.isNaN(base) || base === seconds) return null
    const danger = kind !== "upTo" || base > seconds
    const message = kind !== "upTo" ? t(`admin.limits.policy.mismatch.${kind}`, { value }) : t(danger ? "admin.limits.policy.over" : "admin.limits.policy.under", { value })
    return (
      <p data-policy={danger ? "danger" : "warning"} className={cn("flex items-start gap-1 text-xs font-medium", danger ? "text-destructive" : "text-[var(--ib-warn)]")}>
        <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden />
        <span>{message}</span>
      </p>
    )
  }

  function renderField(field: LimitField) {
    const id = `${idPrefix}-${field.Key}`
    const label = t(labelKey(field.Key))
    const entry = draft[field.Key]
    const fieldUnits = allowed(field.Key)
    const amount = parseNumberInput(entry?.text ?? "")
    const count = amount === null || Number.isNaN(amount) ? 0 : amount
    const error = serverErrors[field.Key] ?? clientErrors[field.Key]
    const current = canWrite ? baseOf(entry) : field.Value
    return (
      <div key={field.Key} data-field={field.Key} className="min-w-0 space-y-1.5">
        <label htmlFor={canWrite ? id : undefined} className="block text-sm font-medium">{label}</label>
        {canWrite ? (
          <FieldValidation error={error}>
            <div className="flex flex-wrap items-center gap-2">
              <NumberInput id={id} className="w-28 max-w-full" value={entry?.text ?? ""} aria-invalid={Boolean(error)}
                onChange={(text) => edit(field.Key, { text })} />
              {fieldUnits.length > 1 && entry?.unit ? (
                <div className="w-32 max-w-full">
                  <Select aria-label={t("admin.limits.unitLabel", { field: label })} value={entry.unit}
                    onChange={(event) => edit(field.Key, { unit: event.target.value as Unit })}>
                    {fieldUnits.map((unit) => <option key={unit} value={unit}>{tPlural(`admin.limits.unit.${unit}`, count)}</option>)}
                  </Select>
                </div>
              ) : entry?.unit ? (
                <span className="text-sm text-muted-foreground">{tPlural(`admin.limits.unit.${entry.unit}`, count)}</span>
              ) : null}
            </div>
          </FieldValidation>
        ) : (
          <p className="text-sm">{formatAmount(field.Kind, field.Value, fieldUnits)}</p>
        )}
        {current !== null && !Number.isNaN(current) && current !== field.Default && (
          <p className="text-xs text-muted-foreground">{t("admin.limits.default", { value: formatAmount(field.Kind, field.Default, fieldUnits) })}</p>
        )}
        {field.InPrivacyPolicy && policy.status === "loading" && <Spinner size="sm" className="h-4" />}
        {policyNote(field, current, fieldUnits)}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError ? (
          <div data-testid="limit-reserve" className="flex flex-col" style={{ minHeight: reservedHeight(groups, canWrite) }}>
            <LoadError className="flex-1" message={t("admin.limits.loadError")} error={loadError.cause} onRetry={() => void load()} />
          </div>
        ) : !settings ? (
          <div data-testid="limit-reserve" className="flex flex-col" style={{ minHeight: reservedHeight(groups, canWrite) }}>
            <LoadingArea className="flex-1" label={t("admin.loading")} />
          </div>
        ) : (
          <>
            {policy.status === "error" && <LoadError compact message={t("admin.limits.policyLoadError")} error={policy.cause} onRetry={() => void loadPolicy()} />}
            {settings.Ignored && <p role="status" className="text-sm text-muted-foreground">{t("admin.limits.ignored")}</p>}
            {groups.map((group, index) => {
              const groupFields = group.keys.map((key) => byKey.get(key)).filter((field): field is LimitField => !!field)
              if (groupFields.length === 0) return null
              return (
                <section key={group.titleKey ?? index} className="space-y-3">
                  {group.titleKey && <h3 className="text-sm font-semibold">{t(group.titleKey)}</h3>}
                  <div className="grid gap-4 md:grid-cols-2">{groupFields.map(renderField)}</div>
                </section>
              )
            })}
            {canWrite && (
              <div className="flex flex-wrap items-center gap-3">
                <SaveButton dirty={dirty} busy={saveBusy} onClick={() => void save()}>{t("admin.limits.save")}</SaveButton>
                {settings.Custom && (
                  <Button type="button" variant="outline" onClick={() => { setResetError(""); setResetting(true) }}>{t("admin.limits.reset")}</Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={resetting}
        onCancel={() => setResetting(false)}
        tone="danger"
        title={t("admin.limits.resetTitle")}
        description={t("admin.limits.resetBody")}
        cancelLabel={t("admin.limits.cancel")}
        confirmLabel={t("admin.limits.resetConfirm")}
        busy={resetBusy}
        error={resetError}
        onConfirm={() => void reset()}
      />
    </Card>
  )
}
