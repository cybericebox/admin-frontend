"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { t } from "@/i18n/t"
import { BannersAdmin } from "@/components/notifications/banners/BannersAdmin"

export default function Page() {
  return (
    <RequirePermission perm="notifications.banners.read" fallback={<div className="frost-panel frost-in rounded-lg p-8 text-center text-sm text-muted-foreground">{t("admin.notif.noAccess")}</div>}>
      <BannersAdmin />
    </RequirePermission>
  )
}
