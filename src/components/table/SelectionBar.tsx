"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { t } from "@/i18n/t"

/** The bar above a table while rows are selected (DS .ib-page-header__bulk): the count, the page's bulk actions, «Зняти вибір». */
export function SelectionBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  return <div role="region" aria-label={t("admin.table.selection.label")} className="ib-page-header__bulk mb-3 flex-wrap">
    <span><b>{t("admin.table.selection.count", { count })}</b></span>
    <span className="flex flex-wrap items-center gap-2">{children}</span>
    <span className="ib-page-header__end"><Button type="button" variant="ghost" size="sm" onClick={onClear}>{t("admin.table.selection.clear")}</Button></span>
  </div>
}
