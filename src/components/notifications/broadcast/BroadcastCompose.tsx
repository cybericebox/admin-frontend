"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { t } from "@/i18n/t"
import { localizedError } from "@/i18n/apiError"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert } from "@/components/ui/alert"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { FieldHelp } from "@/components/ui/field-help"
import { Spinner } from "@/components/ui/spinner"
import { BlockEditor } from "@/components/notifications/editor/BlockEditor"
import { VariableRichText } from "@/components/notifications/editor/VariableRichText"
import { InAppBodyEditor } from "@/components/notifications/editor/InAppBodyEditor"
import { EmailPreview } from "@/components/notifications/editor/EmailPreview"
import { InAppPreview } from "@/components/notifications/editor/InAppPreview"
import type { EmailBodyBlock } from "@/components/notifications/editor/emailBlocks"
import type { VariableDef } from "@/components/notifications/editor/variableUtils"
import { BROADCAST_VARIABLES, broadcastAudienceCount, sendBroadcast, type BroadcastChannel } from "@/api/notifications/broadcasts"
import { broadcastSample } from "./broadcastLabels"
import { TemplateStart } from "./TemplateStart"
import { unsupportedVariables, withoutUnsupported, withoutUnsupportedBlocks, type BroadcastTemplate } from "./broadcastTemplates"
import { AudiencePicker, EMPTY_AUDIENCE, audienceComplete, audienceToApi, type AudienceState } from "./AudiencePicker"

const COUNT_DEBOUNCE_MS = 400
const HIDDEN_BLOCKS: EmailBodyBlock["type"][] = ["image"]

// A rich-text block or in-app body counts as filled when it has any visible text.
function hasBody(blocks: EmailBodyBlock[]): boolean {
  return blocks.some((block) => block.type !== "divider" && block.type !== "preset")
}

export function BroadcastCompose() {
  const router = useRouter()
  const [email, setEmail] = useState(true)
  const [inApp, setInApp] = useState(true)
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [body, setBody] = useState<EmailBodyBlock[]>([])
  const [title, setTitle] = useState("")
  const [inAppBody, setInAppBody] = useState("")
  const [link, setLink] = useState("")
  const [audience, setAudience] = useState<AudienceState>(EMPTY_AUDIENCE)
  // The count belongs to the audience it was fetched for; a changed audience shows the loader again.
  const [counted, setCounted] = useState<{ key: string; count: number | null } | null>(null)
  const [countReload, setCountReload] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // A template chosen over existing content waits here for the replacement to be confirmed.
  const [pendingTemplate, setPendingTemplate] = useState<BroadcastTemplate | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")

  const variables = useMemo<VariableDef[]>(() => BROADCAST_VARIABLES.map((name) => ({ name, description: t(`admin.notif.broadcast.var.${name}`), example: broadcastSample(name) })), [])
  const previewValues = useMemo(() => Object.fromEntries(variables.map((variable) => [variable.name, variable.example ?? ""])), [variables])

  // Template variables the broadcast cannot fill: flagged here and empty in the previews.
  const unsupported = useMemo(() => unsupportedVariables([
    ...(email ? [subject, preheader, JSON.stringify(body)] : []),
    ...(inApp ? [title, inAppBody, link] : []),
  ]), [email, inApp, subject, preheader, body, title, inAppBody, link])
  const shown = useMemo(() => ({
    subject: withoutUnsupported(subject), preheader: withoutUnsupported(preheader), body: withoutUnsupportedBlocks(body),
    title: withoutUnsupported(title), inAppBody: withoutUnsupported(inAppBody), link: withoutUnsupported(link),
  }), [subject, preheader, body, title, inAppBody, link])

  function applyTemplate(template: BroadcastTemplate) {
    if (template.email) {
      setEmail(true)
      setSubject(template.email.subject)
      setPreheader(template.email.preheader)
      setBody(template.email.body)
    }
    if (template.inApp) {
      setInApp(true)
      setTitle(template.inApp.title)
      setInAppBody(template.inApp.body)
      setLink(template.inApp.link)
    }
  }
  function pickTemplate(template: BroadcastTemplate) {
    const replaces = (template.email && (subject.trim() !== "" || preheader.trim() !== "" || body.length > 0)) || (template.inApp && (title.trim() !== "" || inAppBody.trim() !== "" || link.trim() !== ""))
    if (replaces) setPendingTemplate(template)
    else applyTemplate(template)
  }

  const complete = audienceComplete(audience)
  const audienceKey = JSON.stringify(audienceToApi(audience))

  // Live recipient count: debounced, superseded requests are aborted.
  useEffect(() => {
    if (!complete) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      broadcastAudienceCount(JSON.parse(audienceKey), controller.signal).then(
        (res) => { if (!controller.signal.aborted) setCounted({ key: audienceKey, count: res.Count }) },
        () => { if (!controller.signal.aborted) setCounted({ key: audienceKey, count: null }) },
      )
    }, COUNT_DEBOUNCE_MS)
    return () => { clearTimeout(timer); controller.abort() }
  }, [audienceKey, complete, countReload])

  const current = complete && counted?.key === audienceKey ? counted : null
  const count = current?.count ?? null
  const countError = current !== null && current.count === null
  const shownCount = count
  const channels: BroadcastChannel[] = [...(email ? ["email" as const] : []), ...(inApp ? ["in_app" as const] : [])]
  const emailValid = !email || (subject.trim() !== "" && hasBody(body))
  const inAppValid = !inApp || (title.trim() !== "" && inAppBody.trim() !== "")
  const canSend = channels.length > 0 && emailValid && inAppValid && complete && (shownCount ?? 0) > 0

  async function send() {
    setSending(true)
    setSendError("")
    try {
      const created = await sendBroadcast({
        Channels: channels,
        Subject: email ? subject : "",
        Preheader: email ? preheader : "",
        EmailBody: email ? body : [],
        EmailStyling: {},
        InAppTitle: inApp ? title : "",
        InAppBody: inApp ? inAppBody : "",
        InAppLink: inApp ? link : "",
        Audience: audienceToApi(audience),
      })
      router.push(`/notifications/broadcasts/detail?id=${encodeURIComponent(created.ID)}`)
    } catch (cause) {
      setSendError(localizedError(cause))
      setSending(false)
    }
  }

  const label = "mb-1 block text-sm font-medium text-foreground"
  return (
    <div className="flex flex-col gap-4">
    <PageHeader title={t("admin.notif.broadcast.new")}
      crumbs={[{ label: t("admin.notif.broadcast.title"), href: "/notifications/broadcasts" }, { label: t("admin.notif.broadcast.new") }]}
      actions={<Button disabled={!canSend} onClick={() => { setSendError(""); setConfirmOpen(true) }}>{t("admin.notif.broadcast.send")}</Button>} />
    <div className="frost-panel frost-in rounded-lg p-6">

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,45%)]">
        <div className="min-w-0 space-y-6">
          <TemplateStart onPick={pickTemplate} />

          <section className="space-y-2" aria-labelledby="bc-channels">
            <h2 id="bc-channels" className="text-sm font-semibold text-foreground">{t("admin.notif.broadcast.channels")}</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Checkbox checked={email} onChange={(event) => setEmail(event.target.checked)} label={t("admin.notif.broadcast.channel.email")} />
              <Checkbox checked={inApp} onChange={(event) => setInApp(event.target.checked)} label={t("admin.notif.broadcast.channel.in_app")} />
            </div>
            {channels.length === 0 && <p className="text-xs text-destructive">{t("admin.notif.broadcast.channelsRequired")}</p>}
          </section>

          {email && (
            <section className="space-y-4" aria-labelledby="bc-email">
              <h2 id="bc-email" className="text-sm font-semibold text-foreground">{t("admin.notif.broadcast.emailPart")}</h2>
              <div>
                <label className={label}>{t("admin.notif.tpl.subject")}</label>
                <VariableRichText value={subject} onChange={setSubject} variables={variables} placeholder={t("admin.notif.tpl.subject")} dotted />
              </div>
              <div>
                <label className={label}>{t("admin.notif.tpl.preheader")}</label>
                <VariableRichText value={preheader} onChange={setPreheader} variables={variables} placeholder={t("admin.notif.tpl.preheader")} dotted />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <label className="block text-sm font-medium text-foreground">{t("admin.notif.tpl.body")}</label>
                  <FieldHelp text={t("admin.notif.broadcast.noImages")} />
                </div>
                <BlockEditor value={body} onChange={setBody} variables={variables} presets={[]} showPresetSave={false} onSavePreset={async () => {}} hiddenBlockTypes={HIDDEN_BLOCKS} />
              </div>
            </section>
          )}

          {inApp && (
            <section className="space-y-4" aria-labelledby="bc-inapp">
              <h2 id="bc-inapp" className="text-sm font-semibold text-foreground">{t("admin.notif.broadcast.inAppPart")}</h2>
              <div>
                <label className={label}>{t("admin.notif.tpl.title")}</label>
                <VariableRichText value={title} onChange={setTitle} variables={variables} placeholder={t("admin.notif.tpl.title")} dotted />
              </div>
              <div>
                <label className={label}>{t("admin.notif.tpl.body")}</label>
                <InAppBodyEditor value={inAppBody} onChange={setInAppBody} variables={variables} />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <label className="block text-sm font-medium text-foreground">{t("admin.notif.tpl.link")}</label>
                  <FieldHelp text={t("admin.notif.inapp.linkHelp")} />
                </div>
                <VariableRichText value={link} onChange={setLink} variables={variables} placeholder={t("admin.notif.tpl.link")} dotted />
              </div>
            </section>
          )}

          <section className="space-y-3" aria-labelledby="bc-audience">
            <h2 id="bc-audience" className="text-sm font-semibold text-foreground">{t("admin.notif.broadcast.audience.title")}</h2>
            <AudiencePicker value={audience} onChange={setAudience} />
            <div className="flex min-h-6 items-center gap-2 text-sm" aria-live="polite">
              {!complete ? <span className="text-muted-foreground">{t("admin.notif.broadcast.audience.incomplete")}</span>
                : countError ? <><span className="text-destructive">{t("admin.notif.broadcast.count.error")}</span><Button variant="outline" size="sm" onClick={() => { setCounted(null); setCountReload((n) => n + 1) }}>{t("error.load.retry")}</Button></>
                : count === null ? <Spinner size="sm" label={t("admin.notif.broadcast.count.loading")} />
                : <span className="text-foreground">{t("admin.notif.broadcast.count.value", { count })}</span>}
            </div>
            {shownCount === 0 && <p className="text-xs text-destructive">{t("admin.notif.broadcast.count.zero")}</p>}
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          {unsupported.length > 0 && (
            <Alert variant="warning">
              <ul className="space-y-1">{unsupported.map((name) => <li key={name}>{t("admin.notif.broadcast.template.unsupported", { name })}</li>)}</ul>
            </Alert>
          )}
          {email && (
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">{t("admin.notif.broadcast.previewEmail")}</div>
              <EmailPreview notificationType="broadcast" subject={shown.subject} preheader={shown.preheader} body={shown.body} styling={{}} />
            </div>
          )}
          {inApp && (
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">{t("admin.notif.broadcast.previewInApp")}</div>
              <InAppPreview title={shown.title} body={shown.inAppBody} link={shown.link} icon="bell" tone="neutral" accentColor="" surface="inbox" autoDismissMs={null} actions={[]} previewValues={previewValues} />
            </div>
          )}
          {!email && !inApp && <Alert variant="warning">{t("admin.notif.broadcast.channelsRequired")}</Alert>}
        </div>
      </div>

      <ConfirmDialog
        open={pendingTemplate !== null}
        onCancel={() => setPendingTemplate(null)}
        title={t("admin.notif.broadcast.template.replace.title")}
        description={t("admin.notif.broadcast.template.replace.body", { name: pendingTemplate?.label ?? "" })}
        confirmLabel={t("admin.notif.broadcast.template.replace.action")}
        onConfirm={() => { if (pendingTemplate) applyTemplate(pendingTemplate); setPendingTemplate(null) }}
      />
      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        title={t(shownCount === 1 ? "admin.notif.broadcast.confirm.titleOne" : "admin.notif.broadcast.confirm.title", { count: shownCount ?? 0 })}
        description={t("admin.notif.broadcast.confirm.body")}
        confirmLabel={t("admin.notif.broadcast.confirm.action")}
        busy={sending}
        error={sendError}
        onConfirm={() => void send()}
      />
    </div>
    </div>
  )
}
