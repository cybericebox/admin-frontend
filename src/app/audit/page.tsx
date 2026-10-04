"use client"

import { RequirePermission } from "@/components/rbac/RequirePermission"
import { AuditLogPage } from "@/components/audit/AuditLogPage"
import { t } from "@/i18n/t"

export default function Page() {
  return <RequirePermission perm="platform.audit.read" fallback={<p className="text-sm text-muted-foreground">{t("admin.audit.noAccess")}</p>}><AuditLogPage /></RequirePermission>
}
