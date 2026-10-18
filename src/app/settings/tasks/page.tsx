"use client"
import { t } from "@/i18n/t"
import { NoAccess } from "@/components/rbac/NoAccess"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { ImageRegistrySection } from "@/components/settings/ImageRegistrySection"
import { LimitSettingsCard } from "@/components/settings/LimitSettingsCard"
import { PreviewDefaultsEditor } from "@/components/settings/PreviewDefaultsEditor"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import { PageHeader } from "@/components/ui/page-header"
import type { Unit } from "@/lib/limitUnits"

const SIZE: Unit[] = ["MiB", "GiB"]
const TIME: Unit[] = ["hours", "days"]
const ARCHIVE_UNITS = { ArchiveBytes: SIZE, EntryBytes: SIZE, UnpackedBytes: SIZE, Entries: [] }
const TEST_RUN_UNITS = { Lease: TIME, LeaseMax: TIME }
const ARCHIVE_GROUPS = [{ keys: ["ArchiveBytes", "EntryBytes", "UnpackedBytes", "Entries"] }]
const TEST_RUN_GROUPS = [{ keys: ["Lease", "LeaseMax"] }]
const labelKey = (key: string) => `admin.limits.field.${key}`

export default function Page() {
  return (
    <RequirePermission perm="platform.settings.read" fallback={<NoAccess message={t("admin.settings.noAccess")} />}>
      <div className="flex min-h-full flex-col gap-5">
        <PageHeader title={t("admin.settings.tasks.title")} sub={t("admin.settings.tasks.description")} />
        <SettingsTabs />
        <ImageRegistrySection />
        <LimitSettingsCard card="archive-limits" title={t("admin.limits.card.archive.title")} description={t("admin.limits.card.archive.description")}
          groups={ARCHIVE_GROUPS} units={ARCHIVE_UNITS} labelKey={labelKey} />
        <LimitSettingsCard card="test-runs" title={t("admin.limits.card.testRuns.title")} description={t("admin.limits.card.testRuns.description")}
          groups={TEST_RUN_GROUPS} units={TEST_RUN_UNITS} labelKey={labelKey} />
        <PreviewDefaultsEditor />
      </div>
    </RequirePermission>
  )
}
