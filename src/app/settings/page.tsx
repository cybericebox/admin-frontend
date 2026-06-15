"use client"
import { RequireSuperAdmin } from "@/components/rbac/RequireSuperAdmin"
import { t } from "@/i18n/t"

export default function Page() {
  return (
    <RequireSuperAdmin
      fallback={
        <div className="frost-panel rounded-lg p-8 text-center text-muted-foreground">{t("admin.noAccess.title")}</div>
      }
    >
      <div className="frost-panel frost-in rounded-lg p-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">{t("admin.nav.settings")}</p>
        <p className="mt-2 text-muted-foreground">{t("admin.comingSoon")}</p>
      </div>
    </RequireSuperAdmin>
  )
}
