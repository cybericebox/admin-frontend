"use client"

import { ApiError } from "@/api/client"
import { FieldValidation } from "@/components/ui/field-validation"
import { useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { enrollAgent, reconnectAgent, updateAgent, type Agent, type DeletePreview } from "@/api/agents"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { useSavedDraft } from "@/lib/useSavedDraft"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldHelp } from "@/components/ui/field-help"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { PasswordInput } from "@/components/ui/password-input"
import { Textarea } from "@/components/ui/textarea"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { AGENT_NAME_MAX, AGENT_PRIORITY_MAX, parsePriority } from "./agentView"

function Field({ id, label, help, required, children, error }: { id: string; label: string; help?: string; required?: boolean; children: ReactNode; error?: string }) {
  return <div className="space-y-1.5">
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {required && <span aria-hidden="true" className="-ml-1 text-sm text-destructive">*</span>}
      {help && <FieldHelp text={help} />}
    </div>
    <FieldValidation error={error} label={label}>{children}</FieldValidation>
  </div>
}

// The CA is for self-signed development clusters only, so it stays folded away.
function CaField({ id, value, onChange, hint }: { id: string; value: string; onChange: (value: string) => void; hint: string }) {
  const [open, setOpen] = useState(value !== "")
  return <div className="space-y-1.5">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />{t("admin.agents.form.ca")}
    </button>
    {open && <>
      <Textarea id={id} value={value} rows={5} spellCheck={false} autoComplete="off" onChange={(event) => onChange(event.target.value)} placeholder="-----BEGIN CERTIFICATE-----" className="font-mono text-xs" aria-label={t("admin.agents.form.ca")} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </>}
  </div>
}

const ENDPOINT = /^(\[[^\]\s]+\]|[^\s:/@[\]]+):\d{1,5}$/

/** One-time token + endpoint: the platform generates every key itself and never stores the token. */
export function EnrollDialog({ onClose, onDone }: { onClose: () => void; onDone: (agent: Agent) => void }) {
  const [name, setName] = useState("")
  const [endpoint, setEndpoint] = useState("")
  const [token, setToken] = useState("")
  const [priority, setPriority] = useState("100")
  const [ca, setCa] = useState("")
  const [error, setError] = useState("")
  const [validated, setValidated] = useState(false)
  const [serverFields, setServerFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const port = Number(endpoint.trim().split(":").pop())
  const fields: Record<string, string> = validated ? {
    name: !name.trim() || name.trim().length > AGENT_NAME_MAX ? t("admin.agents.error.name", { max: AGENT_NAME_MAX }) : "",
    endpoint: !ENDPOINT.test(endpoint.trim()) || port < 1 || port > 65535 ? t("admin.agents.error.endpoint") : "",
    token: !token.trim() ? t("admin.agents.error.token") : "",
    priority: parsePriority(priority) === null ? t("admin.agents.error.priority", { max: AGENT_PRIORITY_MAX }) : "",
  } : {}

  async function submit() {
    setError("")
    setValidated(true)
    setServerFields({})
    if (!name.trim() || name.trim().length > AGENT_NAME_MAX || !ENDPOINT.test(endpoint.trim()) || port < 1 || port > 65535 || !token.trim() || parsePriority(priority) === null) return
    setBusy(true)
    setError("")
    try {
      onDone(await enrollAgent({ Name: name.trim(), Endpoint: endpoint.trim(), EnrollmentToken: token.trim(), CAPEM: ca.trim(), Enabled: true, Priority: parsePriority(priority) ?? 0 }))
    } catch (err) {
      if (err instanceof ApiError && (err.code === 21414 || err.code === 41413)) setServerFields({ [err.code === 21414 ? "token" : "endpoint"]: localizedError(err) })
      else setError(localizedError(err))
      setBusy(false)
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <DialogHeader>
          <DialogTitle>{t("admin.agents.add.title")}</DialogTitle>
          <DialogDescription>{t("admin.agents.add.description")}</DialogDescription>
        </DialogHeader>
        <Field error={fields.name || serverFields.name} id="agent-name" label={t("admin.agents.form.name")} required>
          <Input id="agent-name" value={name} maxLength={AGENT_NAME_MAX} autoComplete="off" onChange={(event) => { setServerFields((current) => ({ ...current, name: "" })); setName(event.target.value) }} />
        </Field>
        <Field error={fields.endpoint || serverFields.endpoint} id="agent-endpoint" label={t("admin.agents.form.endpoint")} help={t("admin.agents.form.endpointHelp")} required>
          <Input id="agent-endpoint" value={endpoint} autoComplete="off" spellCheck={false} placeholder="agent.example.com:443" onChange={(event) => { setServerFields((current) => ({ ...current, endpoint: "" })); setEndpoint(event.target.value) }} />
        </Field>
        <Field error={fields.token || serverFields.token} id="agent-token" label={t("admin.agents.form.token")} help={t("admin.agents.form.tokenHelp")} required>
          <PasswordInput id="agent-token" value={token} autoComplete="off" spellCheck={false} onChange={(event) => { setServerFields((current) => ({ ...current, token: "" })); setToken(event.target.value) }} />
        </Field>
        <Field error={fields.priority || serverFields.priority} id="agent-priority" label={t("admin.agents.form.priority")} help={t("admin.agents.form.priorityHelp")}>
          <NumberInput id="agent-priority" value={priority} onChange={(value) => { setServerFields((current) => ({ ...current, priority: "" })); setPriority(value) }} />
        </Field>
        <CaField id="agent-ca" value={ca} onChange={setCa} hint={t("admin.agents.form.caHelp")} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("confirm.cancel")}</Button>
          <Button type="submit" busy={busy}>{t("admin.agents.add.submit")}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

/** Enrolls the same cluster again with a new token: lost or compromised credentials. */
export function ReconnectDialog({ agent, onClose, onDone }: { agent: Agent; onClose: () => void; onDone: (agent: Agent) => void }) {
  const [token, setToken] = useState("")
  const [ca, setCa] = useState("")
  const [error, setError] = useState("")
  const [validated, setValidated] = useState(false)
  const [serverFields, setServerFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError("")
    setValidated(true)
    setServerFields({})
    if (!token.trim()) return
    setBusy(true)
    setError("")
    try {
      onDone(await reconnectAgent(agent.ID, token.trim(), ca.trim()))
    } catch (err) {
      if (err instanceof ApiError && err.code === 21414) setServerFields({ token: localizedError(err) })
      else setError(localizedError(err))
      setBusy(false)
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <DialogHeader>
          <DialogTitle>{t("admin.agents.reconnect.title", { name: agent.Name })}</DialogTitle>
          <DialogDescription>{t("admin.agents.reconnect.description")}</DialogDescription>
        </DialogHeader>
        <Field error={(validated && (!token.trim()) ? t("admin.agents.error.token") : "") || serverFields.token} id="agent-reconnect-token" label={t("admin.agents.form.token")} help={t("admin.agents.form.tokenHelp")} required>
          <PasswordInput id="agent-reconnect-token" value={token} autoComplete="off" spellCheck={false} onChange={(event) => { setServerFields((current) => ({ ...current, token: "" })); setToken(event.target.value) }} />
        </Field>
        <CaField id="agent-reconnect-ca" value={ca} onChange={setCa} hint={t("admin.agents.form.caKeepHelp")} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("confirm.cancel")}</Button>
          <Button type="submit" busy={busy}>{t("admin.agents.reconnect.submit")}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

/** Name and priority: an explicit form, it busies only its own button. The switch saves instantly in the list. */
export function EditAgentDialog({ agent, onClose, onDone }: { agent: Agent; onClose: () => void; onDone: (agent: Agent, close: boolean) => void }) {
  const { draft, setDraft, baseline, dirty, accept } = useSavedDraft({ name: agent.Name, priority: String(agent.Priority) }, (value) => ({ name: value.name.trim(), priority: parsePriority(value.priority) }))
  const { name, priority } = draft
  const [error, setError] = useState("")
  const [validated, setValidated] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy || !dirty) return
    const next = parsePriority(priority)
    setError("")
    setValidated(true)
    if (!name.trim() || name.trim().length > AGENT_NAME_MAX || next === null) return
    const patch = { ...(name.trim() !== baseline.name.trim() && { Name: name.trim() }), ...(next !== parsePriority(baseline.priority) && { Priority: next }) }
    if (Object.keys(patch).length === 0) return
    setBusy(true)
    setError("")
    try {
      const saved = await updateAgent(agent.ID, patch)
      onDone(saved, accept({ name: saved.Name, priority: String(saved.Priority) }, { name: name.trim(), priority: next }))
    } catch (err) {
      setError(localizedError(err))
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-w-md">
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <DialogHeader>
          <DialogTitle>{t("admin.agents.edit.title", { name: agent.Name })}</DialogTitle>
          <DialogDescription>{t("admin.agents.edit.description")}</DialogDescription>
        </DialogHeader>
        <Field error={(validated && (!name.trim() || name.trim().length > AGENT_NAME_MAX) ? t("admin.agents.error.name", { max: AGENT_NAME_MAX }) : "")} id="agent-edit-name" label={t("admin.agents.form.name")} required>
          <Input id="agent-edit-name" value={name} maxLength={AGENT_NAME_MAX} autoComplete="off" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Field error={(validated && (parsePriority(priority) === null) ? t("admin.agents.error.priority", { max: AGENT_PRIORITY_MAX }) : "")} id="agent-edit-priority" label={t("admin.agents.form.priority")} help={t("admin.agents.form.priorityHelp")}>
          <NumberInput id="agent-edit-priority" value={priority} onChange={(priority) => setDraft({ ...draft, priority })} />
        </Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("confirm.cancel")}</Button>
          <SaveButton type="submit" dirty={dirty} busy={busy}>{t("admin.agents.edit.submit")}</SaveButton>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

/** Running lab groups block the delete: the agent has to be switched off instead. Not a confirmation, only the reason. */
export function DeleteBlockedDialog({ agent, preview, onClose }: { agent: Agent; preview: DeletePreview; onClose: () => void }) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{t("admin.agents.delete.blockedTitle", { name: agent.Name })}</DialogTitle>
        <DialogDescription>{t("admin.agents.delete.blockedBody", { count: preview.RunningGroups })}</DialogDescription>
      </DialogHeader>
      <DialogFooter><Button type="button" onClick={onClose}>{t("admin.agents.close")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

/** The future reservations that lose capacity with the agent, for the delete confirmation. */
export function ReservationImpactList({ preview }: { preview: DeletePreview }) {
  const items = preview.FutureReservations ?? []
  if (items.length === 0) return null
  return <div className="space-y-2">
    <p className="text-sm text-muted-foreground">{t("admin.agents.delete.reservations", { count: items.length })}</p>
    <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
      {items.map((item) => <li key={item.ReservationID} className="px-3 py-2">
        <p className="font-medium">{item.EventName}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(item.StartsAt)} — {formatDateTime(item.EndsAt)} · {formatCpu(item.CPUMillicores)} · {formatBytes(item.MemoryBytes)}</p>
      </li>)}
    </ul>
  </div>
}
