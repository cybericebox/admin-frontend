import { Loader2 } from "lucide-react"
import { cn } from "@/utils/cn"

// Animated loading spinner. `label` is announced to screen readers (use the
// existing admin.loading i18n text so the loading state stays accessible).
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center justify-center", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
