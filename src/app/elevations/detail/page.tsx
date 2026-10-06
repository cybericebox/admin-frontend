"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ELEVATION_READ_PERM } from "@/api/elevations"
import { NoAccess } from "@/components/common/NoAccess"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { ElevationDetail } from "@/components/elevations/ElevationDetail"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"

function Detail() {
  const id = useSearchParams().get("id") ?? ""
  return <ElevationDetail key={id} id={id} />
}

export default function Page() {
  return <RequirePermission perm={ELEVATION_READ_PERM} fallback={<NoAccess message={t("admin.elevations.noAccess")} />}>
    <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><Detail /></Suspense>
  </RequirePermission>
}
