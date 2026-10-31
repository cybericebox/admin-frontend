"use client"

import { useRef } from "react"
import { t } from "@/i18n/t"
import { MAX_COL_WIDTH, MIN_COL_WIDTH } from "./columns"

/** The grip on the right edge of a column header: drag (mouse and touch) or ←/→ resizes; the width is kept on release. */
export function ResizeHandle({ width, label, onLive, onCommit }: { width: number; label: string; onLive: (width: number) => void; onCommit: (width: number) => void }) {
  const origin = useRef<{ x: number; width: number } | null>(null)
  const clamp = (value: number) => Math.round(Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, value)))
  return <span role="separator" aria-orientation="vertical" aria-label={t("admin.table.resizeColumn", { name: label })} aria-valuenow={width} aria-valuemin={MIN_COL_WIDTH} aria-valuemax={MAX_COL_WIDTH} tabIndex={0}
    className="ib-resize" onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); origin.current = { x: event.clientX, width } }}
    onPointerMove={(event) => { if (origin.current) onLive(clamp(origin.current.width + event.clientX - origin.current.x)) }}
    onPointerUp={(event) => {
      if (!origin.current) return
      const next = clamp(origin.current.width + event.clientX - origin.current.x)
      origin.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
      onCommit(next)
    }}
    onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault()
      onCommit(clamp(width + (event.key === "ArrowRight" ? 16 : -16)))
    }} />
}
