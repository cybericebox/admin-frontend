"use client"

import { Suspense } from "react"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { ResourcesPage } from "@/components/resources/ResourcesPage"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"

export default function Page() {
  return <RequirePermission perm="infrastructure.read" fallback={<NoAccess message={t("admin.labs.noAccess")} />}>
    <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><ResourcesPage /></Suspense>
  </RequirePermission>
}
