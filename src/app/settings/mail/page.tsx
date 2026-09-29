"use client"
import { useCallback, useEffect, useState } from "react"
import { domainOf, getMailSettings, resetMailSettings, saveMailSettings, testMailSettings, type MailSettings, type MailSettingsInput, type MailTLSMode, type MailTestResult } from "@/api/mail/settings"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import { useRole } from "@/lib/useRole"
import { mailTransportLabel } from "@/utils/notifType"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { SelectMenu } from "@/components/ui/select-menu"
import { LoadingArea } from "@/components/ui/spinner"

const DEFAULT_FROM_NAME = "CyberICEBox"
const FROM_ADDRESS_EXAMPLE = "notifications@mail.cybericebox.com"
const REPLY_TO_EXAMPLE = "support@cybericebox.com"

const TLS_OPTIONS: { value: MailTLSMode; label: string }[] = [
  { value: "starttls", label: "STARTTLS (587)" },
  { value: "tls", label: "TLS (465)" },
]

const SOURCE_LABEL_KEY = {
  database: "admin.mail.source.database",
  env: "admin.mail.source.env",
  none: "admin.mail.source.none",
} as const

type Form = Omit<MailSettingsInput, "Port"> & { Port: string }
type Busy = "" | "save" | "test" | "reset"

// The form starts from the stored platform row. With the env fallback active it
// is prefilled from the env summary so saving moves that config into the
// database — the env password is never exposed, so it has to be typed in.
function formFrom(settings: MailSettings): Form {
  const env = settings.Source === "env" ? settings.Env : null
  const port = env ? env.Port : settings.Port
  const tls: MailTLSMode = settings.TLSMode || (port === 465 ? "tls" : "starttls")
  return {
    Host: env ? env.Host : settings.Host,
    Port: port ? String(port) : "587",
    TLSMode: tls,
    Username: env ? "" : settings.Username,
    Password: "",
    ClearPassword: false,
    FromName: (env ? env.FromName : settings.FromName) || DEFAULT_FROM_NAME,
    FromAddress: env ? env.FromAddress : settings.FromAddress,
    ReplyTo: env ? env.ReplyTo : settings.ReplyTo,
  }
}

function validate(form: Form): string {
  if (!form.Host.trim()) return t("admin.mail.error.hostRequired")
  const port = Number(form.Port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return t("admin.mail.error.portInvalid")
  if (form.FromAddress.trim() && !domainOf(form.FromAddress)) return t("admin.mail.error.fromDomain")
  return ""
}

function toInput(form: Form): MailSettingsInput {
  return {
    Host: form.Host.trim(),
    Port: Number(form.Port),
    TLSMode: form.TLSMode,
    Username: form.Username.trim(),
    Password: form.ClearPassword ? "" : form.Password,
    ClearPassword: form.ClearPassword,
    FromName: form.FromName.trim(),
    FromAddress: form.FromAddress.trim(),
    ReplyTo: form.ReplyTo.trim(),
  }
}

export default function Page() {
  const { can } = useRole()
  const allowed = can("platform.settings.read")
  const canWrite = can("platform.settings.write")
  const [settings, setSettings] = useState<MailSettings | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState<Busy>("")
  const [testResult, setTestResult] = useState<MailTestResult | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const apply = useCallback((next: MailSettings) => {
    setSettings(next)
    setForm(formFrom(next))
  }, [])

  const load = useCallback(async () => {
    setLoadError(false)
    try {
      apply(await getMailSettings())
    } catch {
      setLoadError(true)
    }
  }, [apply])

  useEffect(() => { if (allowed) queueMicrotask(() => void load()) }, [allowed, load])

  function change<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => current && { ...current, [key]: value })
    setNotice("")
  }

  async function run(kind: Exclude<Busy, "">, action: () => Promise<void>) {
    setBusy(kind)
    setError("")
    setNotice("")
    try {
      await action()
    } catch (err) {
      setError(localizedError(err))
    } finally {
      setBusy("")
    }
  }

  function save() {
    if (!form) return
    const invalid = validate(form)
    if (invalid) { setError(invalid); return }
    void run("save", async () => {
      apply(await saveMailSettings(toInput(form)))
      setNotice(t("admin.mail.saved"))
    })
  }

  function test() {
    if (!form) return
    const invalid = validate(form)
    if (invalid) { setError(invalid); return }
    setTestResult(null)
    void run("test", async () => { setTestResult(await testMailSettings(toInput(form))) })
  }

  function reset() {
    setConfirmReset(false)
    setTestResult(null)
    void run("reset", async () => {
      apply(await resetMailSettings())
      setNotice(t("admin.mail.resetDone"))
    })
  }

  const disabled = !canWrite || busy !== ""
  const sendingDomain = (form && domainOf(form.FromAddress)) || settings?.SendingDomain || ""

  return (
    <RequirePermission
      perm="platform.settings.read"
      fallback={<div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">{t("admin.settings.noAccess")}</div>}
    >
      <div className="flex min-h-full flex-col gap-5">
        <SettingsTabs />
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t("admin.mail.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.mail.description")}</p>
        </div>

        {loadError ? (
          <Card><CardContent className="flex flex-col items-center gap-3 pt-5"><p role="alert" className="text-sm text-destructive">{t("admin.mail.loadError")}</p><Button variant="outline" onClick={() => void load()}>{t("error.retry")}</Button></CardContent></Card>
        ) : !settings || !form ? (
          <LoadingArea className="flex-1" label={t("admin.loading")} />
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("admin.mail.sourceTitle")}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className={settings.Source === "none" ? "font-medium text-destructive" : "font-medium text-foreground"} data-testid="mail-source">{settings.Source in SOURCE_LABEL_KEY ? t(SOURCE_LABEL_KEY[settings.Source]) : settings.Source}</p>
                {settings.Source === "database" && settings.UpdatedAt && <p className="text-muted-foreground">{t("admin.mail.updatedAt", { date: new Date(settings.UpdatedAt).toLocaleString("uk-UA") })}</p>}
                {settings.Source === "env" && settings.Env && (
                  <p className="text-muted-foreground">
                    {t(settings.Env.ReplyTo ? "admin.mail.envSummaryReplyTo" : "admin.mail.envSummary", { host: settings.Env.Host, port: settings.Env.Port, name: settings.Env.FromName, address: settings.Env.FromAddress, replyTo: settings.Env.ReplyTo })}
                  </p>
                )}
                {settings.Source === "env" && <p className="text-muted-foreground">{t("admin.mail.envHint")}</p>}
                {settings.Source === "none" && <p className="text-muted-foreground">{t("admin.mail.noneHint")}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{t("admin.mail.smtpTitle")}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field id="mail-host" label={t("admin.mail.host")}><Input id="mail-host" value={form.Host} onChange={(event) => change("Host", event.target.value)} disabled={disabled} placeholder="email-smtp.eu-central-1.amazonaws.com" autoComplete="off" /></Field>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
                  <Field id="mail-port" label={t("admin.mail.port")}><Input id="mail-port" type="number" min={1} max={65535} value={form.Port} onChange={(event) => change("Port", event.target.value)} disabled={disabled} /></Field>
                  <div className="space-y-1.5"><span className="block text-sm font-medium">{t("admin.mail.encryption")}</span><SelectMenu value={form.TLSMode} onChange={(value) => { change("TLSMode", value as MailTLSMode); if (value === "tls" && form.Port === "587") change("Port", "465"); if (value === "starttls" && form.Port === "465") change("Port", "587") }} options={TLS_OPTIONS} ariaLabel={t("admin.mail.encryption")} disabled={disabled} className="w-full" /></div>
                </div>
                <Field id="mail-username" label={t("admin.mail.username")}><Input id="mail-username" value={form.Username} onChange={(event) => change("Username", event.target.value)} disabled={disabled} autoComplete="off" /></Field>
                <Field id="mail-password" label={t("admin.mail.password")}>
                  {form.ClearPassword ? (
                    <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-border bg-secondary px-3 text-sm">
                      <span className="text-muted-foreground">{t("admin.mail.passwordWillClear")}</span>
                      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => change("ClearPassword", false)}>{t("admin.mail.cancel")}</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <PasswordInput id="mail-password" value={form.Password} onChange={(event) => change("Password", event.target.value)} disabled={disabled} autoComplete="new-password" placeholder={settings.PasswordSet ? t("admin.mail.passwordSet") : ""} />
                      {settings.PasswordSet && canWrite && <Button type="button" variant="outline" className="h-10 shrink-0" disabled={disabled} onClick={() => { change("ClearPassword", true); change("Password", "") }}>{t("admin.mail.clearPassword")}</Button>}
                    </div>
                  )}
                  {settings.PasswordSet && !form.ClearPassword && <p className="text-xs text-muted-foreground">{t("admin.mail.passwordKeepHint")}</p>}
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("admin.mail.senderTitle")}</CardTitle>
                <CardDescription>{t("admin.mail.senderDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field id="mail-from-name" label={t("admin.mail.fromName")}><Input id="mail-from-name" value={form.FromName} onChange={(event) => change("FromName", event.target.value)} disabled={disabled} placeholder={DEFAULT_FROM_NAME} /></Field>
                  <Field id="mail-from-address" label={t("admin.mail.fromAddress")}><Input id="mail-from-address" type="email" value={form.FromAddress} onChange={(event) => change("FromAddress", event.target.value)} disabled={disabled} placeholder={FROM_ADDRESS_EXAMPLE} /></Field>
                  <Field id="mail-reply-to" label={t("admin.mail.replyTo")}><Input id="mail-reply-to" type="email" value={form.ReplyTo} onChange={(event) => change("ReplyTo", event.target.value)} disabled={disabled} placeholder={REPLY_TO_EXAMPLE} /></Field>
                </div>
                <div className="rounded-md bg-[var(--ib-soft)] p-3 text-sm">
                  <p className="text-foreground">{t("admin.mail.sendingDomain")} <span className="font-mono">{sendingDomain || "—"}</span></p>
                  <p className="mt-1 text-muted-foreground">{t("admin.mail.eventSenderHint", { domain: sendingDomain || t("admin.mail.domainPlaceholder") })}</p>
                </div>
              </CardContent>
            </Card>

            {error && <p role="alert" className="rounded-md bg-[var(--ib-danger-bg)] p-3 text-sm text-[var(--ib-danger)]">{error}</p>}
            {notice && <p role="status" className="rounded-md bg-[var(--ib-ok-bg)] p-3 text-sm text-foreground">{notice}</p>}
            {testResult && (
              <Alert variant={testResult.Sent ? "success" : "destructive"}>
                {testResult.Sent
                  ? testResult.Transport
                    ? t("admin.mail.test.sentVia", { recipient: testResult.Recipient, transport: mailTransportLabel(testResult.Transport) })
                    : t("admin.mail.test.sent", { recipient: testResult.Recipient })
                  : t(testResult.Recipient ? "admin.mail.test.failedTo" : "admin.mail.test.failed", { recipient: testResult.Recipient, error: testResult.Error || t("admin.mail.test.unknownError") })}
              </Alert>
            )}

            <RequirePermission perm="platform.settings.write">
              <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={busy !== ""} busy={busy === "save"}>{t("admin.mail.save")}</Button>
                <Button variant="outline" onClick={test} disabled={busy !== ""} busy={busy === "test"}>{t("admin.mail.test")}</Button>
                {settings.Source === "database" && <Button variant="outline" className="sm:ml-auto" onClick={() => setConfirmReset(true)} disabled={busy !== ""} busy={busy === "reset"}>{t("admin.mail.reset")}</Button>}
              </div>
              <p className="text-xs text-muted-foreground">{t("admin.mail.testHint")}</p>
            </RequirePermission>
          </>
        )}
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.mail.resetConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("admin.mail.resetConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>{t("admin.mail.cancel")}</Button>
            <Button variant="destructive" onClick={reset}>{t("admin.mail.resetConfirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequirePermission>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label htmlFor={id} className="block text-sm font-medium">{label}</label>{children}</div>
}
