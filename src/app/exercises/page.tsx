"use client"
import { t } from "@/i18n/t"
export default function Page() {
  return (
    <div className="frost-panel frost-in rounded-lg p-8">
      <p className="text-muted-foreground">{t("admin.comingSoon")}</p>
    </div>
  )
}
