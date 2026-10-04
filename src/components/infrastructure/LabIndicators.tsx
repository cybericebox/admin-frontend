"use client"

import { Hourglass, TriangleAlert } from "lucide-react"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { t } from "@/i18n/t"

const QUEUE_REASONS = ["InFlightLimit", "WaitingForGroup", "WaitingForTurn", "PreparingImages", "InsufficientResources", "NoSchedulableNodes"] as const

export function queueReasonLabel(reason: string): string {
  return t(`admin.labs.queue.reason.${(QUEUE_REASONS as readonly string[]).includes(reason) ? reason : "unknown"}`)
}

/** «In queue N/M» chip; the tooltip says why the lab waits. */
export function QueueBadge({ position, length, reason, labs }: { position: number; length: number; reason: string; labs?: number }) {
  const label = position > 0 && length > 0 ? t("admin.labs.queue.badge", { position, length }) : t("admin.labs.queue.badgeShort")
  const hint = labs && labs > 1 ? `${queueReasonLabel(reason)}. ${t("admin.labs.queue.labs", { count: labs })}` : queueReasonLabel(reason)
  return <HoverTooltip text={hint}>
    <span tabIndex={0} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-[var(--ib-warn-bg)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--ib-warn)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <Hourglass aria-hidden="true" className="h-3 w-3" />{label}
    </span>
  </HoverTooltip>
}

/** An image of the lab is pulled by tag, not pinned to a digest. */
export function ImageWarningIcon({ detail }: { detail?: string }) {
  const text = detail ? `${t("admin.labs.imageWarning")} ${detail}` : t("admin.labs.imageWarning")
  return <HoverTooltip text={text}>
    <span tabIndex={0} role="img" aria-label={text} className="inline-flex text-[var(--ib-warn)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <TriangleAlert aria-hidden="true" className="h-4 w-4" />
    </span>
  </HoverTooltip>
}
