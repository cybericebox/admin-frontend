"use client"
import { useCallback, useEffect, useState } from "react"
import { MAIL_NAME_MAX, getMailSettings, isValidEmail, isValidSendingDomain, saveMailIdentity, type MailFieldSource, type MailSettings } from "@/api/mail/settings"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { NoAccess } from "@/components/common/NoAccess"
import { PageHeader } from "@/components/ui/page-header"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { MailFooterCard } from "@/components/settings/MailFooterCard"
import { MailProvidersCard } from "@/components/settings/MailProvidersCard"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import { useRole } from "@/lib/useRole"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldHelp } from "@/components/ui/field-help"
import { Input } from "@/components/ui/input"
import { LoadingArea } from "@/components/ui/spinner"
import { LoadError } from "@/components/ui/load-error"

type IdentityForm = { SenderName: string; SenderAddress: string; ReplyToName: string; ReplyToAddress: string; SendingDomain: string }

function identityFrom(settings: MailSettings): IdentityForm {
  const { Sender, ReplyTo } = settings.Identity
  return { SenderName: Sender.Name, SenderAddress: Sender.Address, ReplyToName: ReplyTo.Name, ReplyToAddress: ReplyTo.Address, SendingDomain: settings.SavedSendingDomain }
}

function validateIdentity(form: IdentityForm): string {
  if (form.SenderName.trim().length > MAIL_NAME_MAX || form.ReplyToName.trim().length > MAIL_NAME_MAX) return t("admin.mail.error.nameTooLong", { max: MAIL_NAME_MAX })
  if (!isValidEmail(form.SenderAddress.trim()) || !isValidEmail(form.ReplyToAddress.trim())) return t("admin.mail.error.emailInvalid")
  if (!isValidSendingDomain(form.SendingDomain.trim().toLowerCase())) return t("admin.mail.error.domainInvalid")
  return ""
}

export default function Page() {
  const { can } = useRole()
  const allowed = can("platform.settings.read")
  const canWrite = can("platform.settings.write")
  const [settings, setSettings] = useState<MailSettings | null>(null)
  const [identity, setIdentity] = useState<IdentityForm | null>(null)
  const [loadError, setLoadError] = useState<{ cause: unknown } | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  // The save busies only its own button: nothing else on the page is disabled while it runs.
  const [identityBusy, setIdentityBusy] = useState(false)

  const apply = useCallback((next: MailSettings) => {
    setSettings(next)
    setIdentity(identityFrom(next))
  }, [])

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      apply(await getMailSettings())
    } catch (cause) {
      setLoadError({ cause })
    }
  }, [apply])

  useEffect(() => { if (allowed) queueMicrotask(() => void load()) }, [allowed, load])

  function changeIdentity<K extends keyof IdentityForm>(key: K, value: IdentityForm[K]) {
    setIdentity((current) => current && { ...current, [key]: value })
    setNotice("")
  }

  function saveIdentity() {
    if (!identity) return
    const invalid = validateIdentity(identity)
    if (invalid) { setError(invalid); return }
    setIdentityBusy(true)
    setError("")
    setNotice("")
    saveMailIdentity({
      Sender: { Name: identity.SenderName.trim(), Address: identity.SenderAddress.trim() },
      ReplyTo: { Name: identity.ReplyToName.trim(), Address: identity.ReplyToAddress.trim() },
      SendingDomain: identity.SendingDomain.trim().toLowerCase(),
    }).then((next) => {
      // Only the sender part is refreshed: the providers list may hold changes still being saved.
      setSettings((current) => ({ ...next, Providers: current?.Providers ?? next.Providers }))
      setIdentity(identityFrom(next))
      setNotice(t("admin.mail.identitySaved"))
    }).catch((err) => setError(localizedError(err))).finally(() => setIdentityBusy(false))
  }

  // A failed instant change of the providers list re-reads the settings: only the list is replaced, the sender form keeps its edits.
  const reloadProviders = useCallback(async () => {
    const next = await getMailSettings()
    setSettings((current) => current && { ...current, Providers: next.Providers })
  }, [])

  const disabled = !canWrite
  const effective = settings?.Effective
  const sendingDomain = settings?.SendingDomain || ""

  return (
    <RequirePermission
      perm="platform.settings.read"
      fallback={<NoAccess message={t("admin.settings.noAccess")} />}
    >
      <div className="flex min-h-full flex-col gap-5">
        <PageHeader title={t("admin.mail.title")} sub={t("admin.mail.description")} />
        <SettingsTabs />

        {loadError ? (
          <LoadError message={t("admin.mail.loadError")} error={loadError.cause} onRetry={() => void load()} className="flex-1" />
        ) : !settings || !identity || !effective ? (
          <LoadingArea className="flex-1" label={t("admin.loading")} />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("admin.mail.addressesTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <section className="space-y-2">
                  <SectionTitle id="mail-sending-domain-title" title={t("admin.mail.sendingDomain")} help={withSource(t("admin.mail.sendingDomainHelp"), settings.Sources.SendingDomain, "SMTP_SENDER_EMAIL")} />
                  <div className="grid gap-4 md:grid-cols-2"><Input id="mail-sending-domain" aria-labelledby="mail-sending-domain-title" value={identity.SendingDomain} onChange={(event) => changeIdentity("SendingDomain", event.target.value)} disabled={disabled} placeholder={settings.EnvSendingDomain || t("admin.mail.domainPlaceholder")} autoComplete="off" spellCheck={false} /></div>
                  <p className="text-sm text-muted-foreground">{t("admin.mail.eventSenderHint", { domain: sendingDomain || t("admin.mail.domainPlaceholder") })}</p>
                </section>
                <section className="space-y-2">
                  <SectionTitle title={t("admin.mail.senderTitle")} help={t("admin.mail.senderDescription")} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field id="mail-sender-name" label={t("admin.mail.senderName")} help={withSource(t("admin.mail.senderNameHelp"), settings.Sources.SenderName, "SMTP_SENDER_NAME")}><Input id="mail-sender-name" value={identity.SenderName} maxLength={MAIL_NAME_MAX} onChange={(event) => changeIdentity("SenderName", event.target.value)} disabled={disabled} placeholder={effective.Sender.Name} autoComplete="off" /></Field>
                    <Field id="mail-sender-address" label={t("admin.mail.senderAddress")} help={withSource(t("admin.mail.senderAddressHelp"), settings.Sources.SenderAddress, "SMTP_SENDER_EMAIL")}><Input id="mail-sender-address" type="email" value={identity.SenderAddress} onChange={(event) => changeIdentity("SenderAddress", event.target.value)} disabled={disabled} placeholder={effective.Sender.Address} autoComplete="off" /></Field>
                  </div>
                </section>
                <section className="space-y-2">
                  <SectionTitle title={t("admin.mail.replyToTitle")} help={t("admin.mail.replyToHelp")} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field id="mail-reply-to-name" label={t("admin.mail.replyToName")} help={withSource(t("admin.mail.replyToNameHelp"), settings.Sources.ReplyToName, "SMTP_REPLY_TO_NAME")}><Input id="mail-reply-to-name" value={identity.ReplyToName} maxLength={MAIL_NAME_MAX} onChange={(event) => changeIdentity("ReplyToName", event.target.value)} disabled={disabled} placeholder={effective.ReplyTo.Name} autoComplete="off" /></Field>
                    <Field id="mail-reply-to-address" label={t("admin.mail.replyToAddress")} help={withSource(t("admin.mail.replyToAddressHelp"), settings.Sources.ReplyToAddress, "SMTP_REPLY_TO_EMAIL")}><Input id="mail-reply-to-address" type="email" value={identity.ReplyToAddress} onChange={(event) => changeIdentity("ReplyToAddress", event.target.value)} disabled={disabled} placeholder={effective.ReplyTo.Address} autoComplete="off" /></Field>
                  </div>
                </section>
                <RequirePermission perm="platform.settings.write">
                  <Button onClick={saveIdentity} busy={identityBusy}>{t("admin.mail.save")}</Button>
                </RequirePermission>
              </CardContent>
            </Card>

            <MailFooterCard footer={settings.Footer} canWrite={canWrite} onSaved={(next) => setSettings((current) => current && { ...current, Footer: next.Footer })} />

            <MailProvidersCard settings={settings} canWrite={canWrite} update={setSettings} reload={reloadProviders} />

            {error && <p role="alert" className="rounded-md bg-[var(--ib-danger-bg)] p-3 text-sm text-[var(--ib-danger)]">{error}</p>}
            {notice && <p role="status" className="rounded-md bg-[var(--ib-ok-bg)] p-3 text-sm text-foreground">{notice}</p>}
          </>
        )}
      </div>

    </RequirePermission>
  )
}

// A field tooltip: what the field is, then where its current value comes from.
function withSource(help: string, source: MailFieldSource, envName: string): string {
  return `${help} ${t(`admin.mail.fieldSource.${source}`, { name: envName })}`
}

function SectionTitle({ id, title, help }: { id?: string; title: string; help: string }) {
  return <h3 id={id} className="flex items-center gap-1.5 text-sm font-semibold text-foreground">{title}<FieldHelp text={help} /></h3>
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
