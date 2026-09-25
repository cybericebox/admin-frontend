"use client"

import { useEffect, useRef, useState, type ReactElement } from "react"
import { createPortal } from "react-dom"

type Position = { left: number; top: number; below: boolean }

// A tooltip is not a popover: clicks and focus must not toggle its visibility.
export function HoverTooltip({ text, children }: { text: string; children: ReactElement }) {
  const [position, setPosition] = useState<Position | null>(null)
  const trigger = useRef<HTMLSpanElement>(null)

  const open = () => {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    const halfWidth = Math.min(152, window.innerWidth / 2)
    setPosition({
      left: Math.max(halfWidth, Math.min(window.innerWidth - halfWidth, rect.left + rect.width / 2)),
      top: rect.top >= 56 ? rect.top - 7 : rect.bottom + 7,
      below: rect.top < 56,
    })
  }

  useEffect(() => {
    if (!position) return
    const close = () => setPosition(null)
    const closeOutside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node)) close()
    }
    const closeOnWindowExit = (event: PointerEvent) => {
      if (!event.relatedTarget) close()
    }
    document.addEventListener("pointermove", closeOutside, true)
    window.addEventListener("pointerout", closeOnWindowExit, true)
    window.addEventListener("blur", close)
    document.addEventListener("visibilitychange", close)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      document.removeEventListener("pointermove", closeOutside, true)
      window.removeEventListener("pointerout", closeOnWindowExit, true)
      window.removeEventListener("blur", close)
      document.removeEventListener("visibilitychange", close)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [position])

  return <>
    <span
      ref={trigger}
      className="inline-flex"
      onPointerEnter={open}
      onPointerLeave={() => setPosition(null)}
      onMouseEnter={open}
      onMouseLeave={() => setPosition(null)}
      onFocusCapture={open}
      onBlurCapture={() => setPosition(null)}
      onKeyDown={(event) => { if (event.key === "Escape") setPosition(null) }}
    >{children}</span>
    {position && createPortal(
      <div
        role="tooltip"
        className="pointer-events-none fixed z-[100] max-w-72 whitespace-pre-line rounded-md border border-border bg-popover px-2.5 py-2 text-xs font-normal leading-relaxed text-popover-foreground shadow-md"
        style={{ left: position.left, top: position.top, transform: `translate(-50%, ${position.below ? "0" : "-100%"})` }}
      >{text}</div>,
      document.body,
    )}
  </>
}
