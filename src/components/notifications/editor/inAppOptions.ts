/**
 * inAppOptions.ts — In-app notification channel option constants.
 *
 * The frontend defines the label/value pairs; the backend accepts free strings
 * for Icon, Tone, Surface, and AccentColor. These lists drive the editor UI
 * and the live InAppPreview card.
 */

// ── Icons ─────────────────────────────────────────────────────────────────────

export const ICONS: { value: string; labelKey: string }[] = [
  { value: "info",    labelKey: "admin.notif.inapp.icon.info" },
  { value: "success", labelKey: "admin.notif.inapp.icon.success" },
  { value: "warning", labelKey: "admin.notif.inapp.icon.warning" },
  { value: "error",   labelKey: "admin.notif.inapp.icon.error" },
  { value: "bell",    labelKey: "admin.notif.inapp.icon.bell" },
]

// ── Tones (default accent/border colours) ─────────────────────────────────────

export const TONES: { value: string; labelKey: string; color: string }[] = [
  { value: "neutral", labelKey: "admin.notif.inapp.tone.neutral", color: "#64748B" },
  { value: "info",    labelKey: "admin.notif.inapp.tone.info",    color: "#0091EA" },
  { value: "success", labelKey: "admin.notif.inapp.tone.success", color: "#16A34A" },
  { value: "warning", labelKey: "admin.notif.inapp.tone.warning", color: "#D97706" },
  { value: "danger",  labelKey: "admin.notif.inapp.tone.danger",  color: "#DC2626" },
]

// ── Surfaces ─────────────────────────────────────────────────────────────────

export const SURFACES: { value: string; labelKey: string }[] = [
  { value: "inbox",  labelKey: "admin.notif.inapp.surface.inbox" },
  { value: "banner", labelKey: "admin.notif.inapp.surface.banner" },
  { value: "toast",  labelKey: "admin.notif.inapp.surface.toast" },
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
  return tmplLike.AccentColor !== "" ? tmplLike.AccentColor : toneColor(tmplLike.Tone)
}
