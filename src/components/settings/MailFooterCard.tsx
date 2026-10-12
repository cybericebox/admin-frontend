"use client"
import { useEffect, useMemo, useState } from "react"
import { MAIL_FOOTER_MAX_BYTES, previewMailFooter, saveMailFooter, type LexicalState, type MailFooter, type MailFooterPreview, type MailSettings } from "@/api/mail/settings"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { EmailHtmlFrame } from "@/components/notifications/editor/EmailPreview"
import { RichTextEditor } from "@/components/notifications/editor/RichTextEditor"
import type { VariableDef } from "@/components/notifications/editor/variableUtils"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { useSavedDraft } from "@/lib/useSavedDraft"
import { sameTemplateValue } from "@/lib/templateEditorState"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FieldHelp } from "@/components/ui/field-help"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"

const PREVIEW_DELAY_MS = 300

type PreviewState = { status: "loading" } | { status: "error"; message: string; cause: unknown } | { status: "ready"; preview: MailFooterPreview }

// Pills look like the ones of the email body editor: the variable name on a warn-tone chip.
const PILL_CLASS = "[&_[data-notif-variable]]:border-[var(--ib-warn)] [&_[data-notif-variable]]:bg-[var(--ib-warn-bg)] [&_[data-notif-variable]]:text-[var(--ib-warn)]"

// What the editor shows: the saved footer, else the default that is sent.
export function footerDraft(footer: MailFooter): LexicalState {
  return footer.Content ?? footer.DefaultContent
}

// The variable menu of the editor: the footer variables with their help.
export function footerVariables(names: string[]): VariableDef[] {
  return names.map((name) => ({
    name,
    description: t(`admin.mail.footer.var.${name}`),
    example: t(`admin.mail.footer.example.${name}`),
  }))
}

// Lexical fills absent default fields while loading a document. Ignore only
// these defaults and node versions; keep formatting, styles and all content.
function footerValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(footerValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => {
    if (key === "version") return false
    if (key === "formats" && Array.isArray(item) && item.length === 0) return false
    if (["format", "detail", "indent", "textFormat"].includes(key) && (item === 0 || item === "")) return false
    if (["style", "textStyle"].includes(key) && item === "") return false
    if (key === "direction" && (item === null || item === "ltr")) return false
    return !(key === "mode" && item === "normal")
  }).map(([key, item]) => [key, footerValue(item)]))
}

function byteLength(doc: LexicalState): number {
  return new TextEncoder().encode(JSON.stringify(doc)).length
}

export function MailFooterCard({ footer, canWrite, onSaved }: { footer: MailFooter; canWrite: boolean; onSaved: (settings: MailSettings) => void }) {
  const { draft, setDraft, dirty, accept } = useSavedDraft(footerDraft(footer), footerValue)
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [retry, setRetry] = useState(0)
  const variables = useMemo(() => footerVariables(footer.Variables), [footer.Variables])

  // Live preview: the backend renders the unsaved footer exactly as send appends it.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      previewMailFooter(draft)
        .then((result) => { if (!cancelled) setPreview({ status: "ready", preview: result }) })
        .catch((err: unknown) => { if (!cancelled) setPreview({ status: "error", message: localizedError(err), cause: err }) })
    }, PREVIEW_DELAY_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [draft, retry])

  function change(value: LexicalState) {
    setDraft(value)
    setPreview({ status: "loading" })
    setNotice("")
    setError("")
  }

  async function save() {
    if (busy || !dirty) return
    if (byteLength(draft) > MAIL_FOOTER_MAX_BYTES) { setError(t("admin.mail.footer.tooLong")); return }
    const submitted = footerValue(draft)
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const next = await saveMailFooter(draft)
      // A newer edit made while saving stays in the editor.
      accept(footerDraft(next.Footer), submitted)
      onSaved(next)
      setNotice(t("admin.mail.footer.saved"))
    } catch (err) {
      setError(localizedError(err))
    } finally {
      setBusy(false)
    }
  }

  const isDefault = sameTemplateValue(footerValue(draft), footerValue(footer.DefaultContent))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">{t("admin.mail.footer.title")}<FieldHelp text={t("admin.mail.footer.description")} /></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2" data-testid="mail-footer-editor">
            <div className="flex items-center gap-1.5">
              <span className="block text-sm font-medium">{t("admin.mail.footer.text")}</span>
              <FieldHelp text={t("admin.mail.footer.textHelp")} />
            </div>
            <RichTextEditor
              showVariableNames
              className={PILL_CLASS}
              value={draft}
              onChange={change}
              variables={variables}
              disabled={!canWrite}
              placeholder={t("admin.mail.footer.placeholder")}
            />
          </div>
          <div className="space-y-2">
            <span className="block text-sm font-medium">{t("admin.mail.footer.preview")}</span>
            <div data-testid="mail-footer-preview" className="flex min-h-40 flex-col justify-center overflow-hidden rounded-md border border-border bg-card">
              {preview.status === "loading" ? (
                <LoadingArea compact label={t("admin.loading")} />
              ) : preview.status === "error" ? (
                <LoadError compact message={preview.message} error={preview.cause} onRetry={() => { setPreview({ status: "loading" }); setRetry((n) => n + 1) }} />
              ) : preview.preview.HTML ? (
                <EmailHtmlFrame html={preview.preview.HTML} className="h-40" />
              ) : (
                <EmptyState compact message={t("admin.mail.footer.previewEmpty")} />
              )}
            </div>
          </div>
        </div>

        {error && <p role="alert" className="rounded-md bg-[var(--ib-danger-bg)] p-3 text-sm text-[var(--ib-danger)]">{error}</p>}
        {notice && <p role="status" className="rounded-md bg-[var(--ib-ok-bg)] p-3 text-sm text-foreground">{notice}</p>}

        <RequirePermission perm="platform.settings.write">
          <div className="flex flex-wrap gap-2">
            <SaveButton dirty={dirty} onClick={() => void save()} busy={busy}>{t("admin.mail.save")}</SaveButton>
            <Button variant="outline" onClick={() => change(footer.DefaultContent)} disabled={isDefault}>{t("admin.mail.footer.resetDefault")}</Button>
          </div>
        </RequirePermission>
      </CardContent>
    </Card>
  )
}
