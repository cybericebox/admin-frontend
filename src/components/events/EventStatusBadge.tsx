import { Badge, type BadgeTone } from "@/components/ui/badge"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import type { Event, EventLifecycleStatus } from "@/api/events/catalog"
import { t } from "@/i18n/t"

export type DisplayStatus = EventLifecycleStatus | "not_available" | "archived"

// Seven lifecycle states on five tones; the text always names the state, the tone only groups it.
const STATUS_TONE: Record<DisplayStatus, BadgeTone> = {
  not_available: "neutral",
  not_published: "warn",
  published: "info",
  started: "ok",
  finished: "neutral",
  withdrawn: "danger",
  archived: "neutral",
}

export function displayStatus(event: Event): DisplayStatus {
  return event.Status === "archived" ? "archived" : event.Status === "pending" ? "not_available" : event.LifecycleStatus ?? "not_published"
}

export function EventStatusBadge({ event, size = "sm" }: { event: Event; size?: "sm" }) {
  const status = displayStatus(event)
  return (
    <HoverTooltip text={t(`admin.events.lifecycle.help.${status}`)}>
      <Badge size={size} tone={STATUS_TONE[status]} tabIndex={0} aria-label={`${t(`admin.events.lifecycle.${status}`)}: ${t(`admin.events.lifecycle.help.${status}`)}`}>{t(`admin.events.lifecycle.${status}`)}</Badge>
    </HoverTooltip>
  )
}
