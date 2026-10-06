import type { ReactNode } from "react"
import { cn } from "@/utils/cn"

// A filter control with a visible label above it (DS field label: 13px, dim). The control keeps its own accessible name.
export function FilterField({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={cn("flex min-w-0 flex-col gap-1", className)}>
    <span className="text-[length:var(--ib-fs-13)] font-medium text-muted-foreground">{label}</span>
    {children}
  </div>
}
