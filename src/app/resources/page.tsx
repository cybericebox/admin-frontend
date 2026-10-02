"use client"

import { RequirePermission } from "@/components/rbac/RequirePermission"
import { ResourcesPage } from "@/components/resources/ResourcesPage"
import { t } from "@/i18n/t"

export default function Page() {
  return <RequirePermission perm="infrastructure.read" fallback={<p className="text-sm text-muted-foreground">{t("admin.labs.noAccess")}</p>}><ResourcesPage /></RequirePermission>
}
