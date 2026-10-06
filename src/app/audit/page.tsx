"use client"

import { Suspense } from "react"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { AuditLogPage } from "@/components/audit/AuditLogPage"
import { NoAccess } from "@/components/rbac/NoAccess"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"

export default function Page() {
  return <RequirePermission perm="platform.audit.read" fallback={<NoAccess message={t("admin.audit.noAccess")} />}>
    <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><AuditLogPage /></Suspense>
  </RequirePermission>
}
