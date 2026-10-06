"use client"

import { useRef, type KeyboardEvent, type ReactNode } from "react"
import { cn } from "@/utils/cn"

export type SegmentedOption<V extends string> = { value: V; label: ReactNode; ariaLabel?: string; disabled?: boolean }

// DS segmented control (components/segmented/segmented.css) as a radiogroup: a choice that must stay selected
// (theme, scope, status). Roving tabindex (only the checked radio is in the Tab order); arrows move and select, Home/End jump.
// For a filter or view switch where nothing has to be selected use buttons with aria-pressed instead.
export function Segmented<V extends string>({ value, onChange, options, label, small, block, className }: {
  value: V
  onChange: (value: V) => void
  options: readonly SegmentedOption<V>[]
  label: string
  small?: boolean
  block?: boolean
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const enabled = options.map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled)

  function move(from: number, step: 1 | -1 | "first" | "last") {
    const position = enabled.findIndex(({ index }) => index === from)
    const target = step === "first" ? enabled[0] : step === "last" ? enabled[enabled.length - 1] : enabled[(position + step + enabled.length) % enabled.length]
    if (!target) return
    onChange(target.option.value)
    refs.current[target.index]?.focus()
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1
        : event.key === "Home" ? "first" : event.key === "End" ? "last" : null
    if (step === null) return
    event.preventDefault()
    move(index, step)
  }

  // With no checked option (a value outside the list) the first enabled radio stays reachable.
  const tabStop = options.findIndex((option) => option.value === value && !option.disabled)
  const fallback = tabStop === -1 ? enabled[0]?.index : tabStop
  return (
    <div role="radiogroup" aria-label={label} className={cn("ib-seg", small && "ib-seg--sm", block && "ib-seg--block", className)}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => { refs.current[index] = node }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.ariaLabel}
          disabled={option.disabled}
          tabIndex={index === fallback ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >{option.label}</button>
      ))}
    </div>
  )
}
