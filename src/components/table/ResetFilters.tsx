"use client"

import { Button } from "@/components/ui/button"
import { t } from "@/i18n/t"

/** «Скинути фільтри»: shown beside the filters only while some filter is set. */
export function ResetFilters({ active, onReset }: { active: boolean; onReset: () => void }) {
  if (!active) return null
  return <Button type="button" variant="outline" className="shrink-0 text-sm" onClick={onReset}>{t("admin.table.resetFilters")}</Button>
}
