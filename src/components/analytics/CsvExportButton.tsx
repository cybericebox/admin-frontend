"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { apiGetBlob } from "@/api/client"
import { exportUrl, type AnalyticsParams } from "@/api/platformAnalytics"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { t } from "@/i18n/t"
import { useOptionalPeriodQuery } from "./useOptionalPeriodQuery"

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Downloads /api/analytics/<section>/export.csv?table=... through the authenticated
 * client (blob) and saves it. Inside SectionPage the chosen period is added to the
 * export. The crest shows in the button while it runs.
 */
export function CsvExportButton({ section, table, params, disabled = false, label, size = "sm" }: {
  section: string
  table: string
  params?: AnalyticsParams
  disabled?: boolean
  label?: string
  size?: "sm" | "default"
}) {
  const [busy, setBusy] = useState(false)
  const period = useOptionalPeriodQuery()
  async function download() {
    setBusy(true)
    try {
      const { blob, filename } = await apiGetBlob(exportUrl(section, { ...period(), ...params, table }))
      save(blob, filename ?? `${section.replace(/\//g, "-")}-${table}.csv`)
    } catch {
      toast.error(t("admin.platformAnalytics.csv.failed"))
    } finally {
      setBusy(false)
    }
  }
  return <Button type="button" variant="outline" size={size} disabled={disabled} busy={busy} onClick={() => void download()}>
    {!busy && <Download aria-hidden="true" className="mr-2 h-4 w-4" />}{label ?? t("admin.platformAnalytics.csv.export")}
  </Button>
}
