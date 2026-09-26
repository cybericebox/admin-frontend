"use client"
import { useEffect, useState } from "react"
import { ApiError } from "@/api/client"
import { previewEmailTemplate, type PreviewEmailTemplateResult } from "@/api/notifications/emailTemplates"
import type { EmailBodyBlock } from "@/components/notifications/editor/emailBlocks"
import { apiOrigin } from "@/lib/origins"
import { t } from "@/i18n/t"

export interface EmailPreviewProps {
  notificationType: string
  subject?: string
  preheader?: string
  body: EmailBodyBlock[]
  styling: Record<string, unknown>
}

/** Delay between the last draft change and the backend preview request. */
const PREVIEW_DEBOUNCE_MS = 300

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&#34;").replace(/</g, "&lt;")
}

/**
 * Wraps the backend-rendered HTML fragment into a full document. The fragment
 * references images/logo by relative `/api/...` URLs, which must resolve
 * against the API host (not the admin host / about:srcdoc) — the same rule as
 * mediaUrl() in api/client.ts. With an empty apiOrigin (local same-origin dev)
 * the srcdoc document already inherits the parent's base URL.
 */
function previewDocument(html: string): string {
  const base = apiOrigin ? `<base href="${escapeAttr(apiOrigin)}/">` : ""
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${base}</head><body>${html}</body></html>`
}

/**
 * EmailPreview — shows the draft exactly as the backend would send it.
 *
 * The current fields are sent to previewEmailTemplate 300 ms after the last
 * change (the backend resolves presets, brand tokens, logo and sample variable
 * values itself). The returned HTML goes into <iframe sandbox="" srcDoc=...>
 * for strict origin isolation. The last good render stays visible while a new
 * one is loading or after it fails; a 400 (draft cannot be rendered, e.g. a
 * half-typed `{{.us`) shows the backend's reason inline, anything else a
 * generic inline error.
 */
export function EmailPreview({ notificationType, subject = "", preheader = "", body, styling }: EmailPreviewProps) {
  const [result, setResult] = useState<PreviewEmailTemplateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!notificationType) return
    let cancelled = false
    const timer = setTimeout(() => {
      previewEmailTemplate({
        NotificationType: notificationType,
        Subject: subject,
        Preheader: preheader,
        Body: body,
        Styling: styling,
      }).then(
        (res) => {
          if (cancelled) return
          setResult(res)
          setError(null)
        },
        (err: unknown) => {
          if (cancelled) return
          setError(err instanceof ApiError && err.status === 400 ? err.message : t("admin.notif.editor.previewError"))
        },
      )
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [notificationType, subject, preheader, body, styling])

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="space-y-2 border-b border-border px-4 py-3 text-sm">
        <div><span className="text-muted-foreground">{t("admin.notif.tpl.subject")}: </span><span className="font-medium text-foreground">{result?.Subject || "—"}</span></div>
        <div className="text-xs"><span className="text-muted-foreground">{t("admin.notif.tpl.preheader")}: </span><span className="text-foreground">{result?.Preheader || "—"}</span></div>
      </div>
      {error && (
        <p role="alert" className="border-b border-border px-4 py-2 text-xs text-destructive">{error}</p>
      )}
      <iframe
        title={t("admin.notif.editor.previewTitle")}
        sandbox=""
        srcDoc={previewDocument(result?.HTML ?? "")}
        className="h-[480px] w-full bg-white"
      />
    </div>
  )
}
