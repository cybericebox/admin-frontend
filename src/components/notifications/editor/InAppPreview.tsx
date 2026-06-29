"use client"
import DOMPurify from "isomorphic-dompurify"
import { Info, CheckCircle, AlertTriangle, XCircle, Bell } from "lucide-react"
import type { LucideProps } from "lucide-react"
import type { ComponentType } from "react"
import { t } from "@/i18n/t"
import { accentOf } from "./inAppOptions"

// ── Icon mapping ──────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  info:    Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error:   XCircle,
  bell:    Bell,
}

// ── Variable substitution ─────────────────────────────────────────────────────

/**
 * Replaces {{.Name}} and {{Name}} in `text` with previewValues[Name].
 * Unknown variable names expand to an empty string.
 */
function substitute(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\.?(\w+)\}\}/g, (_, name: string) => values[name] ?? "")
}

// ── Security helpers ──────────────────────────────────────────────────────────

/**
 * URL allowlist (mirrors previewHtml.ts safeURL):
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
 * - A left border coloured by accentOf({Tone,AccentColor})
 * - An icon glyph (lucide-react, mapped from the `icon` prop)
 * - Substituted title (plain text, React-escaped)
 * - Substituted body (may contain light HTML → sanitized with DOMPurify)
 * - Substituted link (plain text href, shown when non-empty)
 * - One action link per entry in `actions`
 * - An auto-hide hint when `autoDismissMs` is set
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
  autoDismissMs,
  actions,
  previewValues,
}: InAppPreviewProps) {
  const accent = accentOf({ Tone: tone, AccentColor: accentColor })

  const IconComponent = ICON_MAP[icon] ?? Bell

  const titleText = substitute(title, previewValues)
  const linkText  = substitute(link, previewValues)

  // Body may contain admin-authored HTML; sanitize to prevent stored-XSS.
  const bodyRaw   = substitute(body, previewValues)
  const cleanBody = DOMPurify.sanitize(bodyRaw)

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white shadow-sm"
      style={{ borderLeft: `4px solid ${accent}` }}
      data-surface={_surface}
      data-accent={accent}
    >
      <div className="flex gap-3 p-4">
        {/* Icon */}
        <div className="mt-0.5 shrink-0" style={{ color: accent }}>
          <IconComponent size={18} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-1">
          {/* Title */}
          {titleText !== "" && (
            <p className="text-sm font-semibold leading-snug text-slate-900">
              {titleText}
            </p>
          )}

          {/* Body */}
          {cleanBody !== "" && (
            <div
              className="text-sm leading-relaxed text-slate-600"
              dangerouslySetInnerHTML={{ __html: cleanBody }}
            />
          )}

          {/* Link */}
          {linkText !== "" && (
            <a
              href={safeURL(linkText)}
              className="inline-block text-xs font-medium underline"
              style={{ color: accent }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {linkText}
            </a>
          )}

          {/* Action buttons */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {actions.map((action, i) => (
                <a
                  key={i}
                  href={safeURL(action.href)}
                  className="rounded px-3 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: accent }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {action.label}
                </a>
              ))}
            </div>
          )}

          {/* Auto-hide hint */}
          {autoDismissMs !== null && (
            <p className="pt-1 text-xs text-slate-400">
              {t("admin.notif.inapp.autoHideHint")}{" "}
              {Math.round(autoDismissMs / 1000)}s
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
