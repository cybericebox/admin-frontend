"use client"
import { useRef, useState, type Dispatch, type SetStateAction } from "react"
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react"
import {
  MAIL_NAME_MAX, createMailProvider, deleteMailProvider, isValidEmail, reorderMailProviders, saveMailProvider, setMailProviderEnabled,
  testMailProvider, testMailProviderForm, testMailTransportInUse,
  type MailProvider, type MailProviderInput, type MailSettings, type MailTLSMode, type MailTestResult,
} from "@/api/mail/settings"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { FieldHelp } from "@/components/ui/field-help"
import { Input } from "@/components/ui/input"
import { NumberInput, parseNumberInput } from "@/components/ui/number-input"
import { PasswordInput } from "@/components/ui/password-input"
import { SelectMenu } from "@/components/ui/select-menu"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { mailTransportLabel } from "@/utils/notifType"
import { cn } from "@/utils/cn"

const TLS_OPTIONS: { value: MailTLSMode; label: string }[] = [
  { value: "starttls", label: "STARTTLS (587)" },
  { value: "tls", label: "TLS (465)" },
]

type ProviderForm = {
  Name: string
  Host: string
  Port: string
  TLSMode: MailTLSMode
  Username: string
  Password: string
  ClearPassword: boolean
  SenderName: string
  SenderAddress: string
  ReplyToName: string
  ReplyToAddress: string
  MaxPerSecond: string
  DailyQuota: string
}

const EMPTY_FORM: ProviderForm = {
  Name: "", Host: "", Port: "587", TLSMode: "starttls", Username: "", Password: "", ClearPassword: false,
  SenderName: "", SenderAddress: "", ReplyToName: "", ReplyToAddress: "", MaxPerSecond: "", DailyQuota: "",
}

function formFrom(provider: MailProvider): ProviderForm {
  return {
    Name: provider.Name,
    Host: provider.Host,
    Port: String(provider.Port),
    TLSMode: provider.TLSMode || (provider.Port === 465 ? "tls" : "starttls"),
    Username: provider.Username,
    Password: "",
    ClearPassword: false,
    SenderName: provider.Sender.Name,
    SenderAddress: provider.Sender.Address,
    ReplyToName: provider.ReplyTo.Name,
    ReplyToAddress: provider.ReplyTo.Address,
    MaxPerSecond: provider.MaxPerSecond != null ? String(provider.MaxPerSecond) : "",
    DailyQuota: provider.DailyLimit != null ? String(provider.DailyLimit) : "",
  }
}

function validate(form: ProviderForm): string {
  if (!form.Name.trim()) return t("admin.mail.providers.error.nameRequired")
  if (form.Name.trim().length > MAIL_NAME_MAX) return t("admin.mail.error.nameTooLong", { max: MAIL_NAME_MAX })
  if (!form.Host.trim()) return t("admin.mail.error.hostRequired")
  const port = Number(form.Port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return t("admin.mail.error.portInvalid")
  if (form.SenderName.trim().length > MAIL_NAME_MAX || form.ReplyToName.trim().length > MAIL_NAME_MAX) return t("admin.mail.error.nameTooLong", { max: MAIL_NAME_MAX })
  if (!isValidEmail(form.SenderAddress.trim()) || !isValidEmail(form.ReplyToAddress.trim())) return t("admin.mail.error.emailInvalid")
  if (Number.isNaN(parseNumberInput(form.MaxPerSecond))) return t("admin.mail.error.perSecondInvalid")
  if (Number.isNaN(parseNumberInput(form.DailyQuota, true))) return t("admin.mail.error.dailyQuotaInvalid")
  return ""
}

function inputFrom(form: ProviderForm): MailProviderInput {
  return {
    Name: form.Name.trim(),
    Host: form.Host.trim(),
    Port: Number(form.Port),
    TLSMode: form.TLSMode,
    Username: form.Username.trim(),
    Password: form.ClearPassword ? "" : form.Password,
    ClearPassword: form.ClearPassword,
    Sender: { Name: form.SenderName.trim(), Address: form.SenderAddress.trim() },
    ReplyTo: { Name: form.ReplyToName.trim(), Address: form.ReplyToAddress.trim() },
    MaxPerSecond: parseNumberInput(form.MaxPerSecond),
    DailyQuota: parseNumberInput(form.DailyQuota, true),
  }
}

function testText(result: MailTestResult): string {
  if (result.Sent) {
    return result.Transport
      ? t("admin.mail.test.sentVia", { recipient: result.Recipient, transport: mailTransportLabel(result.Transport) })
      : t("admin.mail.test.sent", { recipient: result.Recipient })
  }
  return t(result.Recipient ? "admin.mail.test.failedTo" : "admin.mail.test.failed", { recipient: result.Recipient, error: result.Error || t("admin.mail.test.unknownError") })
}

const dateText = (iso: string) => new Date(iso).toLocaleString("uk-UA")

/**
 * The platform SMTP providers: a list by priority (the first enabled provider with room left
 * sends, the next one takes over at its daily limit or on a provider error). Instant controls
 * (enable, order) show the choice at once and save through one queue, so quick changes never
 * race and nothing is disabled while a save runs. With SMTP_* set the env transport is the
 * only one in use; the saved list stays visible but is marked as not used.
 */
export function MailProvidersCard({ settings, canWrite, update, reload }: {
  settings: MailSettings
  canWrite: boolean
  update: Dispatch<SetStateAction<MailSettings | null>>
  reload: () => Promise<void>
}) {
  const providers = settings.Providers
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [deleting, setDeleting] = useState<MailProvider | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [results, setResults] = useState<Record<string, MailTestResult>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})

  // Saves of instant controls run one after another; the server answer is applied only when no newer change waits.
  const queue = useRef<Promise<void>>(Promise.resolve())
  const waiting = useRef(0)
  function enqueue(save: () => Promise<MailSettings>) {
    waiting.current += 1
    queue.current = queue.current.then(async () => {
      try {
        const next = await save()
        waiting.current -= 1
        if (waiting.current === 0) update(next)
      } catch (err) {
        waiting.current -= 1
        toast.error(localizedError(err))
        if (waiting.current === 0) await reload().catch(() => undefined)
      }
    })
  }

  function toggle(provider: MailProvider, enabled: boolean) {
    update((current) => current && { ...current, Providers: current.Providers.map((p) => (p.ID === provider.ID ? { ...p, Enabled: enabled } : p)) })
    enqueue(() => setMailProviderEnabled(provider.ID, enabled))
  }

  function move(index: number, by: -1 | 1) {
    const target = index + by
    if (target < 0 || target >= providers.length) return
    const order = providers.map((p) => p.ID)
    ;[order[index], order[target]] = [order[target], order[index]]
    update((current) => {
      if (!current) return current
      const byId = new Map(current.Providers.map((p) => [p.ID, p]))
      return { ...current, Providers: order.flatMap((id, position) => { const p = byId.get(id); return p ? [{ ...p, Priority: position }] : [] }) }
    })
    enqueue(() => reorderMailProviders(order))
  }

  async function runTest(key: string, run: () => Promise<MailTestResult>) {
    setTesting((current) => ({ ...current, [key]: true }))
    try {
      const result = await run()
      setResults((current) => ({ ...current, [key]: result }))
    } catch (err) {
      toast.error(localizedError(err))
    } finally {
      setTesting((current) => ({ ...current, [key]: false }))
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    setDeleteError("")
    try {
      const next = await deleteMailProvider(deleting.ID)
      update(next)
      setDeleting(null)
      toast.success(t("admin.mail.providers.deleted"))
    } catch (err) {
      setDeleteError(localizedError(err))
    } finally {
      setDeleteBusy(false)
    }
  }

  const env = settings.EnvActive ? settings.Env : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-1.5 text-base">{t("admin.mail.providers.title")}<FieldHelp text={t("admin.mail.providers.description")} /></CardTitle>
        {canWrite && <Button size="sm" onClick={() => setEditing({ id: null })}>{t("admin.mail.providers.add")}</Button>}
      </CardHeader>
      <CardContent className="space-y-4">
        {env && (
          <div className="space-y-2" data-testid="mail-env-provider">
            <Alert variant="info">{t("admin.mail.providers.envActive")}</Alert>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{t("admin.mail.providers.envName")}</p>
                <p className="truncate text-sm text-muted-foreground">{t(env.ReplyTo ? "admin.mail.envSummaryReplyTo" : "admin.mail.envSummary", { host: env.Host, port: env.Port, name: env.FromName, address: env.FromAddress, replyTo: env.ReplyTo })}</p>
              </div>
              {canWrite && <Button size="sm" variant="outline" busy={!!testing.env} onClick={() => void runTest("env", testMailTransportInUse)}>{t("admin.mail.providers.test")}</Button>}
            </div>
            {results.env && <Alert variant={results.env.Sent ? "success" : "destructive"}>{testText(results.env)}</Alert>}
          </div>
        )}

        {providers.length === 0 ? (
          <EmptyState message={t(canWrite ? "admin.mail.providers.empty" : "admin.mail.providers.emptyReadonly")} />
        ) : (
          <ul className={cn("divide-y divide-border rounded-lg border border-border", env && "opacity-60")} data-testid="mail-providers">
            {providers.map((provider, index) => (
              <ProviderRow
                key={provider.ID}
                provider={provider}
                position={index + 1}
                first={index === 0}
                last={index === providers.length - 1}
                canWrite={canWrite}
                testing={!!testing[provider.ID]}
                result={results[provider.ID]}
                onToggle={(enabled) => toggle(provider, enabled)}
                onMove={(by) => move(index, by)}
                onEdit={() => setEditing({ id: provider.ID })}
                onDelete={() => { setDeleteError(""); setDeleting(provider) }}
                onTest={() => void runTest(provider.ID, () => testMailProvider(provider.ID))}
              />
            ))}
          </ul>
        )}
        {providers.length > 0 && env && <p className="text-sm text-muted-foreground">{t("admin.mail.providers.listIgnored")}</p>}
        {providers.length > 0 && !env && settings.Source === "database" && <p className="text-xs text-muted-foreground">{t("admin.mail.providers.orderHint")}</p>}
      </CardContent>

      {editing && (
        <ProviderDialog
          key={editing.id ?? "new"}
          provider={editing.id ? providers.find((p) => p.ID === editing.id) ?? null : null}
          onClose={() => setEditing(null)}
          onSaved={(next, created) => { update(next); setEditing(null); toast.success(t(created ? "admin.mail.providers.created" : "admin.mail.providers.saved")) }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onCancel={() => setDeleting(null)}
        tone="danger"
        title={t("admin.mail.providers.deleteTitle", { name: deleting?.Name ?? "" })}
        description={t("admin.mail.providers.deleteBody")}
        cancelLabel={t("admin.mail.cancel")}
        confirmLabel={t("admin.mail.providers.deleteConfirm")}
        busy={deleteBusy}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </Card>
  )
}

function ProviderRow({ provider, position, first, last, canWrite, testing, result, onToggle, onMove, onEdit, onDelete, onTest }: {
  provider: MailProvider
  position: number
  first: boolean
  last: boolean
  canWrite: boolean
  testing: boolean
  result?: MailTestResult
  onToggle: (enabled: boolean) => void
  onMove: (by: -1 | 1) => void
  onEdit: () => void
  onDelete: () => void
  onTest: () => void
}) {
  const limit = provider.DailyLimit
  const share = limit ? Math.min(100, Math.round((provider.SentToday / limit) * 100)) : 0
  return (
    <li className="space-y-2 px-4 py-3" data-testid={`mail-provider-${provider.ID}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium text-muted-foreground" aria-label={t("admin.mail.providers.position", { n: position })}>{position}</span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-foreground">
            <span className="truncate">{provider.Name}</span>
            {!provider.Enabled && <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{t("admin.mail.providers.off")}</span>}
          </p>
          <p className="truncate text-sm text-muted-foreground">{provider.Host}:{provider.Port}</p>
        </div>
        <div className="basis-56 space-y-1 text-xs text-muted-foreground" data-testid="mail-provider-usage">
          <p>
            {limit
              ? t("admin.mail.providers.usage", { sent: provider.SentToday, limit })
              : t("admin.mail.providers.usageNoLimit", { sent: provider.SentToday })}
          </p>
          {limit ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(provider.SentToday, limit)} aria-label={t("admin.mail.providers.usageLabel", { name: provider.Name })}>
              <div className={cn("h-full rounded-full", provider.Exhausted ? "bg-destructive" : "bg-[var(--ib-action)]")} style={{ width: `${share}%` }} />
            </div>
          ) : null}
          {provider.Exhausted && <p className="text-destructive">{t("admin.mail.providers.exhausted", { date: dateText(provider.ResetsAt) })}</p>}
        </div>
        <div className="flex items-center gap-1">
          <Switch checked={provider.Enabled} onCheckedChange={onToggle} disabled={!canWrite} aria-label={t("admin.mail.providers.enabledLabel", { name: provider.Name })} />
          {canWrite && (
            <>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={first} aria-label={t("admin.mail.providers.moveUp", { name: provider.Name })} onClick={() => onMove(-1)}><ChevronUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={last} aria-label={t("admin.mail.providers.moveDown", { name: provider.Name })} onClick={() => onMove(1)}><ChevronDown className="h-4 w-4" /></Button>
              <Button type="button" variant="outline" size="sm" busy={testing} aria-label={t("admin.mail.providers.testVia", { name: provider.Name })} onClick={onTest}>{t("admin.mail.providers.test")}</Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("admin.mail.providers.edit", { name: provider.Name })} onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("admin.mail.providers.delete", { name: provider.Name })} onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      </div>
      {provider.LastError && provider.LastErrorAt && (
        <p className="break-words text-xs text-destructive" data-testid="mail-provider-error">{t("admin.mail.providers.lastError", { date: dateText(provider.LastErrorAt), error: provider.LastError })}</p>
      )}
      {result && <Alert variant={result.Sent ? "success" : "destructive"}>{testText(result)}</Alert>}
    </li>
  )
}

function ProviderDialog({ provider, onClose, onSaved }: {
  provider: MailProvider | null
  onClose: () => void
  onSaved: (next: MailSettings, created: boolean) => void
}) {
  const [form, setForm] = useState<ProviderForm>(() => (provider ? formFrom(provider) : EMPTY_FORM))
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [testingForm, setTestingForm] = useState(false)
  const [result, setResult] = useState<MailTestResult | null>(null)

  function change<K extends keyof ProviderForm>(key: K, value: ProviderForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    const invalid = validate(form)
    if (invalid) { setError(invalid); return }
    setSaving(true)
    setError("")
    try {
      const input = inputFrom(form)
      const next = provider ? await saveMailProvider(provider.ID, input) : await createMailProvider(input)
      onSaved(next, !provider)
    } catch (err) {
      setError(localizedError(err))
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    const invalid = validate(form)
    if (invalid) { setError(invalid); return }
    setTestingForm(true)
    setError("")
    setResult(null)
    try {
      setResult(await testMailProviderForm(inputFrom(form), provider?.ID))
    } catch (err) {
      setError(localizedError(err))
    } finally {
      setTestingForm(false)
    }
  }

  const passwordSet = !!provider?.PasswordSet

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{provider ? t("admin.mail.providers.editTitle", { name: provider.Name }) : t("admin.mail.providers.addTitle")}</DialogTitle>
          <DialogDescription>{t("admin.mail.providers.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="mail-provider-name" label={t("admin.mail.providers.name")} required>
            <Input id="mail-provider-name" value={form.Name} maxLength={MAIL_NAME_MAX} onChange={(event) => change("Name", event.target.value)} autoComplete="off" />
          </Field>
          <Field id="mail-host" label={t("admin.mail.host")} required>
            <Input id="mail-host" value={form.Host} onChange={(event) => change("Host", event.target.value)} placeholder="email-smtp.eu-central-1.amazonaws.com" autoComplete="off" />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
            <Field id="mail-port" label={t("admin.mail.port")} required>
              <Input id="mail-port" type="number" min={1} max={65535} value={form.Port} onChange={(event) => change("Port", event.target.value)} />
            </Field>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium">{t("admin.mail.encryption")}</span>
              <SelectMenu
                value={form.TLSMode}
                onChange={(value) => {
                  change("TLSMode", value as MailTLSMode)
                  if (value === "tls" && form.Port === "587") change("Port", "465")
                  if (value === "starttls" && form.Port === "465") change("Port", "587")
                }}
                options={TLS_OPTIONS}
                ariaLabel={t("admin.mail.encryption")}
                className="w-full"
              />
            </div>
          </div>
          <Field id="mail-username" label={t("admin.mail.username")}>
            <Input id="mail-username" value={form.Username} onChange={(event) => change("Username", event.target.value)} autoComplete="off" />
          </Field>
          <Field id="mail-password" label={t("admin.mail.password")}>
            {form.ClearPassword ? (
              <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-border bg-secondary px-3 text-sm">
                <span className="text-muted-foreground">{t("admin.mail.passwordWillClear")}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => change("ClearPassword", false)}>{t("admin.mail.cancel")}</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <PasswordInput id="mail-password" value={form.Password} onChange={(event) => change("Password", event.target.value)} autoComplete="new-password" placeholder={passwordSet ? t("admin.mail.passwordSet") : ""} />
                {passwordSet && <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => { change("ClearPassword", true); change("Password", "") }}>{t("admin.mail.clearPassword")}</Button>}
              </div>
            )}
            {passwordSet && !form.ClearPassword && <p className="text-xs text-muted-foreground">{t("admin.mail.passwordKeepHint")}</p>}
          </Field>
          <Field id="mail-max-per-second" label={t("admin.mail.maxPerSecond")} help={t("admin.mail.maxPerSecondHelp")}>
            <NumberInput id="mail-max-per-second" decimal value={form.MaxPerSecond} onChange={(value) => change("MaxPerSecond", value)} placeholder={t("admin.mail.limitPlaceholder")} />
          </Field>
          <Field id="mail-daily-quota" label={t("admin.mail.providers.dailyLimit")} help={t("admin.mail.providers.dailyLimitHelp")}>
            <NumberInput id="mail-daily-quota" value={form.DailyQuota} onChange={(value) => change("DailyQuota", value)} placeholder={t("admin.mail.limitPlaceholder")} />
          </Field>
        </div>

        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">{t("admin.mail.providers.senderTitle")}<FieldHelp text={t("admin.mail.providers.senderHelp")} /></h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="mail-provider-sender-name" label={t("admin.mail.senderName")}>
              <Input id="mail-provider-sender-name" value={form.SenderName} maxLength={MAIL_NAME_MAX} onChange={(event) => change("SenderName", event.target.value)} autoComplete="off" />
            </Field>
            <Field id="mail-provider-sender-address" label={t("admin.mail.senderAddress")}>
              <Input id="mail-provider-sender-address" type="email" value={form.SenderAddress} onChange={(event) => change("SenderAddress", event.target.value)} autoComplete="off" />
            </Field>
            <Field id="mail-provider-reply-name" label={t("admin.mail.providers.replyToName")}>
              <Input id="mail-provider-reply-name" value={form.ReplyToName} maxLength={MAIL_NAME_MAX} onChange={(event) => change("ReplyToName", event.target.value)} autoComplete="off" />
            </Field>
            <Field id="mail-provider-reply-address" label={t("admin.mail.providers.replyToAddress")}>
              <Input id="mail-provider-reply-address" type="email" value={form.ReplyToAddress} onChange={(event) => change("ReplyToAddress", event.target.value)} autoComplete="off" />
            </Field>
          </div>
        </section>

        {result && <Alert variant={result.Sent ? "success" : "destructive"}>{testText(result)}</Alert>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">{t("admin.mail.testHint")}</p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{t("admin.mail.cancel")}</Button>
          <Button type="button" variant="outline" busy={testingForm} onClick={() => void test()}>{t("admin.mail.test")}</Button>
          <Button type="button" busy={saving} onClick={() => void save()}>{t("admin.mail.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ id, label, help, required, children }: { id: string; label: string; help?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="block text-sm font-medium">{label}</label>
        {required && <span aria-hidden="true" className="-ml-1 text-sm text-destructive">*</span>}
        {help && <FieldHelp text={help} />}
      </div>
      {children}
    </div>
  )
}
