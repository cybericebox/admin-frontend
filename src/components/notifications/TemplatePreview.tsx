"use client"
import DOMPurify from "isomorphic-dompurify"
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
    // Title and Link use renderTemplate without { html: true }, so the only HTML
    // in their output is renderTemplate's own <mark> highlight span — safe as-is.
    const title = renderTemplate(values.Title ?? "", vars)
    const link = renderTemplate(values.Link ?? "", vars)

    // Body is rendered with { html: true } (admin-authored rich HTML). Sanitize
    // before injection to prevent cross-admin stored-XSS: a template saved by
    // one admin could fire <img onerror=...> or inline scripts in the viewer's
    // privileged origin. isomorphic-dompurify works in both Node (SSR/prerender)
    // and the browser, so the static export build stays clean.
    const bodyRaw = renderTemplate(values.Body ?? "", vars, { html: true })
    const body = DOMPurify.sanitize(bodyRaw)

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

  // Subject and Preheader are plain-text fields rendered without { html: true };
  // renderTemplate only emits its own <mark> highlight span — safe as-is.
  const subject = renderTemplate(values.Subject ?? "", vars)
  const preheader = renderTemplate(values.Preheader ?? "", vars)
  // Email body is injected as <iframe sandbox="" srcDoc=...> — already origin-isolated.
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
