"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { t } from "@/i18n/t"
import { BroadcastsList } from "@/components/notifications/broadcast/BroadcastsList"

export default function Page() {
  return (
    <RequirePermission perm="notifications.broadcast" fallback={<div className="frost-panel frost-in rounded-lg p-8 text-center text-sm text-muted-foreground">{t("admin.notif.noAccess")}</div>}>
      <BroadcastsList />
    </RequirePermission>
  )
}
