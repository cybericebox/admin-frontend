import { cn } from "@/utils/cn"

/** A small trend line (inline SVG, no library): the values left to right, scaled to their own range. `label` says what it shows. */
export function Sparkline({ values, label, className }: { values: readonly number[]; label: string; className?: string }) {
  const width = 120
  const height = 32
  if (values.length < 2) return <span role="img" aria-label={label} className={cn("inline-block", className)} style={{ width, height }} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(height - 3 - ((value - min) / span) * (height - 6)).toFixed(1)}`).join(" ")
  return <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn("text-[var(--ib-action)]", className)}>
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
}
