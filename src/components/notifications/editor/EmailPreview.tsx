"use client"
import { buildPreviewHtml } from "@/components/notifications/editor/previewHtml"
import type { EmailBodyBlock } from "@/components/notifications/editor/emailBlocks"
import { t } from "@/i18n/t"

export interface EmailPreviewProps {
  subject?: string
  preheader?: string
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
function previewText(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*\.?([A-Za-z_]\w*)\s*\}\}/g, (token, name: string) => values[name] ?? token)
}

export function EmailPreview({ subject = "", preheader = "", body, styling, presets, previewValues }: EmailPreviewProps) {
  const html = buildPreviewHtml(body, styling, presets, previewValues)

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="space-y-2 border-b border-border px-4 py-3 text-sm">
        <div><span className="text-muted-foreground">{t("admin.notif.tpl.subject")}: </span><span className="font-medium text-foreground">{previewText(subject, previewValues) || "—"}</span></div>
        <div className="text-xs"><span className="text-muted-foreground">{t("admin.notif.tpl.preheader")}: </span><span className="text-foreground">{previewText(preheader, previewValues) || "—"}</span></div>
      </div>
      <iframe
        title={t("admin.notif.editor.previewTitle")}
        sandbox=""
        srcDoc={html}
        className="h-[480px] w-full bg-white"
      />
    </div>
  )
}
