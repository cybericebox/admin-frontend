"use client"
import DOMPurify from "isomorphic-dompurify"
import { t } from "@/i18n/t"
import { accentOf } from "./inAppOptions"
import { NotificationMessageCard } from "../NotificationMessageCard"
import { popInDuration } from "../popInDuration"

// ── Variable substitution ─────────────────────────────────────────────────────

/**
 * Replaces {{.Name}} and {{Name}} in `text` with previewValues[Name].
 * Unknown variable names expand to an empty string.
 */
function substitute(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*\.?(\w+)\s*\}\}/g, (_, name: string) => values[name] ?? "")
}

function substituteHtml(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*\.?(\w+)\s*\}\}/g, (_, name: string) =>
    (values[name] ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&#34;").replace(/'/g, "&#39;"))
}

// ── Security helpers ──────────────────────────────────────────────────────────

/**
 * URL allowlist (mirrors the backend email renderer's safeURL, render/blocks.go):
 *   permitted: http://, https://, mailto:, leading "/" (NOT "//"), leading "#"
 *   blocked:   javascript:, data:, vbscript:, protocol-relative "//…", anything else
 */
function safeURL(u: string): string {
  const s = u.trim()
  const low = s.toLowerCase()
  if (
    low.startsWith('http://') ||
    low.startsWith('https://') ||
    low.startsWith('mailto:') ||
    (s.startsWith('/') && !s.startsWith('//')) ||
    s.startsWith('#')
  ) {
    return s
  }
  return '#'
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface InAppPreviewProps {
  title: string
  body: string
  link: string
  icon: string
  tone: string
  accentColor: string
  surface: string
  autoDismissMs: number | null
  actions: { label: string; href: string }[]
  previewValues: Record<string, string>
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * InAppPreview — live preview card for in-app notification templates.
 *
 * Renders a notification card with:
 * - A quiet icon tile coloured by accentOf({Tone,AccentColor})
 * - Substituted title (plain text, React-escaped)
 * - Substituted body (may contain light HTML → sanitized with DOMPurify)
 * - Substituted link (plain text href, shown when non-empty)
 * - One action link per entry in `actions`
 *
 * Variable substitution: replaces {{.Name}} and {{Name}} with previewValues[Name].
 * Title and link are text — React escapes them automatically.
 * Body may contain HTML → isomorphic-dompurify before dangerouslySetInnerHTML.
 */
export function InAppPreview({
  title,
  body,
  link,
  icon,
  tone,
  accentColor,
  surface: _surface,
  autoDismissMs: _autoDismissMs,
  actions,
  previewValues,
}: InAppPreviewProps) {
  const accent = accentOf({ Tone: tone, AccentColor: accentColor })

  const titleText = substitute(title, previewValues)
  const linkText  = substitute(link, previewValues)

  // Body may contain admin-authored HTML; sanitize to prevent stored-XSS.
  const bodyRaw   = substituteHtml(body, previewValues)
  const cleanBody = DOMPurify.sanitize(bodyRaw)

  return (
    <div>
    <div
      className="rounded-lg border border-border bg-card text-card-foreground shadow-sm"
      data-surface={_surface}
      data-accent={accent}
    >
      <div className="p-4">
        <NotificationMessageCard
          icon={icon}
          tone={tone}
          accentColor={accentColor}
          title={titleText}
          body={cleanBody && <div dangerouslySetInnerHTML={{ __html: cleanBody }} />}
          actions={(linkText || actions.length > 0) ? <>
            {linkText && <a href={safeURL(linkText)} className="text-sm font-medium underline underline-offset-2" style={{ color: accent }} target="_blank" rel="noopener noreferrer">{t("admin.notif.inapp.openLink")}</a>}
            {actions.slice(0, 1).map((action, i) => <a key={i} href={safeURL(action.href)} className="inline-flex min-h-9 items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent" target="_blank" rel="noopener noreferrer">{action.label}</a>)}
          </> : undefined}
        />
      </div>
    </div>
    {_surface === "inbox" && popInDuration(_autoDismissMs) > 0 && <p className="mt-2 text-xs text-muted-foreground">
      {t("admin.notif.inapp.popInPreview")} · {popInDuration(_autoDismissMs) / 1000} {t("admin.notif.inapp.seconds")}
    </p>}
    </div>
  )
}
