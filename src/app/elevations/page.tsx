"use client"

import { Suspense } from "react"
import { ELEVATION_READ_PERM } from "@/api/elevations"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/common/NoAccess"
import { ElevationsPage } from "@/components/elevations/ElevationsPage"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"

export default function Page() {
  return <RequirePermission perm={ELEVATION_READ_PERM} fallback={<NoAccess message={t("admin.elevations.noAccess")} />}>
    <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><ElevationsPage /></Suspense>
  </RequirePermission>
}
