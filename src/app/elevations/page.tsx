"use client"

import { ELEVATION_PERM } from "@/api/elevations"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { ElevationsPage } from "@/components/elevations/ElevationsPage"
import { t } from "@/i18n/t"

export default function Page() {
  return <RequirePermission perm={ELEVATION_PERM} fallback={<p className="text-sm text-muted-foreground">{t("admin.elevations.noAccess")}</p>}><ElevationsPage /></RequirePermission>
}
