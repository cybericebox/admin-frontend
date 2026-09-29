import { t } from "@/i18n/t"

// Humanise a backend notification-type key for display.
// "user.account_created" → "User Account Created": split on dots/underscores,
// drop empties, Title-Case each word. Backend keys stay the source of truth;
// this only affects how they are shown to admins.
export function formatNotifType(type: string): string {
  return type
    .split(/[._]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

// Localized label for a notification type. Falls back to the humanized key for
// types absent from the catalog (admin.notif.type.<key>), so a new backend type
// still renders readably before it is translated.
export function notifTypeLabel(type: string): string {
  const key = `admin.notif.type.${type}`
  const label = t(key)
  return label === key ? formatNotifType(type) : label
}

// Localized label for a dispatch status (done/pending/error/...). Falls back to
// the raw value if uncatalogued.
export function notifStatusLabel(status: string): string {
  const key = `admin.notif.status.${status}`
  const label = t(key)
  return label === key ? status : label
}

// Localized label for a channel (email/in_app). Falls back to the raw value.
export function notifChannelLabel(channel: string): string {
  const key = `admin.notif.channel.${channel}`
  const label = t(key)
  return label === key ? channel : label
}

// Localized label for a signal-default audience kind (e.g. "signal_subject").
// Falls back to the raw kind for values absent from the catalog.
export function notifAudienceLabel(kind: string): string {
  const key = `admin.notif.audience.${kind}`
  const label = t(key)
  return label === key ? kind : label
}

// The API keeps variable names stable for rendering. Translate only their
// explanatory text in the admin UI; new variables retain the API description.
export function notifVariableDescription(name: string, fallback: string): string {
  const key = `admin.notif.variable.${name}`
  const label = t(key)
  return label === key ? fallback : label
}

// Localized label for the mail transport a delivery used (event/platform/env).
// Empty for non-mail channels or unknown values; falls back to the raw value.
export function mailTransportLabel(transport: string | undefined | null): string {
  if (!transport) return ""
  const key = `admin.mail.transport.${transport}`
  const label = t(key)
  return label === key ? transport : label
}
