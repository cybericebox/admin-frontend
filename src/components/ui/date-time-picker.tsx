"use client"

import * as React from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange"> & {
  value: string
  onChange: (value: string) => void
  allowClear?: boolean
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]
const pad = (value: number) => String(value).padStart(2, "0")
const datePart = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

function selectedDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" }).format(date).replace(/\s*р\.$/, "")
}

export const DateTimePicker = React.forwardRef<HTMLButtonElement, Props>(function DateTimePicker({ value, onChange, allowClear, onBlur, disabled, id, name, "aria-label": ariaLabel, "aria-describedby": describedBy, "aria-invalid": invalid, ...rest }, ref) {
  const chosen = selectedDate(value)
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const [month, setMonth] = React.useState(() => chosen ? new Date(chosen.getFullYear(), chosen.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const calendarId = React.useId()
  const time = chosen ? `${pad(chosen.getHours())}:${pad(chosen.getMinutes())}` : "09:00"
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (firstDay.getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1))

  function changeMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  function changeTime(part: "hour" | "minute", raw: string) {
    if (!chosen || !/^\d{1,2}$/.test(raw)) return
    const next = Number(raw)
    if (next < 0 || next > (part === "hour" ? 23 : 59)) return
    const [hour, minute] = time.split(":").map(Number)
    onChange(`${datePart(chosen)}T${pad(part === "hour" ? next : hour)}:${pad(part === "minute" ? next : minute)}`)
  }

  return <div className="relative w-full">
    <button {...rest} ref={(node) => { triggerRef.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node }} id={id} name={name} type="button" aria-label={ariaLabel} aria-describedby={describedBy} data-invalid={invalid} aria-expanded={open} aria-controls={calendarId} disabled={disabled} onBlur={onBlur} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); rest.onKeyDown?.(event) }} onClick={() => { if (!open) setMonth(chosen ? new Date(chosen.getFullYear(), chosen.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setOpen(!open) }} className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50">
      <span className={chosen ? "" : "text-placeholder"}>{chosen ? `${dateLabel(chosen)}, ${time}` : "Оберіть дату й час"}</span><CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent id={calendarId} className="z-[60] w-[min(24rem,calc(100vw-2rem))] gap-0 p-4" onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus() }}>
      <DialogTitle className="mb-1">Оберіть дату й час</DialogTitle>
      <DialogDescription className="sr-only">Виберіть день у календарі та задайте час.</DialogDescription>
      <div className="flex items-center justify-between gap-2"><button type="button" aria-label="Попередній місяць" onClick={() => changeMonth(-1)} className="rounded-md p-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft className="h-4 w-4" /></button><strong className="text-sm font-semibold capitalize">{new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(month)}</strong><button type="button" aria-label="Наступний місяць" onClick={() => changeMonth(1)} className="rounded-md p-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"><ChevronRight className="h-4 w-4" /></button></div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">{WEEKDAYS.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
      <div role="grid" aria-label="Календар" className="grid grid-cols-7 gap-1">{days.map((day) => {
        const isSelected = chosen && datePart(day) === datePart(chosen)
        return <button key={datePart(day)} type="button" aria-label={dateLabel(day)} aria-current={isSelected ? "date" : undefined} onClick={() => { onChange(`${datePart(day)}T${time}`); if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1)) }} className={`h-8 rounded-md text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-primary ${isSelected ? "bg-primary text-primary-foreground" : day.getMonth() === month.getMonth() ? "text-foreground hover:bg-accent" : "text-muted-foreground hover:bg-accent"}`}>{day.getDate()}</button>
      })}</div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3"><div className="flex items-center gap-1 text-sm"><label htmlFor={`${calendarId}-hour`} className="sr-only">Година</label><input id={`${calendarId}-hour`} aria-label="Година" type="number" min="0" max="23" value={time.slice(0, 2)} onChange={(event) => changeTime("hour", event.target.value)} className="h-8 w-12 rounded-md border border-border bg-card text-center tabular-nums" /><span>:</span><label htmlFor={`${calendarId}-minute`} className="sr-only">Хвилина</label><input id={`${calendarId}-minute`} aria-label="Хвилина" type="number" min="0" max="59" value={time.slice(3)} onChange={(event) => changeTime("minute", event.target.value)} className="h-8 w-12 rounded-md border border-border bg-card text-center tabular-nums" /></div><div className="flex items-center gap-2">{allowClear && chosen && <button type="button" onClick={() => { onChange(""); setOpen(false) }} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">Без дати</button>}<button type="button" onClick={() => setOpen(false)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-[var(--ib-action-hover)]">Готово</button></div></div>
      </DialogContent>
    </Dialog>
  </div>
})
