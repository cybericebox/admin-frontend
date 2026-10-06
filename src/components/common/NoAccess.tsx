import { Lock } from "lucide-react"
import { t } from "@/i18n/t"
import { cn } from "@/utils/cn"

// The one permission fallback inside a page or block (DS .ib-empty--lock): lock icon, «Немає доступу», one line.
// Centred in its block like EmptyState / LoadError. `message` replaces the default help line.
export function NoAccess({ message, className }: { message?: string; className?: string }) {
  return (
    <div data-no-access role="status" className={cn("flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-4 text-center", className)}>
      <Lock size={24} className="text-[var(--ib-faint)]" aria-hidden />
      <p className="text-[length:var(--ib-fs-15)] font-medium text-foreground">{t("admin.noAccess.title")}</p>
      <p className="max-w-[44ch] text-[length:var(--ib-fs-13)] text-muted-foreground">{message ?? t("admin.noAccess.body")}</p>
    </div>
  )
}
