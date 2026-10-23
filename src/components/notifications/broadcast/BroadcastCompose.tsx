"use client"
import { ApiError } from "@/api/client"
import { FieldValidation } from "@/components/ui/field-validation"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookmarkPlus } from "lucide-react"
import { t } from "@/i18n/t"
import { localizedError } from "@/i18n/apiError"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Spinner } from "@/components/ui/spinner"
import { broadcastAudienceCount, sendBroadcast } from "@/api/notifications/broadcasts"
import { TemplateStart } from "./TemplateStart"
import { withTemplate, type BroadcastTemplate } from "./broadcastTemplates"
import { AudiencePicker, EMPTY_AUDIENCE, audienceComplete, audienceToApi, type AudienceState } from "./AudiencePicker"
import { BroadcastMessageFields, BroadcastMessagePreview } from "./BroadcastMessageFields"
import { SaveTemplateDialog } from "./SaveTemplateDialog"
import { emptyMessage, messageComplete, messageContent, type BroadcastMessage } from "./broadcastMessage"

const COUNT_DEBOUNCE_MS = 400

export function BroadcastCompose() {
  const router = useRouter()
  const [message, setMessage] = useState<BroadcastMessage>(emptyMessage)
  const set = (patch: Partial<BroadcastMessage>) => setMessage((current) => ({ ...current, ...patch }))
  const [audience, setAudience] = useState<AudienceState>(EMPTY_AUDIENCE)
  // The count belongs to the audience it was fetched for; a changed audience shows the loader again.
  const [counted, setCounted] = useState<{ key: string; count: number | null } | null>(null)
  const [countReload, setCountReload] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  // A template chosen over existing content waits here for the replacement to be confirmed.
  const [pendingTemplate, setPendingTemplate] = useState<BroadcastTemplate | null>(null)
  const [sending, setSending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const touch = (field: string) => setTouched((current) => current.has(field) ? current : new Set(current).add(field))
  const clearField = (field: string) => setFieldErrors((current) => ({ ...current, [field]: "" }))
  const [sendError, setSendError] = useState("")

  function applyTemplate(template: BroadcastTemplate) {
    setMessage((current) => withTemplate(current, template))
  }
  function pickTemplate(template: BroadcastTemplate) {
    const { subject, preheader, body, title, inAppBody, link } = message
    const emailFilled = subject.trim() !== "" || preheader.trim() !== "" || body.length > 0
    const inAppFilled = title.trim() !== "" || inAppBody.trim() !== "" || link.trim() !== ""
    const replaces = (template.kind === "saved" && (emailFilled || inAppFilled)) || (template.email && emailFilled) || (template.inApp && inAppFilled)
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
  const ready = messageComplete(message)
  const canSend = ready && complete && (shownCount ?? 0) > 0

  // «Зберегти як шаблон»: an incomplete message marks its empty fields instead of opening the dialog.
  function requestSaveTemplate() {
    if (ready) { setSaveTemplateOpen(true); return }
    for (const field of ["channels", "subject", "body", "title", "inAppBody"]) touch(field)
  }

  async function send() {
    setSending(true)
    setSendError("")
    try {
      const created = await sendBroadcast({ ...messageContent(message), Audience: audienceToApi(audience) })
      router.push(`/notifications/broadcasts/detail?id=${encodeURIComponent(created.ID)}`)
    } catch (cause) {
      const text = cause instanceof ApiError ? (cause.body as { Status?: { Message?: string } } | null)?.Status?.Message ?? cause.message : ""
      const field = cause instanceof ApiError && cause.code === 20222 ? "audience" : cause instanceof ApiError && cause.code === 20221 ? ({
        "Email subject is required": "subject", "Email body is required": "body", "In-app title is required": "title",
        "Select at least one channel": "channels", "Unsupported channel": "channels",
        "Select at least one role": "audience", "Unknown role": "audience", "Select at least one user": "audience",
      } as Record<string, string>)[text] : undefined
      if (field) {
        const fieldText = field === "audience" ? t(cause instanceof ApiError && cause.code === 20222 ? "admin.notif.broadcast.count.zero" : "admin.notif.broadcast.audience.incomplete") : field === "channels" ? t("admin.notif.broadcast.channelsRequired") : field === "body" ? t("admin.notif.validation.required") : t("admin.notif.broadcast.textInvalid", { max: 200 })
        setFieldErrors((errors) => ({ ...errors, [field]: fieldText }))
        setConfirmOpen(false)
      } else setSendError(localizedError(cause))
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
    <PageHeader title={t("admin.notif.broadcast.new")}
      crumbs={[{ label: t("admin.notif.broadcast.title"), href: "/notifications/broadcasts" }, { label: t("admin.notif.broadcast.new") }]}
      actions={<>
        <Button variant="outline" onClick={requestSaveTemplate}><BookmarkPlus className="h-4 w-4" aria-hidden="true" />{t("admin.notif.broadcastTpl.saveAs.action")}</Button>
        <Button disabled={!canSend} onClick={() => { setSendError(""); setConfirmOpen(true) }}>{t("admin.notif.broadcast.send")}</Button>
      </>} />
    <div className="frost-panel frost-in rounded-lg p-6">

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,45%)]">
        <div className="min-w-0 space-y-6">
          <TemplateStart onPick={pickTemplate} />

          <BroadcastMessageFields value={message} onChange={set} state={{ fieldErrors, clearField, touch, touched: (field) => touched.has(field) }} />

          <section className="space-y-3" aria-labelledby="bc-audience">
            <h2 id="bc-audience" className="text-sm font-semibold text-foreground">{t("admin.notif.broadcast.audience.title")}</h2>
            <FieldValidation label={t("admin.notif.broadcast.audience.title")} error={fieldErrors.audience}><AudiencePicker value={audience} onChange={(value) => { clearField("audience"); setAudience(value) }} /></FieldValidation>
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
          <BroadcastMessagePreview value={message} />
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
        busy={sending} busyLabel={t("busy.sending")}
        error={sendError}
        onConfirm={() => void send()}
      />
      <SaveTemplateDialog open={saveTemplateOpen} message={message} onClose={() => setSaveTemplateOpen(false)} />
    </div>
    </div>
  )
}

