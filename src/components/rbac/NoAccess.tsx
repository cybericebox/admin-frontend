import { Lock } from "lucide-react"
import { t } from "@/i18n/t"
import { cn } from "@/utils/cn"

// The one "no rights" block for a page or a section: lock icon, title, one line, centred in its block.
export function NoAccess({ message, className }: { message?: string; className?: string }) {
  return (
    <div data-no-access role="status" className={cn("flex min-h-64 flex-col items-center justify-center gap-3 px-4 py-8 text-center", className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/30">
        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <h2 className="text-base font-semibold text-foreground">{t("admin.noAccess.title")}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{message ?? t("admin.noAccess.body")}</p>
    </div>
  )
}
