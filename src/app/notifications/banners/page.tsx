"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { BannersAdmin } from "@/components/notifications/banners/BannersAdmin"

export default function Page() {
  return (
    <RequirePermission perm="notifications.banners.read" fallback={<NoAccess />}>
      <BannersAdmin />
    </RequirePermission>
  )
}
