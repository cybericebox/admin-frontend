"use client"
import DOMPurify from "isomorphic-dompurify"
import { useEffect, useRef, useState } from "react"
import { MAIL_FOOTER_MAX, previewMailFooter, saveMailFooter, type MailFooter, type MailFooterPreview, type MailSettings } from "@/api/mail/settings"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FieldHelp } from "@/components/ui/field-help"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

const PREVIEW_DELAY_MS = 300

const VARIABLE_LABEL_KEY: Record<string, string> = {
  platform_name: "admin.mail.footer.var.platform_name",
  site_url: "admin.mail.footer.var.site_url",
  privacy_url: "admin.mail.footer.var.privacy_url",
  reply_to: "admin.mail.footer.var.reply_to",
}

type PreviewState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; preview: MailFooterPreview }

// What the editor shows: the saved template, else the default that is sent.
export function footerDraft(footer: MailFooter): string {
  return footer.Text || footer.DefaultText
}

// A template equal to the default is stored as empty, so the default keeps following the platform.
export function footerPayload(draft: string, footer: MailFooter): string {
  const text = draft.trim()
  return text === footer.DefaultText.trim() ? "" : text
}

export function MailFooterCard({ footer, canWrite, onSaved }: { footer: MailFooter; canWrite: boolean; onSaved: (settings: MailSettings) => void }) {
  const [draft, setDraft] = useState(() => footerDraft(footer))
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [retry, setRetry] = useState(0)
  const textarea = useRef<HTMLTextAreaElement>(null)

  // Live preview: the backend renders the unsaved text exactly as send appends it.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      previewMailFooter(footerPayload(draft, footer))
        .then((result) => { if (!cancelled) setPreview({ status: "ready", preview: result }) })
        .catch((err: unknown) => { if (!cancelled) setPreview({ status: "error", message: localizedError(err) }) })
    }, PREVIEW_DELAY_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [draft, footer, retry])

  function change(value: string) {
    setDraft(value)
    setPreview({ status: "loading" })
    setNotice("")
    setError("")
  }

  function insert(name: string) {
    const token = `{${name}}`
    const field = textarea.current
    const start = field?.selectionStart ?? draft.length
    const end = field?.selectionEnd ?? draft.length
    change(draft.slice(0, start) + token + draft.slice(end))
    const caret = start + token.length
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(caret, caret) })
  }

  async function save() {
    if (draft.trim().length > MAIL_FOOTER_MAX) { setError(t("admin.mail.footer.tooLong", { max: MAIL_FOOTER_MAX })); return }
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const next = await saveMailFooter(footerPayload(draft, footer))
      setDraft(footerDraft(next.Footer))
      onSaved(next)
      setNotice(t("admin.mail.footer.saved"))
    } catch (err) {
      setError(localizedError(err))
    } finally {
      setBusy(false)
    }
  }

  const isDefault = draft.trim() === footer.DefaultText.trim()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("admin.mail.footer.title")}</CardTitle>
        <CardDescription>{t("admin.mail.footer.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor="mail-footer-text" className="block text-sm font-medium">{t("admin.mail.footer.text")}</label>
              <FieldHelp text={t("admin.mail.footer.textHelp")} />
            </div>
            <Textarea id="mail-footer-text" ref={textarea} rows={5} value={draft} maxLength={MAIL_FOOTER_MAX} disabled={!canWrite || busy} onChange={(event) => change(event.target.value)} className="font-mono" />
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("admin.mail.footer.variables")}>
              <span className="text-xs text-muted-foreground">{t("admin.mail.footer.variables")}</span>
              {footer.Variables.map((name) => (
                <button key={name} type="button" disabled={!canWrite || busy} onClick={() => insert(name)}
                  aria-label={t("admin.mail.footer.insert", { variable: `{${name}}` })}
                  title={VARIABLE_LABEL_KEY[name] ? t(VARIABLE_LABEL_KEY[name]) : name}
                  className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
                  {`{${name}}`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <span className="block text-sm font-medium">{t("admin.mail.footer.preview")}</span>
            <div data-testid="mail-footer-preview" className="flex min-h-40 flex-col justify-center rounded-md border border-border bg-card p-4">
              {preview.status === "loading" ? (
                <LoadingArea compact label={t("admin.loading")} />
              ) : preview.status === "error" ? (
                <LoadError compact message={preview.message} onRetry={() => { setPreview({ status: "loading" }); setRetry((n) => n + 1) }} />
              ) : preview.preview.HTML ? (
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(preview.preview.HTML) }} />
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
            <Button onClick={() => void save()} disabled={busy} busy={busy}>{t("admin.mail.save")}</Button>
            <Button variant="outline" onClick={() => change(footer.DefaultText)} disabled={busy || isDefault}>{t("admin.mail.footer.resetDefault")}</Button>
          </div>
        </RequirePermission>
      </CardContent>
    </Card>
  )
}
