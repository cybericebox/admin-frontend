"use client"
import { renderTemplate } from "@/lib/renderTemplate"
import { t } from "@/i18n/t"

// Live preview of a template. `vars` maps variable name → sample value (each
// type's Default). In-app renders a mock card; email renders the HTML body in a
// sandboxed iframe with the subject/preheader above it.
export function TemplatePreview({
  channel,
  values,
  vars,
}: {
  channel: "inapp" | "email"
  values: Record<string, string>
  vars: Record<string, string>
}) {
  if (channel === "inapp") {
    const title = renderTemplate(values.Title ?? "", vars)
    const body = renderTemplate(values.Body ?? "", vars, { html: true })
    const link = renderTemplate(values.Link ?? "", vars)
    return (
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold text-foreground" dangerouslySetInnerHTML={{ __html: title }} />
        <div className="mt-1 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: body }} />
        {(values.Link ?? "") !== "" && (
          <p className="mt-2 text-xs text-primary underline" dangerouslySetInnerHTML={{ __html: link }} />
        )}
      </div>
    )
  }

  const subject = renderTemplate(values.Subject ?? "", vars)
  const preheader = renderTemplate(values.Preheader ?? "", vars)
  const body = renderTemplate(values.Body ?? "", vars, { html: true })
  const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;color:#0b1233;margin:16px}</style></head><body>${body}</body></html>`
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.tpl.subject")}</p>
        <p className="text-sm font-medium text-foreground" dangerouslySetInnerHTML={{ __html: subject }} />
        {(values.Preheader ?? "") !== "" && (
          <p className="mt-0.5 text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: preheader }} />
        )}
      </div>
      <iframe
        title={t("admin.notif.tpl.previewEmail")}
        sandbox=""
        srcDoc={srcdoc}
        className="h-80 w-full rounded-md border border-border bg-white"
      />
    </div>
  )
}
