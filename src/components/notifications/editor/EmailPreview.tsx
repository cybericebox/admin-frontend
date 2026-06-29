"use client"
import { buildPreviewHtml } from "@/components/notifications/editor/previewHtml"
import type { EmailBodyBlock } from "@/components/notifications/editor/previewHtml"
import { t } from "@/i18n/t"

export interface EmailPreviewProps {
  body: EmailBodyBlock[]
  styling: Record<string, unknown>
  presets: Record<string, EmailBodyBlock[]>
  previewValues: Record<string, string>
}

/**
 * EmailPreview — renders the email block body into a sandboxed iframe.
 *
 * Calls buildPreviewHtml (the Lexical→HTML renderer) and injects the resulting
 * complete HTML document into <iframe sandbox="" srcDoc=...> for strict
 * origin isolation — matching the existing TemplatePreview email branch pattern.
 */
export function EmailPreview({ body, styling, presets, previewValues }: EmailPreviewProps) {
  const html = buildPreviewHtml(body, styling, presets, previewValues)

  return (
    <iframe
      title={t("admin.notif.editor.previewTitle")}
      sandbox=""
      srcDoc={html}
      className="h-[480px] w-full rounded-md border border-border bg-white"
    />
  )
}
