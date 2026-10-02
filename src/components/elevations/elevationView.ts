import type { ElevationStatus } from "@/api/elevations"

export const STATUS_STYLE: Record<ElevationStatus, string> = {
  pending: "bg-primary/10 text-primary",
  approved: "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]",
  rejected: "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]",
}
