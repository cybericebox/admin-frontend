import { t } from "@/i18n/t"
import type { Broadcast } from "@/api/notifications/broadcasts"

export function broadcastChannelLabel(channel: string): string {
  const key = `admin.notif.broadcast.channel.${channel}`
  const label = t(key)
  return label === key ? channel : label
}

export function broadcastStatusLabel(status: string): string {
  const key = `admin.notif.broadcast.status.${status}`
  const label = t(key)
  return label === key ? status : label
}

// StatusPill styles are keyed by the dispatch vocabulary.
export function broadcastPillStatus(status: string): string {
  return status === "failed" ? "error" : status === "sending" ? "started" : status
}

/** Subject for an email broadcast, otherwise the in-app title. */
export function broadcastHeading(broadcast: Broadcast): string {
  return broadcast.Subject.trim() || broadcast.InAppTitle.trim() || "—"
}

/** Sample value of a variable for previews; event_* are empty in a platform broadcast. */
export function broadcastSample(name: string): string {
  return name.startsWith("event_") ? "" : t(`admin.notif.broadcast.sample.${name}`)
}
