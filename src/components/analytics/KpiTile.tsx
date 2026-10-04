"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { FieldHelp } from "@/components/ui/field-help"
import { Spinner } from "@/components/ui/spinner"
import { t } from "@/i18n/t"

/**
 * One headline number: label, tabular value, optional delta / sub-line and (?) hint.
 * With `href` the whole tile links to its section. `loading` shows the crest inside
 * the tile and `empty` shows a dash; the tile keeps its size either way.
 */
export function KpiTile({ label, value, sub, delta, hint, href, loading = false, empty = false }: {
  label: string
  value?: ReactNode
  /** Line under the value. */
  sub?: string
  /** Change against the previous period, e.g. "+12%"; tone sets the colour. */
  delta?: { text: string; tone?: "up" | "down" | "flat" }
  hint?: string
  href?: string
  loading?: boolean
  empty?: boolean
}) {
  const tone = delta?.tone === "up" ? "text-[var(--ib-ok)]" : delta?.tone === "down" ? "text-destructive" : "text-muted-foreground"
  const body = loading
    ? <div className="flex h-8 items-center"><Spinner size="md" label={t("admin.loading")} /></div>
    : <p className="flex h-8 items-center text-2xl font-semibold tabular-nums text-foreground">{empty || value === undefined || value === null ? "–" : value}</p>
  const tile = <div className="flex min-h-[7rem] flex-col gap-2 p-4">
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><span>{label}</span>{hint && <FieldHelp text={hint} />}</div>
    {body}
    <div className="mt-auto flex min-h-5 items-center gap-2 text-xs">
      {!loading && delta && <span className={`font-medium tabular-nums ${tone}`}>{delta.text}</span>}
      {!loading && sub && <span className="text-muted-foreground">{sub}</span>}
    </div>
  </div>
  if (!href) return <div className="min-w-0 rounded-lg border border-border bg-card">{tile}</div>
  // The (?) hint is a button, so it cannot sit inside the link: the link covers the tile behind it.
  return <div className="relative min-w-0 rounded-lg border border-border bg-card transition-colors hover:bg-accent">
    <Link href={href} aria-label={label} className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
    <div className="pointer-events-none [&_button]:pointer-events-auto">{tile}</div>
  </div>
}
