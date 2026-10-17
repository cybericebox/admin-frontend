"use client"
import { useCallback, useEffect, useState } from "react"
import { getImageRegistrySettings, type ImageRegistrySettings } from "@/api/imageRegistry/settings"
import { t } from "@/i18n/t"
import { NoAccess } from "@/components/rbac/NoAccess"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { ImageRegistryCard } from "@/components/settings/ImageRegistryCard"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import { LoadError } from "@/components/ui/load-error"
import { PageHeader } from "@/components/ui/page-header"
import { LoadingArea } from "@/components/ui/spinner"
import { useRole } from "@/lib/useRole"

export default function Page() {
  const { can } = useRole()
  const allowed = can("platform.settings.read")
  const canWrite = can("platform.settings.write")
  const [settings, setSettings] = useState<ImageRegistrySettings | null>(null)
  const [loadError, setLoadError] = useState<{ cause: unknown } | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setSettings(await getImageRegistrySettings())
    } catch (cause) {
      setLoadError({ cause })
    }
  }, [])

  useEffect(() => { if (allowed) queueMicrotask(() => void load()) }, [allowed, load])

  return (
    <RequirePermission perm="platform.settings.read" fallback={<NoAccess message={t("admin.settings.noAccess")} />}>
      <div className="flex min-h-full flex-col gap-5">
        <PageHeader title={t("admin.imageRegistry.title")} sub={t("admin.imageRegistry.description")} />
        <SettingsTabs />
        {loadError ? (
          <LoadError message={t("admin.imageRegistry.loadError")} error={loadError.cause} onRetry={() => void load()} className="flex-1" />
        ) : !settings ? (
          <LoadingArea className="flex-1" label={t("admin.loading")} />
        ) : (
          <ImageRegistryCard settings={settings} canWrite={canWrite} onChange={setSettings} />
        )}
      </div>
    </RequirePermission>
  )
}
