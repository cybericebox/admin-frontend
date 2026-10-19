"use client"

import { Hourglass, TriangleAlert } from "lucide-react"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import type { StandQueue } from "@/api/infrastructure"
import { formatDateTime } from "@/lib/locale"
import { t } from "@/i18n/t"

const QUEUE_REASONS = ["InFlightLimit", "WaitingForGroup", "WaitingForTurn", "PreparingImages", "InsufficientResources", "NoSchedulableNodes", "TenantQuota",
  "DoesNotFitNow", "ReservationMissing", "ReservationNotActive", "ReservationFull"] as const

/** What the backend adds to a wait: the attempt and retry time of a withdrawn launch, since when a lab waits for a new node. */
type QueueDetails = { Attempt?: number; RetryAt?: string | null; WaitingSince?: string | null }
type QueueLike = QueueDetails & { Position: number; Length: number; Reason: string }

const clock = (iso: string) => formatDateTime(iso, { hour: "2-digit", minute: "2-digit" })

export function queueReasonLabel(reason: string, details: QueueDetails = {}): string {
  if (reason === "NodeStarting") {
    return details.WaitingSince ? t("admin.labs.queue.reason.NodeStarting.since", { time: clock(details.WaitingSince) }) : t("admin.labs.queue.reason.NodeStarting")
  }
  if (reason === "Withdrawn") {
    return details.Attempt && details.RetryAt ? t("admin.labs.queue.reason.Withdrawn.retry", { attempt: details.Attempt, time: clock(details.RetryAt) }) : t("admin.labs.queue.reason.Withdrawn")
  }
  return t(`admin.labs.queue.reason.${(QUEUE_REASONS as readonly string[]).includes(reason) ? reason : "unknown"}`)
}

/** The labs of a stand the indicator speaks about: the ones waiting for a new node when that is the reason, else the queued ones. */
export function standQueueLabs(queue: StandQueue | null | undefined): number {
  if (!queue) return 0
  return queue.Reason === "NodeStarting" ? queue.NodeStartingLabs ?? 0 : queue.QueuedLabs
}

/** The scheduler state of a lab or stand: its queue place while pods wait to be sent, or «waiting for a node» once every pod is sent
 * and some have no node yet. Nothing when neither. */
export function LabQueueIndicator({ queue, labs }: { queue: QueueLike | null | undefined; labs?: number }) {
  if (!queue) return null
  if (queue.Reason === "NodeStarting") {
    const reason = queueReasonLabel(queue.Reason, queue)
    return <HoverTooltip text={labs && labs > 1 ? t("admin.labs.queue.nodeLabs", { reason, count: labs }) : reason}>
      <span tabIndex={0} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-[var(--ib-warn-bg)] px-2 py-0.5 text-xs font-medium text-[var(--ib-warn)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <Hourglass aria-hidden="true" className="h-3 w-3" />{t("admin.labs.queue.nodeBadge")}
      </span>
    </HoverTooltip>
  }
  if (queue.Position <= 0) return null
  return <QueueBadge position={queue.Position} length={queue.Length} reason={queue.Reason} details={queue} labs={labs} />
}

/** «In queue N/M» chip; the tooltip says why the lab waits. */
export function QueueBadge({ position, length, reason, details, labs }: { position: number; length: number; reason: string; details?: QueueDetails; labs?: number }) {
  const label = position > 0 && length > 0 ? t("admin.labs.queue.badge", { position, length }) : t("admin.labs.queue.badgeShort")
  const hint = labs && labs > 1 ? t("admin.labs.queue.reasonLabs", { reason: queueReasonLabel(reason, details), count: labs }) : queueReasonLabel(reason, details)
  return <HoverTooltip text={hint}>
    <span tabIndex={0} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-[var(--ib-warn-bg)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--ib-warn)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <Hourglass aria-hidden="true" className="h-3 w-3" />{label}
    </span>
  </HoverTooltip>
}

/** An image of the lab is pulled by tag, not pinned to a digest. */
export function ImageWarningIcon({ detail }: { detail?: string }) {
  const text = detail ? t("admin.labs.imageWarningDetail", { detail }) : t("admin.labs.imageWarning")
  return <HoverTooltip text={text}>
    <span tabIndex={0} role="img" aria-label={text} className="inline-flex text-[var(--ib-warn)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <TriangleAlert aria-hidden="true" className="h-4 w-4" />
    </span>
  </HoverTooltip>
}
