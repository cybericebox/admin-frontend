"use client"

import { RequirePermission } from "@/components/rbac/RequirePermission"
import { MailAnalytics } from "@/components/analytics/mail/MailAnalytics"

export default function Page() {
  return <RequirePermission perm="analytics.read"><MailAnalytics /></RequirePermission>
}
