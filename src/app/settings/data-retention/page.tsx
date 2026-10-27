"use client"
import { t } from "@/i18n/t"
import { NoAccess } from "@/components/rbac/NoAccess"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { LimitSettingsCard } from "@/components/settings/LimitSettingsCard"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import { PageHeader } from "@/components/ui/page-header"
import type { Unit } from "@/lib/limitUnits"

const LONG: Unit[] = ["days", "years"]
const SHORT: Unit[] = ["hours", "days"]

const GROUPS = [
  { titleKey: "admin.limits.group.accounts", keys: ["PendingAccount", "InactiveAccount", "InactivityGrace", "ExpiredInvitation"] },
  { titleKey: "admin.limits.group.sessions", keys: ["SessionAfterExpiry"] },
  { titleKey: "admin.limits.group.mail", keys: ["DeliveryLog", "SignalHistory"] },
  { titleKey: "admin.limits.group.events", keys: ["FormAnswersAfterEventEnd", "EventAnalyticsAfterEnd", "LabTelemetry", "LabTelemetryParticipants"] },
  { titleKey: "admin.limits.group.files", keys: ["UnusedAnswerFile"] },
]
const UNITS: Record<string, Unit[]> = Object.fromEntries(GROUPS.flatMap((group) => group.keys).map((key) => [key, key === "UnusedAnswerFile" ? SHORT : LONG]))
const labelKey = (key: string) => `admin.limits.field.${key}`

export default function Page() {
  return (
    <RequirePermission perm="platform.settings.read" fallback={<NoAccess message={t("admin.settings.noAccess")} />}>
      <div className="flex min-h-full flex-col gap-5">
        <PageHeader title={t("admin.settings.dataRetention.title")} sub={t("admin.settings.dataRetention.description")} />
        <SettingsTabs />
        <LimitSettingsCard card="retention" title={t("admin.limits.card.retention.title")} description={t("admin.limits.card.retention.description")}
          groups={GROUPS} units={UNITS} labelKey={labelKey} />
      </div>
    </RequirePermission>
  )
}
