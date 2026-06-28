// src/components/notifications/TemplateEditorShell.tsx
"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/api/client"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { StatusPill } from "./StatusPill"
import { useNotificationTypes } from "./templateTypes"
import { formatNotifType } from "@/utils/notifType"
import { VariableChips, type NotifVariable } from "./VariableChips"
import { TemplatePreview } from "./TemplatePreview"

type Tpl = { ID: string; NotificationType: string; Status: string } & Record<string, string>
type ListResp = { Templates: Tpl[]; MissingActiveFor: string[] }
type FieldDef = { key: string; label: string; multiline?: boolean }

export function TemplateEditorShell({
  channel,
  apiBase,
  fields,
}: {
  channel: "inapp" | "email"
  apiBase: string
  fields: FieldDef[]
}) {
  const types = useNotificationTypes()
  const channelTypes = useMemo(
    () => types.filter((ty) => ty.Channels.includes(channel === "inapp" ? "in_app" : "email")),
    [types, channel],
  )

  const [data, setData] = useState<ListResp | null>(null)
  const [error, setError] = useState(false)
  const [selectedType, setSelectedType] = useState<string>("")
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [testResult, setTestResult] = useState<"ok" | "error" | null>(null)
  const lastFocused = useRef<string | null>(null)

  function reload() {
    setError(false)
    apiGet<ListResp>(apiBase).then(setData).catch(() => setError(true))
  }
  useEffect(() => { reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [apiBase])

  // The current template for the selected type (active preferred, else any draft).
  const current = useMemo<Tpl | null>(() => {
    if (!data || !selectedType) return null
    const matches = data.Templates.filter((x) => x.NotificationType === selectedType)
    return matches.find((x) => x.Status === "active") ?? matches[0] ?? null
  }, [data, selectedType])

  // Load the selected type's template (or a blank draft) into the editor.
  useEffect(() => {
    if (!selectedType) { setValues({}); return }
    const next: Record<string, string> = {}
    for (const f of fields) next[f.key] = current ? (current[f.key] ?? "") : ""
    setValues(next)
    setSaveError(false)
    setTestResult(null)
  }, [selectedType, current, fields])

  const selectedDef = channelTypes.find((ty) => ty.Type === selectedType)
  const variables: NotifVariable[] = selectedDef?.Variables ?? []
  const sampleVars = useMemo(() => {
    const m: Record<string, string> = {}
    for (const v of variables) m[v.Name] = v.Default
    return m
  }, [variables])

  function insertToken(token: string) {
    const key = lastFocused.current ?? fields[0]?.key
    if (!key) return
    setValues((prev) => ({ ...prev, [key]: (prev[key] ?? "") + token }))
  }

  async function save() {
    setBusy(true); setSaveError(false)
    const payload: Record<string, string> = {}
    for (const f of fields) payload[f.key] = values[f.key] ?? ""
    try {
      if (current) await apiPut(`${apiBase}/${current.ID}`, payload)
      else await apiPost(apiBase, { NotificationType: selectedType, ...payload })
      reload()
    } catch { setSaveError(true) } finally { setBusy(false) }
  }

  async function toggleStatus() {
    if (!current) return
    setBusy(true); setSaveError(false)
    const next = current.Status === "active" ? "draft" : "active"
    try { await apiPatch(`${apiBase}/${current.ID}/status`, { Status: next }); reload() }
    catch { setSaveError(true) } finally { setBusy(false) }
  }

  async function remove() {
    if (!current) return
    setBusy(true); setSaveError(false)
    try { await apiDelete(`${apiBase}/${current.ID}`); reload() }
    catch { setSaveError(true) } finally { setBusy(false) }
  }

  async function sendTest() {
    setBusy(true); setTestResult(null)
    const chan = channel === "inapp" ? "in_app" : "email"
    try {
      await apiPost("/api/notifications/test", { Type: selectedType, Channels: [chan], Variables: {} })
      setTestResult("ok")
    } catch { setTestResult("error") } finally { setBusy(false) }
  }

  if (error) return <p className="text-sm text-destructive">{t("admin.notif.loadError")}</p>
  if (!data) return <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>

  return (
    <div className="space-y-4">
      {data.MissingActiveFor.length > 0 && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t("admin.notif.tpl.missingActive")}: {data.MissingActiveFor.map(formatNotifType).join(", ")}
        </p>
      )}

      <label className="block max-w-sm text-sm">
        <span className="text-muted-foreground">{t("admin.notif.tpl.type")}</span>
        <SelectType
          value={selectedType}
          onChange={setSelectedType}
          options={channelTypes.map((ty) => ty.Type)}
        />
      </label>

      {selectedType && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: fields */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{formatNotifType(selectedType)}</span>
              {current && <StatusPill status={current.Status} />}
              {!current && <span className="text-xs text-muted-foreground">{t("admin.notif.tpl.statusNew")}</span>}
            </div>

            <VariableChips variables={variables} onInsert={insertToken} />

            {fields.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                {f.multiline ? (
                  <textarea
                    value={values[f.key] ?? ""}
                    onFocus={() => { lastFocused.current = f.key }}
                    onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    rows={6}
                    className="mt-1 w-full rounded-md border border-input bg-secondary/40 px-3 py-2 font-mono text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                ) : (
                  <Input
                    value={values[f.key] ?? ""}
                    onFocus={() => { lastFocused.current = f.key }}
                    onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    className="mt-1"
                  />
                )}
              </label>
            ))}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button disabled={busy} onClick={save}>{t("admin.notif.tpl.save")}</Button>
              {current && (
                <Button variant="outline" disabled={busy} onClick={toggleStatus}>
                  {current.Status === "active" ? t("admin.notif.tpl.unpublish") : t("admin.notif.tpl.publish")}
                </Button>
              )}
              <Button variant="secondary" disabled={busy} onClick={sendTest}>{t("admin.notif.tpl.test")}</Button>
              {current && <Button variant="destructive" disabled={busy} onClick={remove}>{t("admin.notif.tpl.delete")}</Button>}
            </div>
            {saveError && <p className="text-sm text-destructive">{t("admin.notif.tpl.saveError")}</p>}
            {testResult === "ok" && <p className="text-sm text-primary">{t("admin.notif.tpl.testOk")}</p>}
            {testResult === "error" && <p className="text-sm text-destructive">{t("admin.notif.tpl.testError")}</p>}
          </div>

          {/* Right: live preview */}
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.tpl.preview")}</span>
            <TemplatePreview channel={channel} values={values} vars={sampleVars} />
          </div>
        </div>
      )}
    </div>
  )
}

// Small local type-picker using our Select (kept here to avoid an extra file).
function SelectType({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1">
      <option value="">{t("admin.notif.tpl.choose")}</option>
      {options.map((o) => <option key={o} value={o}>{formatNotifType(o)}</option>)}
    </Select>
  )
}
