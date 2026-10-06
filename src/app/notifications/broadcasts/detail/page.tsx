"use client"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"
import { BroadcastDetail } from "@/components/notifications/broadcast/BroadcastDetail"

// No dynamic [id] segment: the admin portal is a static export, so the id is a query parameter.
function RouteDetail() {
  const id = useSearchParams().get("id") ?? ""
  return <BroadcastDetail key={id} id={id} />
}

export default function Page() {
  return (
    <RequirePermission perm="notifications.broadcast" fallback={<NoAccess />}>
      <Suspense fallback={<LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />}>
        <RouteDetail />
      </Suspense>
    </RequirePermission>
  )
}
