"use client"
import { useMemo } from "react"
import { t } from "@/i18n/t"
import { FieldValidation } from "@/components/ui/field-validation"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert } from "@/components/ui/alert"
import { FieldHelp } from "@/components/ui/field-help"
import { BlockEditor } from "@/components/notifications/editor/BlockEditor"
import { VariableRichText } from "@/components/notifications/editor/VariableRichText"
import { InAppBodyEditor } from "@/components/notifications/editor/InAppBodyEditor"
import { NotificationPreview } from "@/components/notifications/editor/NotificationPreview"
import { templateFieldError } from "@/components/notifications/editor/templateValidation"
import type { EmailBodyBlock } from "@/components/notifications/editor/emailBlocks"
import type { VariableDef } from "@/components/notifications/editor/variableUtils"
import { BROADCAST_VARIABLES } from "@/api/notifications/broadcasts"
import { broadcastSample } from "./broadcastLabels"
import { unsupportedVariables, withoutUnsupported, withoutUnsupportedBlocks } from "./broadcastTemplates"
import { hasBody, messageChannels, type BroadcastMessage } from "./broadcastMessage"

const HIDDEN_BLOCKS: EmailBodyBlock["type"][] = ["image"]

export function useBroadcastVariables(): VariableDef[] {
  return useMemo<VariableDef[]>(() => BROADCAST_VARIABLES.map((name) => ({ name, description: t(`admin.notif.broadcast.var.${name}`), example: broadcastSample(name) })), [])
}

// Field error state shared with the page: server/explicit errors per field, and which fields were edited («required»
// shows only after a field was left or changed).
export type MessageFieldState = {
  fieldErrors: Record<string, string>
  clearField: (field: string) => void
  touch: (field: string) => void
  touched: (field: string) => boolean
}

// The message of a broadcast: channels, the email part and the in-app part. Shared by the composer and the broadcast
// template editor, so a template holds exactly what a broadcast sends.
export function BroadcastMessageFields({ value, onChange, state }: { value: BroadcastMessage; onChange: (patch: Partial<BroadcastMessage>) => void; state: MessageFieldState }) {
  const variables = useBroadcastVariables()
  const { fieldErrors, clearField, touch, touched: req } = state
  const channels = messageChannels(value)
  const label = "mb-1 block text-sm font-medium text-foreground"
  return (
    <>
      <section className="space-y-2" aria-labelledby="bc-channels">
        <h2 id="bc-channels" className="text-sm font-semibold text-foreground">{t("admin.notif.broadcast.channels")}</h2>
        <FieldValidation label={t("admin.notif.broadcast.channels")} error={fieldErrors.channels || (channels.length === 0 && req("channels") ? t("admin.notif.broadcast.channelsRequired") : "")}><div className="flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox checked={value.email} onChange={(event) => { clearField("channels"); touch("channels"); onChange({ email: event.target.checked }) }} label={t("admin.notif.broadcast.channel.email")} />
          <Checkbox checked={value.inApp} onChange={(event) => { clearField("channels"); touch("channels"); onChange({ inApp: event.target.checked }) }} label={t("admin.notif.broadcast.channel.in_app")} />
        </div>
        </FieldValidation>
      </section>

      {value.email && (
        <section className="space-y-4" aria-labelledby="bc-email">
          <h2 id="bc-email" className="text-sm font-semibold text-foreground">{t("admin.notif.broadcast.emailPart")}</h2>
          <div onBlur={() => touch("subject")}>
            <label className={label}>{t("admin.notif.tpl.subject")}</label>
            <VariableRichText value={value.subject} onChange={(subject) => { clearField("subject"); touch("subject"); onChange({ subject }) }} error={fieldErrors.subject || templateFieldError(value.subject, variables, req("subject"))} variables={variables} placeholder={t("admin.notif.tpl.subject")} dotted />
          </div>
          <div>
            <label className={label}>{t("admin.notif.tpl.preheader")}</label>
            <VariableRichText value={value.preheader} onChange={(preheader) => onChange({ preheader })} error={templateFieldError(value.preheader, variables)} variables={variables} placeholder={t("admin.notif.tpl.preheader")} dotted />
          </div>
          <div onBlur={() => touch("body")}>
            <div className="mb-1 flex items-center gap-1.5">
              <label className="block text-sm font-medium text-foreground">{t("admin.notif.tpl.body")}</label>
              <FieldHelp text={t("admin.notif.broadcast.noImages")} />
            </div>
            <BlockEditor error={fieldErrors.body || (hasBody(value.body) ? templateFieldError(value.body, variables) : req("body") ? t("admin.notif.validation.required") : "")} value={value.body} onChange={(body) => { clearField("body"); touch("body"); onChange({ body }) }} variables={variables} presets={[]} showPresetSave={false} onSavePreset={async () => {}} hiddenBlockTypes={HIDDEN_BLOCKS} />
          </div>
        </section>
      )}

      {value.inApp && (
        <section className="space-y-4" aria-labelledby="bc-inapp">
          <h2 id="bc-inapp" className="text-sm font-semibold text-foreground">{t("admin.notif.broadcast.inAppPart")}</h2>
          <div onBlur={() => touch("title")}>
            <label className={label}>{t("admin.notif.tpl.title")}</label>
            <VariableRichText value={value.title} onChange={(title) => { clearField("title"); touch("title"); onChange({ title }) }} error={fieldErrors.title || templateFieldError(value.title, variables, req("title"))} variables={variables} placeholder={t("admin.notif.tpl.title")} dotted />
          </div>
          <div onBlur={() => touch("inAppBody")}>
            <label className={label}>{t("admin.notif.tpl.body")}</label>
            <InAppBodyEditor value={value.inAppBody} onChange={(inAppBody) => { touch("inAppBody"); onChange({ inAppBody }) }} error={templateFieldError(value.inAppBody, variables, req("inAppBody"))} variables={variables} />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <label className="block text-sm font-medium text-foreground">{t("admin.notif.tpl.link")}</label>
              <FieldHelp text={t("admin.notif.inapp.linkHelp")} />
            </div>
            <VariableRichText value={value.link} onChange={(link) => onChange({ link })} error={templateFieldError(value.link, variables)} variables={variables} placeholder={t("admin.notif.tpl.link")} dotted />
          </div>
        </section>
      )}
    </>
  )
}

// The previews as recipients get the message (unsupported variables empty), with the warning about them.
export function BroadcastMessagePreview({ value }: { value: BroadcastMessage }) {
  const variables = useBroadcastVariables()
  const previewValues = useMemo(() => Object.fromEntries(variables.map((variable) => [variable.name, variable.example ?? ""])), [variables])
  const { email, inApp, subject, preheader, body, title, inAppBody, link } = value
  // Template variables the broadcast cannot fill: flagged here and empty in the previews.
  const unsupported = useMemo(() => unsupportedVariables([
    ...(email ? [subject, preheader, body] : []),
    ...(inApp ? [title, inAppBody, link] : []),
  ]), [email, inApp, subject, preheader, body, title, inAppBody, link])
  const shown = useMemo(() => ({
    subject: withoutUnsupported(subject), preheader: withoutUnsupported(preheader), body: withoutUnsupportedBlocks(body),
    title: withoutUnsupported(title), inAppBody: withoutUnsupported(inAppBody), link: withoutUnsupported(link),
  }), [subject, preheader, body, title, inAppBody, link])
  return (
    <>
      {unsupported.length > 0 && (
        <Alert variant="warning">
          {t("admin.notif.broadcast.template.unsupportedNames", { names: unsupported.join(", ") })}
        </Alert>
      )}
      <NotificationPreview
        email={email ? { notificationType: "broadcast", subject: shown.subject, preheader: shown.preheader, body: shown.body, styling: {} } : undefined}
        inApp={inApp ? { title: shown.title, body: shown.inAppBody, link: shown.link, icon: "bell", tone: "neutral", accentColor: "", surface: "inbox", autoDismissMs: null, actions: [], previewValues } : undefined}
      />
    </>
  )
}
