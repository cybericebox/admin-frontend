import { t } from "@/i18n/t"

const ROLE_STYLES: Record<string, string> = {
  super_admin: "bg-primary/15 text-primary",
  admin: "bg-accent/40 text-accent-foreground",
  admin_viewer: "bg-secondary text-secondary-foreground",
  user: "bg-muted text-muted-foreground",
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  blocked: "bg-destructive/15 text-destructive",
  incomplete: "bg-muted text-muted-foreground",
  deleted: "bg-destructive/15 text-destructive",
}

function pill(styles: string, label: string) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  return pill(ROLE_STYLES[role] ?? "bg-muted text-muted-foreground", t(`admin.role.${role}`))
}

export function StatusBadge({ status }: { status: string }) {
  return pill(STATUS_STYLES[status] ?? "bg-muted text-muted-foreground", t(`admin.status.${status}`))
}
