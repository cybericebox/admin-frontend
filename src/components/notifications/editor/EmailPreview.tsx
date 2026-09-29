"use client"
import { useEffect, useState } from "react"
import { ApiError } from "@/api/client"
import { previewEmailTemplate, type PreviewEmailTemplateResult } from "@/api/notifications/emailTemplates"
import type { EmailBodyBlock } from "@/components/notifications/editor/emailBlocks"
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

/**
 * Wraps the backend-rendered HTML fragment into a full document. The backend
 * embeds every image (uploaded images, brand logo) as a data: URI, so the
 * document makes no image requests and needs no base URL.
 */
function previewDocument(html: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`
}

/**
 * EmailHtmlFrame — backend-rendered email HTML in a fully isolated iframe
 * (sandbox="": no scripts, forms, popups or same-origin access). Shared by the
 * template preview and the platform footer preview, so both look alike.
 */
export function EmailHtmlFrame({ html, className = "h-[480px]" }: { html: string; className?: string }) {
  return (
    <iframe
      title={t("admin.notif.editor.previewTitle")}
      sandbox=""
      srcDoc={previewDocument(html)}
      className={`w-full bg-white ${className}`}
    />
  )
}

/**
 * EmailPreview — shows the draft exactly as the backend would send it.
 *
 * The current fields are sent to previewEmailTemplate 300 ms after the last
 * change (the backend resolves presets, brand tokens, logo and sample variable
 * values itself, and inlines every image as a data: URI); a superseded or
 * unmounted request is aborted. The returned HTML goes into
 * <iframe sandbox="" srcDoc=...>: fully isolated — an opaque origin with no
 * cookies, scripts, forms, popups or top navigation. It needs none of them,
 * since the images are inline; never add allow-same-origin or allow-scripts.
 * The last good render stays visible while a new
 * one is loading or after it fails; a 400 (draft cannot be rendered, e.g. a
 * half-typed `{{.us`) shows the backend's reason inline, anything else a
 * generic inline error. Without a notification type nothing is requested and
 * any previous render/error is cleared.
 */
export function EmailPreview({ notificationType, subject = "", preheader = "", body, styling }: EmailPreviewProps) {
  const [result, setResult] = useState<PreviewEmailTemplateResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Nothing is rendered without a type: drop the previous render and error
  // when the type is cleared (adjusted during render, not in the effect).
  const [renderedType, setRenderedType] = useState(notificationType)
  if (renderedType !== notificationType) {
    setRenderedType(notificationType)
    if (!notificationType) {
      setResult(null)
      setError(null)
    }
  }

  useEffect(() => {
    if (!notificationType) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      previewEmailTemplate({
        NotificationType: notificationType,
        Subject: subject,
        Preheader: preheader,
        Body: body,
        Styling: styling,
      }, controller.signal).then(
        (res) => {
          if (controller.signal.aborted) return
          setResult(res)
          setError(null)
        },
        (err: unknown) => {
          if (controller.signal.aborted) return
          setError(err instanceof ApiError && err.status === 400 ? err.message : t("admin.notif.editor.previewError"))
        },
      )
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
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
      <EmailHtmlFrame html={result?.HTML ?? ""} />
    </div>
  )
}
