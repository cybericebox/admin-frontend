"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { t } from "@/i18n/t"
import { GlobalSettingsTab } from "@/components/notifications/GlobalSettingsTab"

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.settings.read"
      fallback={<div className="frost-panel frost-in rounded-lg p-8 text-center text-sm text-muted-foreground">{t("admin.notif.noAccess")}</div>}
    >
      <div className="frost-in"><GlobalSettingsTab /></div>
    </RequirePermission>
  )
}
