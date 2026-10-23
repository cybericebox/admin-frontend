"use client"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"
import { CustomTemplateEditor } from "@/components/notifications/templates/CustomTemplateEditor"

// No dynamic [id] segment: the admin portal is a static export, so the id (none = a new template) and the templates
// page it was opened from (channel) are query parameters.
function RouteEditor() {
  const params = useSearchParams()
  const id = params.get("id") ?? ""
  const channel = params.get("channel") === "in_app" ? "in_app" : "email"
  return <CustomTemplateEditor key={`${channel}:${id}`} id={id} channel={channel} />
}

export default function Page() {
  return (
    <RequirePermission perm="notifications.broadcast" fallback={<NoAccess />}>
      <Suspense fallback={<LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />}>
        <RouteEditor />
      </Suspense>
    </RequirePermission>
  )
}
