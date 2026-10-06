import type { ReactNode } from "react"
import { NotificationIcon } from "./NotificationIcon"
import { t } from "@/i18n/t"
import { keepBrand } from "@/i18n/brand"

export type NotificationMessageCardProps = {
  icon?: string
  tone?: string
  accentColor?: string
  title?: string
  body?: ReactNode
  timestamp?: ReactNode
  unread?: boolean
  actions?: ReactNode
  compact?: boolean
}

/** The platform's notification layout. Keep this component self-contained for later copies to other frontends. */
export function NotificationMessageCard({ icon = "bell", tone = "neutral", accentColor = "", title, body, timestamp, unread = false, actions, compact = false }: NotificationMessageCardProps) {
  return <div className="flex min-w-0 items-start gap-3 text-left">
    <NotificationIcon icon={icon} tone={tone} accentColor={accentColor} size={compact ? "sm" : "md"} />
    <div className="min-w-0 flex-1">
      {title && <div className="flex min-w-0 items-start gap-2">
        <p className={`min-w-0 flex-1 break-words text-sm leading-snug text-foreground ${unread ? "font-semibold" : "font-medium"}`}>{keepBrand(title)}</p>
        {unread && <span className="shrink-0 text-xs font-medium text-[var(--ib-action)]">{t("inbox.unreadBadge")}<span className="sr-only">{t("inbox.unreadItemSr")}</span></span>}
      </div>}
      {body && <div className={`${title ? "mt-1" : ""} break-words text-sm leading-relaxed text-muted-foreground ${compact ? "line-clamp-2" : ""}`}>{body}</div>}
      {timestamp && <div className="mt-1.5 text-xs text-muted-foreground">{timestamp}</div>}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  </div>
}
