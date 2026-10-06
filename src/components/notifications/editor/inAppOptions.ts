/**
 * inAppOptions.ts — In-app notification channel option constants.
 *
 * The frontend defines the label/value pairs; the backend accepts free strings
 * for Icon, Tone, Surface, and AccentColor. Appearance options drive the editor UI
 * and the live InAppPreview card.
 */

// ── Icons ─────────────────────────────────────────────────────────────────────

export const ICONS: { value: string; labelKey: string }[] = [
  { value: "info",    labelKey: "admin.notif.inapp.icon.info" },
  { value: "success", labelKey: "admin.notif.inapp.icon.success" },
  { value: "warning", labelKey: "admin.notif.inapp.icon.warning" },
  { value: "error",   labelKey: "admin.notif.inapp.icon.error" },
  { value: "bell",    labelKey: "admin.notif.inapp.icon.bell" },
  { value: "mail",    labelKey: "admin.notif.inapp.icon.mail" },
  { value: "calendar", labelKey: "admin.notif.inapp.icon.calendar" },
  { value: "user",    labelKey: "admin.notif.inapp.icon.user" },
  { value: "shield",  labelKey: "admin.notif.inapp.icon.shield" },
  { value: "trophy",  labelKey: "admin.notif.inapp.icon.trophy" },
]

export const APPEARANCES = [
  { tone: "neutral", icon: "bell", labelKey: "admin.notif.inapp.tone.neutral" },
  { tone: "info", icon: "info", labelKey: "admin.notif.inapp.tone.info" },
  { tone: "success", icon: "success", labelKey: "admin.notif.inapp.tone.success" },
  { tone: "warning", icon: "warning", labelKey: "admin.notif.inapp.tone.warning" },
  { tone: "danger", icon: "error", labelKey: "admin.notif.inapp.tone.danger" },
] as const

// ── Tones (default accent/border colours) ─────────────────────────────────────

export const TONES: { value: string; labelKey: string; color: string }[] = [
  { value: "neutral", labelKey: "admin.notif.inapp.tone.neutral", color: "#64748B" },
  { value: "info",    labelKey: "admin.notif.inapp.tone.info",    color: "#0091EA" },
  { value: "success", labelKey: "admin.notif.inapp.tone.success", color: "#16A34A" },
  { value: "warning", labelKey: "admin.notif.inapp.tone.warning", color: "#D97706" },
  { value: "danger",  labelKey: "admin.notif.inapp.tone.danger",  color: "#DC2626" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the default border/accent color for a tone value.
 * Falls back to neutral (#64748B) for unknown tones.
 */
export function toneColor(tone: string): string {
  return TONES.find((t) => t.value === tone)?.color ?? TONES[0].color
}

/**
 * Resolves the effective accent color for a template-like object.
 * If `AccentColor` is non-empty it takes precedence; otherwise the
 * tone's default color is used.
 */
export function accentOf(tmplLike: { Tone: string; AccentColor: string }): string {
  return /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(tmplLike.AccentColor)
    ? tmplLike.AccentColor
    : toneColor(tmplLike.Tone)
}

// The admin app's own notification surfaces (inbox, pop-in) take the tone colour from the DS state tokens,
// which hold contrast in both themes; an explicit AccentColor still wins. The template preview keeps the hex
// defaults because it shows how other apps draw the message.
const TONE_TOKENS: Record<string, string> = {
  neutral: "var(--ib-dim)",
  info: "var(--ib-action)",
  success: "var(--ib-ok)",
  warning: "var(--ib-warn)",
  danger: "var(--ib-danger)",
}

export function accentCss(tmplLike: { Tone: string; AccentColor: string }): string {
  return /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(tmplLike.AccentColor)
    ? tmplLike.AccentColor
    : TONE_TOKENS[tmplLike.Tone] ?? TONE_TOKENS.neutral
}
