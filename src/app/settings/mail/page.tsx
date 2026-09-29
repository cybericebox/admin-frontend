"use client"
import { useCallback, useEffect, useState } from "react"
import { MAIL_NAME_MAX, getMailSettings, isValidEmail, resetMailSmtp, saveMailIdentity, saveMailSmtp, testMailSmtp, type MailSettings, type MailSmtpInput, type MailTLSMode, type MailTestResult } from "@/api/mail/settings"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { MailFooterCard } from "@/components/settings/MailFooterCard"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import { useRole } from "@/lib/useRole"
import { mailTransportLabel } from "@/utils/notifType"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { FieldHelp } from "@/components/ui/field-help"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { SelectMenu } from "@/components/ui/select-menu"
import { LoadingArea } from "@/components/ui/spinner"
import { LoadError } from "@/components/ui/load-error"

const TLS_OPTIONS: { value: MailTLSMode; label: string }[] = [
  { value: "starttls", label: "STARTTLS (587)" },
  { value: "tls", label: "TLS (465)" },
]

const SOURCE_LABEL_KEY = {
  database: "admin.mail.source.database",
  env: "admin.mail.source.env",
  none: "admin.mail.source.none",
} as const

type SmtpForm = Omit<MailSmtpInput, "Port"> & { Port: string }
type IdentityForm = { SenderName: string; SenderAddress: string; ReplyToName: string; ReplyToAddress: string }
type Busy = "" | "identity" | "save" | "test" | "reset"

function identityFrom(settings: MailSettings): IdentityForm {
  const { Sender, ReplyTo } = settings.Identity
  return { SenderName: Sender.Name, SenderAddress: Sender.Address, ReplyToName: ReplyTo.Name, ReplyToAddress: ReplyTo.Address }
}

// The SMTP form starts from the stored row. With the env fallback active it is
// prefilled from the env summary so saving moves that config into the
// database — the env password is never exposed, so it has to be typed in.
function smtpFrom(settings: MailSettings): SmtpForm {
  const env = settings.Source === "env" ? settings.Env : null
  const stored = settings.SMTP
  const port = env ? env.Port : stored?.Port ?? 0
  const tls: MailTLSMode = (stored?.TLSMode || "") || (port === 465 ? "tls" : "starttls")
  return {
    Host: env ? env.Host : stored?.Host ?? "",
    Port: port ? String(port) : "587",
    TLSMode: tls,
    Username: env ? "" : stored?.Username ?? "",
    Password: "",
    ClearPassword: false,
  }
}

function validateIdentity(form: IdentityForm): string {
  if (form.SenderName.trim().length > MAIL_NAME_MAX || form.ReplyToName.trim().length > MAIL_NAME_MAX) return t("admin.mail.error.nameTooLong", { max: MAIL_NAME_MAX })
  if (!isValidEmail(form.SenderAddress.trim()) || !isValidEmail(form.ReplyToAddress.trim())) return t("admin.mail.error.emailInvalid")
  return ""
}

function validateSmtp(form: SmtpForm): string {
  if (!form.Host.trim()) return t("admin.mail.error.hostRequired")
  const port = Number(form.Port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return t("admin.mail.error.portInvalid")
  return ""
}

function smtpInput(form: SmtpForm): MailSmtpInput {
  return {
    Host: form.Host.trim(),
    Port: Number(form.Port),
    TLSMode: form.TLSMode,
    Username: form.Username.trim(),
    Password: form.ClearPassword ? "" : form.Password,
    ClearPassword: form.ClearPassword,
  }
}

export default function Page() {
  const { can } = useRole()
  const allowed = can("platform.settings.read")
  const canWrite = can("platform.settings.write")
  const [settings, setSettings] = useState<MailSettings | null>(null)
  const [identity, setIdentity] = useState<IdentityForm | null>(null)
  const [smtp, setSmtp] = useState<SmtpForm | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState<Busy>("")
  const [testResult, setTestResult] = useState<MailTestResult | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const apply = useCallback((next: MailSettings, part: "all" | "identity" | "smtp" = "all") => {
    setSettings(next)
    if (part !== "smtp") setIdentity(identityFrom(next))
    if (part !== "identity") setSmtp(smtpFrom(next))
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

  function changeIdentity<K extends keyof IdentityForm>(key: K, value: IdentityForm[K]) {
    setIdentity((current) => current && { ...current, [key]: value })
    setNotice("")
  }

  function changeSmtp<K extends keyof SmtpForm>(key: K, value: SmtpForm[K]) {
    setSmtp((current) => current && { ...current, [key]: value })
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

  function saveIdentity() {
    if (!identity) return
    const invalid = validateIdentity(identity)
    if (invalid) { setError(invalid); return }
    void run("identity", async () => {
      // Only the identity part is refreshed: unsaved SMTP edits stay in the form.
      apply(await saveMailIdentity({
        Sender: { Name: identity.SenderName.trim(), Address: identity.SenderAddress.trim() },
        ReplyTo: { Name: identity.ReplyToName.trim(), Address: identity.ReplyToAddress.trim() },
      }), "identity")
      setNotice(t("admin.mail.identitySaved"))
    })
  }

  function saveSmtp() {
    if (!smtp) return
    const invalid = validateSmtp(smtp)
    if (invalid) { setError(invalid); return }
    void run("save", async () => {
      apply(await saveMailSmtp(smtpInput(smtp)), "smtp")
      setNotice(t("admin.mail.saved"))
    })
  }

  function test() {
    if (!smtp) return
    const invalid = validateSmtp(smtp)
    if (invalid) { setError(invalid); return }
    setTestResult(null)
    void run("test", async () => { setTestResult(await testMailSmtp(smtpInput(smtp))) })
  }

  function reset() {
    setConfirmReset(false)
    setTestResult(null)
    void run("reset", async () => {
      apply(await resetMailSmtp(), "smtp")
      setNotice(t("admin.mail.resetDone"))
    })
  }

  const disabled = !canWrite || busy !== ""
  const effective = settings?.Effective
  const sendingDomain = settings?.SendingDomain || ""

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
          <LoadError message={t("admin.mail.loadError")} onRetry={() => void load()} className="flex-1" />
        ) : !settings || !identity || !smtp || !effective ? (
          <LoadingArea className="flex-1" label={t("admin.loading")} />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("admin.mail.senderTitle")}</CardTitle>
                <CardDescription>{t("admin.mail.senderDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field id="mail-sender-name" label={t("admin.mail.senderName")} help={t("admin.mail.senderNameHelp")}><Input id="mail-sender-name" value={identity.SenderName} maxLength={MAIL_NAME_MAX} onChange={(event) => changeIdentity("SenderName", event.target.value)} disabled={disabled} placeholder={effective.Sender.Name} autoComplete="off" /></Field>
                  <Field id="mail-sender-address" label={t("admin.mail.senderAddress")} help={t("admin.mail.senderAddressHelp")}><Input id="mail-sender-address" type="email" value={identity.SenderAddress} onChange={(event) => changeIdentity("SenderAddress", event.target.value)} disabled={disabled} placeholder={effective.Sender.Address} autoComplete="off" /></Field>
                </div>
                <div className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">{t("admin.mail.replyToTitle")}<FieldHelp text={t("admin.mail.replyToHelp")} /></h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field id="mail-reply-to-name" label={t("admin.mail.replyToName")}><Input id="mail-reply-to-name" value={identity.ReplyToName} maxLength={MAIL_NAME_MAX} onChange={(event) => changeIdentity("ReplyToName", event.target.value)} disabled={disabled} placeholder={effective.ReplyTo.Name} autoComplete="off" /></Field>
                    <Field id="mail-reply-to-address" label={t("admin.mail.replyToAddress")}><Input id="mail-reply-to-address" type="email" value={identity.ReplyToAddress} onChange={(event) => changeIdentity("ReplyToAddress", event.target.value)} disabled={disabled} placeholder={effective.ReplyTo.Address} autoComplete="off" /></Field>
                  </div>
                </div>
                <div className="rounded-md bg-[var(--ib-soft)] p-3 text-sm">
                  <p className="text-foreground">{t("admin.mail.sendingDomain")} <span className="font-mono">{sendingDomain || "—"}</span></p>
                  <p className="mt-1 text-muted-foreground">{t("admin.mail.eventSenderHint", { domain: sendingDomain || t("admin.mail.domainPlaceholder") })}</p>
                </div>
                <RequirePermission perm="platform.settings.write">
                  <Button onClick={saveIdentity} disabled={busy !== ""} busy={busy === "identity"}>{t("admin.mail.save")}</Button>
                </RequirePermission>
              </CardContent>
            </Card>

            <MailFooterCard footer={settings.Footer} canWrite={canWrite} onSaved={(next) => setSettings((current) => current && { ...current, Footer: next.Footer })} />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("admin.mail.smtpTitle")}</CardTitle>
                <CardDescription>{t("admin.mail.smtpDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm">
                  <p className={settings.Source === "none" ? "font-medium text-destructive" : "font-medium text-foreground"} data-testid="mail-source">{settings.Source in SOURCE_LABEL_KEY ? t(SOURCE_LABEL_KEY[settings.Source]) : settings.Source}</p>
                  {settings.Source === "database" && settings.SMTP?.UpdatedAt && <p className="text-muted-foreground">{t("admin.mail.updatedAt", { date: new Date(settings.SMTP.UpdatedAt).toLocaleString("uk-UA") })}</p>}
                  {settings.Source === "env" && settings.Env && (
                    <p className="text-muted-foreground">
                      {t(settings.Env.ReplyTo ? "admin.mail.envSummaryReplyTo" : "admin.mail.envSummary", { host: settings.Env.Host, port: settings.Env.Port, name: settings.Env.FromName, address: settings.Env.FromAddress, replyTo: settings.Env.ReplyTo })}
                    </p>
                  )}
                  {settings.Source === "env" && <p className="text-muted-foreground">{t("admin.mail.envHint")}</p>}
                  {settings.Source === "none" && <p className="text-muted-foreground">{t("admin.mail.noneHint")}</p>}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field id="mail-host" label={t("admin.mail.host")} required><Input id="mail-host" value={smtp.Host} onChange={(event) => changeSmtp("Host", event.target.value)} disabled={disabled} placeholder="email-smtp.eu-central-1.amazonaws.com" autoComplete="off" /></Field>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
                    <Field id="mail-port" label={t("admin.mail.port")} required><Input id="mail-port" type="number" min={1} max={65535} value={smtp.Port} onChange={(event) => changeSmtp("Port", event.target.value)} disabled={disabled} /></Field>
                    <div className="space-y-1.5"><span className="block text-sm font-medium">{t("admin.mail.encryption")}</span><SelectMenu value={smtp.TLSMode} onChange={(value) => { changeSmtp("TLSMode", value as MailTLSMode); if (value === "tls" && smtp.Port === "587") changeSmtp("Port", "465"); if (value === "starttls" && smtp.Port === "465") changeSmtp("Port", "587") }} options={TLS_OPTIONS} ariaLabel={t("admin.mail.encryption")} disabled={disabled} className="w-full" /></div>
                  </div>
                  <Field id="mail-username" label={t("admin.mail.username")}><Input id="mail-username" value={smtp.Username} onChange={(event) => changeSmtp("Username", event.target.value)} disabled={disabled} autoComplete="off" /></Field>
                  <Field id="mail-password" label={t("admin.mail.password")}>
                    {smtp.ClearPassword ? (
                      <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-border bg-secondary px-3 text-sm">
                        <span className="text-muted-foreground">{t("admin.mail.passwordWillClear")}</span>
                        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => changeSmtp("ClearPassword", false)}>{t("admin.mail.cancel")}</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <PasswordInput id="mail-password" value={smtp.Password} onChange={(event) => changeSmtp("Password", event.target.value)} disabled={disabled} autoComplete="new-password" placeholder={settings.SMTP?.PasswordSet ? t("admin.mail.passwordSet") : ""} />
                        {settings.SMTP?.PasswordSet && canWrite && <Button type="button" variant="outline" className="h-10 shrink-0" disabled={disabled} onClick={() => { changeSmtp("ClearPassword", true); changeSmtp("Password", "") }}>{t("admin.mail.clearPassword")}</Button>}
                      </div>
                    )}
                    {settings.SMTP?.PasswordSet && !smtp.ClearPassword && <p className="text-xs text-muted-foreground">{t("admin.mail.passwordKeepHint")}</p>}
                  </Field>
                </div>

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
                    <Button onClick={saveSmtp} disabled={busy !== ""} busy={busy === "save"}>{t("admin.mail.save")}</Button>
                    <Button variant="outline" onClick={test} disabled={busy !== ""} busy={busy === "test"}>{t("admin.mail.test")}</Button>
                    {settings.Source === "database" && <Button variant="outline" className="sm:ml-auto" onClick={() => setConfirmReset(true)} disabled={busy !== ""} busy={busy === "reset"}>{t("admin.mail.reset")}</Button>}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("admin.mail.testHint")}</p>
                </RequirePermission>
              </CardContent>
            </Card>

            {error && <p role="alert" className="rounded-md bg-[var(--ib-danger-bg)] p-3 text-sm text-[var(--ib-danger)]">{error}</p>}
            {notice && <p role="status" className="rounded-md bg-[var(--ib-ok-bg)] p-3 text-sm text-foreground">{notice}</p>}
          </>
        )}
      </div>

      <ConfirmDialog open={confirmReset} onCancel={() => setConfirmReset(false)} tone="danger"
        title={t("admin.mail.resetConfirmTitle")} description={t("admin.mail.resetConfirmBody")}
        cancelLabel={t("admin.mail.cancel")} confirmLabel={t("admin.mail.resetConfirm")} onConfirm={reset} />
    </RequirePermission>
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
