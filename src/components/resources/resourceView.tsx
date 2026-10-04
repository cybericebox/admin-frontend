"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import type { Amount } from "@/api/resourceCalendar"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { t } from "@/i18n/t"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { formatDateTime } from "@/lib/locale"
import { usePolling } from "@/lib/usePolling"
import { cn } from "@/utils/cn"

/** Same height for loading, empty and error, so a block never jumps between them. */
export const BLOCK = "min-h-56"

export const formatAmount = (amount: Amount | null | undefined) => `${formatCpu(amount?.CPUMillicores ?? 0)} · ${formatBytes(amount?.MemoryBytes ?? 0)}`

export const formatWindow = (from: string | null | undefined, to: string | null | undefined) => `${formatDateTime(from, { dateStyle: "short", timeStyle: "short" })} – ${formatDateTime(to, { dateStyle: "short", timeStyle: "short" })}`

export type Tone = "ok" | "warn" | "danger" | "muted"

const TONE: Record<Tone, string> = {
  ok: "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]",
  warn: "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]",
  danger: "bg-[var(--ib-danger-bg)] text-[var(--ib-danger)]",
  muted: "bg-secondary text-muted-foreground",
}

export function Badge({ tone = "muted", children, ...rest }: { tone?: Tone; children: ReactNode; "data-testid"?: string }) {
  return <span {...rest} className={cn("inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", TONE[tone])}>{children}</span>
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th scope="col" className={cn("px-3 py-2 font-medium", className)}>{children}</th>
}

export const THEAD = "border-b border-border text-xs uppercase tracking-wider text-muted-foreground"
export const TROW = "border-b border-border/50 transition-colors hover:bg-accent/10"

/**
 * One calendar read kept fresh by polling. The first load shows the loader; later refreshes
 * and key changes keep the previous data on screen, so nothing flashes empty.
 */
export function useCalendarResource<T>(load: () => Promise<T>, enabled: boolean, key = "") {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  const run = useCallback(async () => {
    try {
      setData(await loadRef.current())
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [])
  const polling = usePolling(run, enabled)
  const { refresh } = polling
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    void refresh(true)
  }, [key, refresh])
  return { data, error, setData, ...polling }
}

/** «Save anyway»: asked after the backend answered 72504 (the change does not fit). */
export function AllowConflictsDialog({ open, busy, error, onCancel, onConfirm }: { open: boolean; busy: boolean; error?: string; onCancel: () => void; onConfirm: () => void }) {
  return <ConfirmDialog open={open} onCancel={onCancel} onConfirm={onConfirm} busy={busy} error={error}
    title={t("admin.resources.conflict.title")} description={t("admin.resources.conflict.description")} confirmLabel={t("admin.resources.conflict.confirm")} />
}
