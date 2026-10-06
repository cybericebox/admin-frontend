import { Badge, type BadgeTone } from "@/components/ui/badge"
import { t } from "@/i18n/t"
import { roleLabel } from "@/lib/roles"

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "ok",
  blocked: "danger",
  incomplete: "neutral",
  deleted: "danger",
}

export function RoleBadge({ role, size }: { role: string; size?: "sm" }) {
  return <Badge size={size}>{roleLabel(role)}</Badge>
}

export function StatusBadge({ status, size }: { status: string; size?: "sm" }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"} size={size}>{t(`admin.status.${status}`)}</Badge>
}
