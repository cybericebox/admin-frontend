"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { t } from "@/i18n/t"

/**
 * The selection bar (the idea of nexus SelectionBar.jsx): while rows are selected it takes the toolbar's place at the
 * same height (DS .ib-page-header__bulk), so nothing jumps: «N вибрано», «Вибрати всі M за фільтром», the page's bulk
 * actions, «Скасувати».
 */
export function SelectionBar({ count, onClear, selectAll, children }: {
  count: number
  onClear: () => void
  /** Offered while more rows match the filter than are selected; `busy` while the other pages are being read. */
  selectAll?: { total: number; busy: boolean; onSelect: () => void }
  children: ReactNode
}) {
  return <div role="region" aria-label={t("admin.table.selection.label")} className="ib-page-header__bulk w-full flex-wrap">
    <span><b>{t("admin.table.selection.count", { count })}</b></span>
    {selectAll && <Button type="button" variant="ghost" size="sm" busy={selectAll.busy} busyLabel={t("busy.loading")} onClick={selectAll.onSelect}>{t("admin.table.selection.all", { total: selectAll.total })}</Button>}
    <span className="flex flex-wrap items-center gap-2">{children}</span>
    <span className="ib-page-header__end"><Button type="button" variant="ghost" size="sm" onClick={onClear}>{t("admin.table.selection.clear")}</Button></span>
  </div>
}
