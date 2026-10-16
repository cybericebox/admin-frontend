"use client"
import { FieldValidation } from "@/components/ui/field-validation"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { apiGet, apiPut } from "@/api/client"
import { NoAccess } from "@/components/rbac/NoAccess"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { useRole } from "@/lib/useRole"
import { formatListDateTime, formatNumber } from "@/lib/locale"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { sameTemplateValue } from "@/lib/templateEditorState"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { LoadError } from "@/components/ui/load-error"
import { PageHeader } from "@/components/ui/page-header"
import { LoadingArea } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import { t } from "@/i18n/t"
import { tRich } from "@/i18n/tRich"

type Setting = {
  ID: string
  Key: string
  Value: unknown
  RequiredPermission: string
  CreatedAt: string
  UpdatedAt: string
}

type Kind = "boolean" | "number" | "string" | "json"

const kindOf = (value: unknown): Kind => typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : typeof value === "string" ? "string" : "json"

// A known key has a human label (admin.settings.key.<key>); an unknown one shows the key itself in monospace.
function labelOf(key: string): string | null {
  const id = `admin.settings.key.${key}`
  const text = t(id)
  return text === id ? null : text
}

const showValue = (value: unknown) => typeof value === "string" ? value : typeof value === "number" ? formatNumber(value) : JSON.stringify(value, null, 2)

function parsedValue(kind: Kind, draft: string): { valid: boolean; value: unknown } {
  if (kind === "string") return { valid: true, value: draft }
  if (kind === "number") {
    const value = Number(draft.replace(",", "."))
    return { valid: draft.trim() !== "" && Number.isFinite(value), value }
  }
  try { return { valid: true, value: JSON.parse(draft) } } catch { return { valid: false, value: draft } }
}

export default function Page() {
  const allowed = useRole().can("platform.settings.read")
  const canWrite = useRole().can("platform.settings.write")
  const [items, setItems] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [fieldError, setFieldError] = useState("")
  const [error, setError] = useState("")
  const [loadFailed, setLoadFailed] = useState<{ cause: unknown } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const latest = useRef({ editing, draft })
  useLayoutEffect(() => { latest.current = { editing, draft } }, [editing, draft])
  // Only the Save button of the open editor is busy; nothing else on the page is disabled.
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const inFlight = useRef(new Set<string>())
  // Instant changes (switches) go through one promise chain, so quick toggles never race.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(new Map<string, number>())

  const load = useCallback(async () => {
    try {
      setLoadFailed(null)
      setItems((await apiGet<Setting[]>("/api/settings")).filter(item => item.Key !== "participant_preview_exercises"))
    } catch (cause) {
      setLoadFailed({ cause })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (allowed) queueMicrotask(() => void load()) }, [allowed, load])

  const replace = (saved: Setting) => setItems((previous) => previous.map((current) => current.Key === saved.Key ? saved : current))

  // Switch: the new value shows at once, the save is queued; the answer is applied only when no newer change waits; an error rolls back.
  function toggle(item: Setting, value: boolean) {
    const before = items.find((current) => current.Key === item.Key)?.Value
    setItems((previous) => previous.map((current) => current.Key === item.Key ? { ...current, Value: value } : current))
    const ticket = (pending.current.get(item.Key) ?? 0) + 1
    pending.current.set(item.Key, ticket)
    queue.current = queue.current.then(async () => {
      try {
        const saved = await apiPut<Setting>(`/api/settings/${encodeURIComponent(item.Key)}`, { Value: value, RequiredPermission: item.RequiredPermission })
        if (pending.current.get(item.Key) === ticket && saved.Value !== value) replace(saved)
      } catch {
        if (pending.current.get(item.Key) === ticket) setItems((previous) => previous.map((current) => current.Key === item.Key ? { ...current, Value: before } : current))
        toast.error(t("admin.settings.saveError"))
      }
    })
  }

  function startEdit(item: Setting) {
    setFieldError("")
    setEditing(item.Key)
    setDraft(typeof item.Value === "string" ? item.Value : kindOf(item.Value) === "number" ? String(item.Value) : JSON.stringify(item.Value, null, 2))
    setError("")
  }

  async function save(item: Setting) {
    if (inFlight.current.has(item.Key) || !canWrite) return
    const kind = kindOf(item.Value)
    const { valid, value } = parsedValue(kind, draft)
    if (!valid) { setFieldError(t(kind === "number" ? "admin.settings.invalidNumber" : "admin.settings.invalidJson")); return }
    if (sameTemplateValue(value, item.Value)) return
    setFieldError("")
    inFlight.current.add(item.Key)
    setSaving(new Set(inFlight.current))
    setError("")
    try {
      replace(await apiPut<Setting>(`/api/settings/${encodeURIComponent(item.Key)}`, { Value: value, RequiredPermission: item.RequiredPermission }))
      if (latest.current.editing === item.Key && sameTemplateValue(parsedValue(kind, latest.current.draft).value, value)) setEditing(null)
    } catch {
      setError(t("admin.settings.saveError"))
    } finally {
      inFlight.current.delete(item.Key)
      setSaving(new Set(inFlight.current))
    }
  }

  return (
    <RequirePermission perm="platform.settings.read" fallback={<NoAccess message={t("admin.settings.noAccess")} />}>
      <div className="flex min-h-full flex-col gap-5">
        <PageHeader title={t("admin.settings.title")} sub={t("admin.settings.description")} />
        <SettingsTabs />
        {error && <p role="alert" className="rounded-md bg-[var(--ib-danger-bg)] p-3 text-sm text-[var(--ib-danger)]">{error}</p>}
        {loading ? <LoadingArea className="flex-1" label={t("admin.loading")} /> : loadFailed ? <LoadError message={t("admin.settings.loadError")} error={loadFailed.cause} onRetry={() => void load()} className="flex-1" /> : items.length === 0 ? <EmptyState message={t("admin.settings.emptyExplained", { tab: t("admin.settings.tab.mail") })} className="flex-1" /> : (
          <Card><CardContent className="divide-y divide-border pt-5">
            {items.map((item) => {
              const kind = kindOf(item.Value)
              const label = labelOf(item.Key)
              const name = label ?? item.Key
              const open = editing === item.Key
              const parsed = parsedValue(kind, draft)
              const dirty = !parsed.valid || !sameTemplateValue(parsed.value, item.Value)
              return <div key={item.ID} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className={label ? "font-medium text-foreground" : "font-mono text-sm font-medium text-foreground"}>{name}</h2>
                    {label && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.Key}</p>}
                    {!open && kind !== "boolean" && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-sm text-muted-foreground">{showValue(item.Value)}</pre>}
                    {item.UpdatedAt && <p className="mt-1 text-xs text-muted-foreground">{tRich("admin.settings.updatedAt", { date: <time dateTime={item.UpdatedAt}>{formatListDateTime(item.UpdatedAt)}</time> })}</p>}
                  </div>
                  {kind === "boolean"
                    ? <Switch checked={item.Value === true} onCheckedChange={(value) => toggle(item, value)} disabled={!canWrite} aria-label={name} />
                    : !open && <RequirePermission perm="platform.settings.write"><Button variant="outline" size="sm" aria-label={t("admin.settings.editNamed", { key: name })} onClick={() => startEdit(item)}>{t("admin.settings.edit")}</Button></RequirePermission>}
                </div>
                {open && <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void save(item) }}>
                  <label className="block text-sm font-medium" htmlFor="setting-value">{t("admin.settings.value")}</label>
                  <FieldValidation error={fieldError} label={t("admin.settings.value")}>{kind === "json"
                    ? <textarea id="setting-value" value={draft} onChange={(event) => { setFieldError(""); setDraft(event.target.value) }} rows={5} className="min-h-32 w-full rounded-md border border-border bg-card p-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-primary" />
                    : <Input id="setting-value" value={draft} inputMode={kind === "number" ? "decimal" : undefined} onChange={(event) => { setFieldError(""); setDraft(event.target.value) }} autoComplete="off" />}</FieldValidation>
                  <div className="flex gap-2"><SaveButton type="submit" dirty={dirty} busy={saving.has(item.Key)}>{t("admin.settings.save")}</SaveButton><Button type="button" variant="outline" onClick={() => setEditing(null)}>{t("admin.settings.cancel")}</Button></div>
                </form>}
              </div>
            })}
          </CardContent></Card>
        )}
      </div>
    </RequirePermission>
  )
}
