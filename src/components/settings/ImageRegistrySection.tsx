"use client"
import { useCallback, useEffect, useState } from "react"
import { getImageRegistrySettings, type ImageRegistrySettings } from "@/api/imageRegistry/settings"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { ImageRegistryCard } from "@/components/settings/ImageRegistryCard"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"

/** Loads the image registry settings and shows their card; loading and load errors fill the block. */
export function ImageRegistrySection() {
  const canWrite = useRole().can("platform.settings.write")
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

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  if (loadError) return <LoadError message={t("admin.imageRegistry.loadError")} error={loadError.cause} onRetry={() => void load()} className="min-h-48" />
  if (!settings) return <LoadingArea className="min-h-48" label={t("admin.loading")} />
  return <ImageRegistryCard settings={settings} canWrite={canWrite} onChange={setSettings} />
}
