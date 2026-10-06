"use client"
import { ERROR_STATUSES, type ErrorStatus } from "@/api/errorJournal"
import { t } from "@/i18n/t"
import { cn } from "@/utils/cn"

export const kindLabel = (kind: string) => t(`admin.errors.kind.${kind}`)
export const statusLabel = (status: string) => t(`admin.errors.status.${status}`)

export const errorGroupHref = (id: string, ref?: string) => `/errors/${encodeURIComponent(id)}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`

export const STATUS_TONE: Record<ErrorStatus, string> = {
  open: "bg-[var(--ib-danger-bg)] text-[var(--ib-danger)]",
  resolved: "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]",
  ignored: "bg-muted text-muted-foreground",
}

export function KindBadge({ kind }: { kind: string }) {
  return <span className="inline-flex whitespace-nowrap rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{kindLabel(kind)}</span>
}

/**
 * The status of a group as three choices. Every choice saves at once (the page shows it before the
 * server answers); nothing here ever disables, a pending save included. Read-only without write access.
 */
export function StatusSwitch({ status, onChange, readOnly = false, label }: {
  status: ErrorStatus
  onChange: (status: ErrorStatus) => void
  readOnly?: boolean
  label: string
}) {
  if (readOnly) return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", STATUS_TONE[status])}>{statusLabel(status)}</span>
  return <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-border bg-card">
    {ERROR_STATUSES.map((value) => {
      const active = value === status
      return <button key={value} type="button" role="radio" aria-checked={active} onClick={() => { if (!active) onChange(value) }}
        className={cn("min-h-8 px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
          active ? STATUS_TONE[value] : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
        {statusLabel(value)}
      </button>
    })}
  </div>
}
