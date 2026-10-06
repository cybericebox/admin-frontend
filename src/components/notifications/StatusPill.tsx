import { Badge, type BadgeTone } from "@/components/ui/badge"
import { notifStatusLabel } from "@/utils/notifType"

const TONES: Record<string, BadgeTone> = {
  done: "ok",
  active: "ok",
  published: "ok",
  error: "danger",
  deferred: "info",
  started: "info",
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <Badge tone={TONES[status] ?? "neutral"}>{label ?? notifStatusLabel(status)}</Badge>
}
