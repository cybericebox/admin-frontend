"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { PageHeader } from "@/components/ui/page-header"
import { t } from "@/i18n/t"
import { GlobalSettingsTab } from "@/components/notifications/GlobalSettingsTab"

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.settings.read"
      fallback={<NoAccess />}
    >
      <div className="frost-in"><PageHeader title={t("admin.nav.notif.settings")} /><GlobalSettingsTab /></div>
    </RequirePermission>
  )
}
