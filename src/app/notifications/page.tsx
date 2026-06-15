"use client"
import { t } from "@/i18n/t"
export default function Page() {
  return (
    <div className="frost-panel frost-in rounded-lg p-8">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">{t("admin.nav.notifications")}</p>
      <p className="mt-2 text-muted-foreground">{t("admin.comingSoon")}</p>
    </div>
  )
}
