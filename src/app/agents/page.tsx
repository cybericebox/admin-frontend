"use client"

import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/common/NoAccess"
import { AgentsPage } from "@/components/agents/AgentsPage"
import { t } from "@/i18n/t"

export default function Page() {
  return <RequirePermission perm="infrastructure.read" fallback={<NoAccess message={t("admin.labs.noAccess")} />}><AgentsPage /></RequirePermission>
}
