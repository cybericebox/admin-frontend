"use client"
import { useEffect, useRef, useState } from "react"
import { Expand, Monitor, Smartphone, Tablet, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { ApiError } from "@/api/client"
import { LoadError } from "@/components/ui/load-error"
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
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`
}

/**
 * EmailHtmlFrame — backend-rendered email HTML in a fully isolated iframe
 * (sandbox="": no scripts, forms, popups or same-origin access). Shared by the
 * template preview and the platform footer preview, so both look alike.
 */
const VIEWPORTS = [
  { key: "desktop", width: 1024, icon: Monitor },
  { key: "tablet", width: 768, icon: Tablet },
  { key: "mobile", width: 390, icon: Smartphone },
] as const

/** A fixed responsive document viewport, scaled to fit its own visible container. */
function EmailViewport({ html, width, className }: { html: string; width: number; className: string }) {
  const viewport = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState({ width: 0, height: 0 })
  const scale = available.width > 0 ? Math.min(1, available.width / width) : 1

  useEffect(() => {
    const shell = viewport.current
    if (!shell) return
    const measure = () => {
      const bounds = shell.getBoundingClientRect()
      setAvailable({ width: bounds.width, height: bounds.height })
    }
    measure()
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure)
      return () => window.removeEventListener("resize", measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(shell)
    return () => observer.disconnect()
  }, [])

  return <div ref={viewport} className={`relative w-full overflow-hidden bg-secondary ${className}`}>
    <div className="relative mx-auto h-full" style={{ width: width * scale }}>
      <iframe title={t("admin.notif.editor.previewTitle")} sandbox="" scrolling="yes" srcDoc={previewDocument(html)}
        className="absolute left-0 top-0 border-0 bg-white"
        style={{ width, height: available.height > 0 ? available.height / scale : "100%", transform: `scale(${scale})`, transformOrigin: "top left" }} />
    </div>
  </div>
}

export function EmailHtmlFrame({ html, className = "h-[480px]" }: { html: string; className?: string }) {
  const [device, setDevice] = useState<(typeof VIEWPORTS)[number]["key"]>("desktop")
  const [expanded, setExpanded] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const width = VIEWPORTS.find((preset) => preset.key === device)!.width

  return (
    <Dialog open={expanded} onOpenChange={setExpanded}>
    <div className="min-w-0 w-full overflow-hidden">
      <div role="group" aria-label={t("admin.emailPreview.viewport")} className="flex flex-wrap gap-1 border-b border-border bg-card p-2">
        {VIEWPORTS.map(({ key, width: presetWidth, icon: Icon }) => (
          <Button key={key} type="button" size="sm" variant={device === key ? "secondary" : "ghost"} aria-pressed={device === key} onClick={() => setDevice(key)}>
            <Icon className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t(`admin.emailPreview.${key}`)}
            <span aria-hidden="true" className="ml-1.5 text-[10px] font-normal text-muted-foreground">{presetWidth}</span>
          </Button>
        ))}
      </div>
      <div className="flex justify-end border-b border-border bg-card px-2 pb-2">
        <DialogTrigger asChild><Button type="button" variant="ghost" size="sm"><Expand className="mr-1.5 h-4 w-4" aria-hidden />{t("admin.emailPreview.expand")}</Button></DialogTrigger>
      </div>
      <EmailViewport html={html} width={width} className={className} />
        <DialogContent className="flex h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl flex-col overflow-hidden" aria-describedby={undefined} onOpenAutoFocus={(event) => { event.preventDefault(); heading.current?.focus() }}>
          <div className="flex shrink-0 items-center justify-between gap-3">
            <DialogTitle ref={heading} tabIndex={-1} className="focus:outline-none">{t("admin.emailPreview.expanded")}</DialogTitle>
            <HoverTooltip text={t("admin.emailPreview.close")}><DialogClose asChild><Button type="button" variant="ghost" size="icon" aria-label={t("admin.emailPreview.close")}><X className="h-4 w-4" aria-hidden /></Button></DialogClose></HoverTooltip>
          </div>
          <EmailViewport html={html} width={width} className="min-h-0 flex-1" />
        </DialogContent>
    </div>
    </Dialog>
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
  // A 400 is the backend's reason the draft cannot be rendered (`reason`); anything else is a failed load (`cause`).
  const [error, setError] = useState<{ reason?: string; cause?: unknown } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
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
          setError(err instanceof ApiError && err.status === 400 ? { reason: err.message } : { cause: err })
        },
      )
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [notificationType, subject, preheader, body, styling, reloadKey])

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-border bg-background">
      <div className="space-y-2 border-b border-border px-4 py-3 text-sm">
        <div><span className="text-muted-foreground">{t("admin.notif.tpl.subject")}: </span><span className="font-medium text-foreground">{result?.Subject || "—"}</span></div>
        <div className="text-xs"><span className="text-muted-foreground">{t("admin.notif.tpl.preheader")}: </span><span className="text-foreground">{result?.Preheader || "—"}</span></div>
      </div>
      {error?.reason && (
        <p role="alert" className="border-b border-border px-4 py-2 text-xs text-destructive">{error.reason}</p>
      )}
      {error && !error.reason && (
        <div className="border-b border-border"><LoadError message={t("admin.notif.editor.previewError")} error={error.cause} compact onRetry={() => setReloadKey((key) => key + 1)} /></div>
      )}
      <EmailHtmlFrame html={result?.HTML ?? ""} />
    </div>
  )
}
