"use client"

import type { ReactNode } from "react"
import { FieldHelp } from "@/components/ui/field-help"

/** A titled card of a section page: heading, optional (?) hint and actions, then content that keeps its own size. */
export function AnalyticsBlock({ title, subtitle, hint, actions, className, children }: {
  title: string
  subtitle?: string
  hint?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}) {
  return <section aria-label={title} className={`min-w-0 rounded-lg border border-border bg-card p-4 ${className ?? ""}`}>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5"><h2 className="text-base font-semibold text-foreground">{title}</h2>{hint && <FieldHelp text={hint} />}</div>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
    {children}
  </section>
}
