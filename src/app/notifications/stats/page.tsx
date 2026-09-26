"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { t } from "@/i18n/t"
import { StatisticsTab } from "@/components/notifications/StatisticsTab"

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.templates.read"
      fallback={<div className="frost-panel frost-in rounded-lg p-8 text-center text-sm text-muted-foreground">{t("admin.notif.noAccess")}</div>}
    >
      <div className="frost-in h-full"><StatisticsTab /></div>
    </RequirePermission>
  )
}
