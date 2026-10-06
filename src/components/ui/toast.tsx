"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { t } from "@/i18n/t"
import { CheckCircle2, CircleAlert, TriangleAlert, X } from "lucide-react"

type Tone = "success" | "warning" | "error"
type Toast = { id: number; message: string; tone: Tone }
let nextToastId = 0
const listeners = new Set<(item: Toast) => void>()

export const toast = {
  success: (message: string) => { const item = { id: ++nextToastId, message, tone: "success" as const }; listeners.forEach((listener) => listener(item)) },
  warning: (message: string) => { const item = { id: ++nextToastId, message, tone: "warning" as const }; listeners.forEach((listener) => listener(item)) },
  error: (message: string) => { const item = { id: ++nextToastId, message, tone: "error" as const }; listeners.forEach((listener) => listener(item)) },
}

const toneStyle: Record<Tone, string> = {
  success: "border-[var(--ib-ok)] bg-[var(--ib-ok-bg)] text-foreground",
  warning: "border-[var(--ib-warn)] bg-[var(--ib-warn-bg)] text-foreground",
  error: "border-destructive bg-destructive/15 text-foreground",
}
const iconStyle: Record<Tone, string> = {
  success: "text-[var(--ib-ok)]",
  warning: "text-[var(--ib-warn)]",
  error: "text-destructive",
}

// Success disappears after 5 s, a warning after 8 s, an error stays until it is closed. The timer is per toast and
// pauses while the pointer is over the toast or focus is inside it.
const LIFETIME: Record<Tone, number | null> = { success: 5000, warning: 8000, error: null }

function ToastItem({ item, onDismiss }: { item: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false)
  const life = LIFETIME[item.tone]
  useEffect(() => {
    if (life === null || paused) return
    const timer = window.setTimeout(() => onDismiss(item.id), life)
    return () => window.clearTimeout(timer)
  }, [life, paused, item.id, onDismiss])

  return <div role={item.tone === "success" ? "status" : "alert"} data-tone={item.tone}
    onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}
    className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${toneStyle[item.tone]}`}>
    {item.tone === "success" ? <CheckCircle2 aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${iconStyle[item.tone]}`} />
      : item.tone === "warning" ? <TriangleAlert aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${iconStyle[item.tone]}`} />
        : <CircleAlert aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${iconStyle[item.tone]}`} />}
    <span className="min-w-0 flex-1">{item.message}</span>
    <button type="button" aria-label={t("ui.toast.close")} onClick={() => onDismiss(item.id)}
      className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
      <X aria-hidden="true" className="h-4 w-4" />
    </button>
  </div>
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  useEffect(() => {
    const receive = (item: Toast) => setItems((current) => [...current.slice(-3), item])
    listeners.add(receive)
    return () => { listeners.delete(receive) }
  }, [])

  return <>
    {children}
    <div role="region" className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2" aria-label={t("ui.toast.region")}>
      {items.map((item) => <ToastItem key={item.id} item={item} onDismiss={dismiss} />)}
    </div>
  </>
}
