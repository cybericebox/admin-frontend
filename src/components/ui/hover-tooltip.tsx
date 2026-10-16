"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/utils/cn"

type Position = { left: number; top: number; below: boolean }

const GAP = 7
const MARGIN = 8
// DS tooltip contract (components/tooltip/tooltip.css): hover opens after 300 ms, the bubble is hoverable, Esc dismisses.
const HOVER_DELAY = 300
const LEAVE_DELAY = 120

type Props = {
  text: string
  content?: ReactNode
  children: ReactElement
  className?: string
  side?: "top" | "right"
  // Links the bubble to the child through aria-describedby (the text never goes into the accessible name).
  describe?: boolean
  // Opens only while the child's text is actually cut off by an ellipsis.
  truncated?: boolean
  // Field help: a tap, click, Enter or Space toggles the bubble (touch never opens it by hover) and focus alone does not open it.
  help?: boolean
  // Allows a touch tap / click to pin an otherwise hover-and-focus tooltip.
  tap?: boolean
  // Delegate to DOM-owned children (contentEditable pills) without rewriting serialized HTML.
  delegate?: string
  textForTarget?: (target: HTMLElement) => string
}

// With describe (field help) the bubble stays in the DOM, hidden, so aria-describedby always points at a real node;
// any other tooltip is mounted only while it is open.
export function HoverTooltip({ text, content, children, className, side = "top", describe = false, truncated = false, help = false, tap = false, delegate, textForTarget }: Props) {
  const id = useId()
  const delegated = useRef<HTMLElement | null>(null)
  const [delegatedTarget, setDelegatedTarget] = useState<HTMLElement | null>(null)
  const [delegatedText, setDelegatedText] = useState("")
  if (delegate) text = delegatedText
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const trigger = useRef<HTMLSpanElement>(null)
  const tooltip = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<number | undefined>(undefined)
  const leaveTimer = useRef<number | undefined>(undefined)
  const pressed = useRef(false)
  const long = text.length > 180
  const visible = !dismissed && (hovered || focused || pinned) && position !== null

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the portal target exists only in the browser
    setMounted(true)
    return () => { window.clearTimeout(enterTimer.current); window.clearTimeout(leaveTimer.current) }
  }, [])

  const place = useCallback((): boolean => {
    const rect = (delegated.current ?? trigger.current)?.getBoundingClientRect()
    if (!rect) return false
    const child = delegate ? delegated.current : trigger.current?.firstElementChild
    if (truncated && child && child.scrollWidth <= child.clientWidth) return false
    if (side === "right") {
      setPosition({ left: rect.right + GAP, top: rect.top + rect.height / 2, below: false })
      return true
    }
    const targetLong = delegate && delegated.current ? (textForTarget?.(delegated.current)?.length ?? 0) > 180 : long
    const halfWidth = Math.min(targetLong ? 220 : 152, window.innerWidth / 2)
    setPosition({
      left: Math.max(halfWidth, Math.min(window.innerWidth - halfWidth, rect.left + rect.width / 2)),
      top: rect.top >= 56 ? rect.top - 7 : rect.bottom + 7,
      below: rect.top < 56,
    })
    return true
  }, [long, side, truncated, delegate, textForTarget])

  const hide = useCallback(() => {
    window.clearTimeout(enterTimer.current)
    window.clearTimeout(leaveTimer.current)
    setHovered(false)
    setFocused(false)
    setPinned(false)
  }, [])

  const enter = (event: { pointerType?: string }) => {
    window.clearTimeout(leaveTimer.current)
    // Hover never opens on touch: a tap toggles (help) or does nothing.
    if (event.pointerType === "touch" || hovered) return
    window.clearTimeout(enterTimer.current)
    enterTimer.current = window.setTimeout(() => { if (place()) setHovered(true) }, HOVER_DELAY)
  }
  const leave = () => {
    window.clearTimeout(enterTimer.current)
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => setHovered(false), LEAVE_DELAY)
  }
  const keepOpen = () => window.clearTimeout(leaveTimer.current)

  const focusIn = () => {
    setDismissed(false)
    if (help) return
    // Focus that comes from a pointer press is not keyboard focus: hover already covers it.
    const keyboard = !pressed.current
    pressed.current = false
    if (keyboard && place()) setFocused(true)
  }

  const toggleOnClick = () => {
    if (!help && !tap && !delegate) return
    setDismissed(false)
    if (pinned) { setPinned(false); return }
    if (place()) setPinned(true)
  }

  useLayoutEffect(() => {
    if (!visible) return
    const anchor = (delegated.current ?? trigger.current)?.getBoundingClientRect()
    const height = tooltip.current?.getBoundingClientRect().height ?? 0
    if (!anchor || !height || !position) return
    if (side === "right") {
      const top = Math.max(MARGIN + height / 2, Math.min(window.innerHeight - MARGIN - height / 2, anchor.top + anchor.height / 2))
      if (top !== position.top) setPosition({ ...position, top })
      return
    }
    const above = anchor.top - 8
    const below = window.innerHeight - anchor.bottom - 8
    const placeBelow = above < height && below > above
    if (placeBelow !== position.below) {
      setPosition({ ...position, top: placeBelow ? anchor.bottom + 7 : anchor.top - 7, below: placeBelow })
    }
  }, [visible, position, side])

  useEffect(() => {
    const child = delegate ? delegated.current : trigger.current?.firstElementChild
    if (!describe || !child) return
    const previous = child.getAttribute("aria-describedby")
    child.setAttribute("aria-describedby", previous ? `${previous} ${id}` : id)
    return () => { if (previous) child.setAttribute("aria-describedby", previous); else child.removeAttribute("aria-describedby") }
  }, [describe, id, mounted, delegatedTarget, delegate])

  // Help triggers expose the open state.
  useEffect(() => {
    const child = delegate ? delegated.current : trigger.current?.firstElementChild
    if (!help || !child) return
    child.setAttribute("aria-expanded", pinned ? "true" : "false")
  }, [help, tap, pinned, delegate])

  useEffect(() => {
    if (!visible) return
    const inside = (node: EventTarget | null) => !!(node as Node | null) && ((delegate ? delegated.current : trigger.current)?.contains(node as Node) || tooltip.current?.contains(node as Node))
    const outsideMove = (event: PointerEvent) => { if (!inside(event.target)) setHovered(false) }
    const outsideDown = (event: PointerEvent) => { if (!inside(event.target)) hide() }
    const exitWindow = (event: PointerEvent) => { if (!event.relatedTarget) setHovered(false) }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      const wasPinned = pinned
      hide()
      setDismissed(true)
      // A bubble opened by tap or Enter returns focus to its trigger.
      if (wasPinned) (delegated.current ?? trigger.current?.firstElementChild as HTMLElement | null)?.focus()
    }
    document.addEventListener("pointermove", outsideMove, true)
    document.addEventListener("pointerdown", outsideDown, true)
    document.addEventListener("keydown", escape)
    window.addEventListener("pointerout", exitWindow, true)
    window.addEventListener("blur", hide)
    document.addEventListener("visibilitychange", hide)
    window.addEventListener("scroll", hide, true)
    window.addEventListener("resize", hide)
    return () => {
      document.removeEventListener("pointermove", outsideMove, true)
      document.removeEventListener("pointerdown", outsideDown, true)
      document.removeEventListener("keydown", escape)
      window.removeEventListener("pointerout", exitWindow, true)
      window.removeEventListener("blur", hide)
      document.removeEventListener("visibilitychange", hide)
      window.removeEventListener("scroll", hide, true)
      window.removeEventListener("resize", hide)
    }
  }, [visible, pinned, hide, delegate])

  const selectTarget = (target: EventTarget | null): boolean => {
    if (!delegate) return true
    const element = target instanceof Element ? target.closest<HTMLElement>(delegate) : null
    if (!element || !trigger.current?.contains(element)) return false
    if (delegated.current !== element) {
      hide()
      delegated.current = element
      setDelegatedTarget(element)
      setDelegatedText(textForTarget?.(element) ?? "")
      setDismissed(false)
    }
    return true
  }

  return <>
    <span
      ref={trigger}
      className={cn("inline-flex", className)}
      onPointerEnter={delegate ? undefined : enter}
      onPointerOver={delegate ? (event) => { if (selectTarget(event.target)) enter(event) } : undefined}
      onPointerOut={delegate ? (event) => { if (!delegated.current?.contains(event.relatedTarget as Node | null)) leave() } : undefined}
      onPointerLeave={leave}
      onMouseEnter={delegate ? undefined : () => enter({})}
      onMouseLeave={leave}
      onFocusCapture={(event) => { if (selectTarget(event.target)) focusIn(); else if (delegate) hide() }}
      onInputCapture={delegate ? hide : undefined}
      onKeyDownCapture={delegate ? (event) => {
        if (event.target === delegated.current && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          event.stopPropagation()
          toggleOnClick()
        }
      } : undefined}
      onBlurCapture={(event) => { setFocused(false); setDismissed(false); if (delegate && !delegated.current?.contains(event.relatedTarget as Node | null)) hide() }}
      onPointerDownCapture={() => { pressed.current = true }}
      onClick={(event) => { if (selectTarget(event.target)) toggleOnClick() }}
    >{children}</span>
    {mounted && (describe || help || visible) && createPortal(
      <div
        ref={tooltip}
        id={id}
        role="tooltip"
        onPointerEnter={keepOpen}
        onMouseEnter={keepOpen}
        onPointerLeave={leave}
        onMouseLeave={leave}
        className={`fixed z-[100] ${text.length > 60 || text.includes("\n") ? "max-w-72 whitespace-pre-line" : "whitespace-nowrap"} rounded-md border border-[var(--ib-tip-line)] bg-[var(--ib-tip-bg)] px-2.5 py-1.5 text-[length:var(--ib-fs-13)] font-medium leading-snug text-[var(--ib-tip-fg)]`}
        style={{
          left: position?.left ?? 0, top: position?.top ?? 0,
          visibility: visible ? "visible" : "hidden", opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none",
          maxWidth: long ? "min(27.5rem, calc(100vw - 2rem))" : undefined,
          transform: side === "right" ? "translateY(-50%)" : `translate(-50%, ${position?.below ? "0" : "-100%"})`,
        }}
      >{content ?? text}</div>,
      document.body,
    )}
  </>
}
