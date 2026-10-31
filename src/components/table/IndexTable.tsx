"use client"

import type { ReactNode } from "react"
import { SortTh, TableState, TableWrap, Th, TimeText } from "@/components/common/DsTable"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { TablePagination } from "@/components/ui/table-pagination"
import { t } from "@/i18n/t"
import { ColumnsMenu } from "./ColumnsMenu"
import { FilterBar, type FacetSource } from "./FilterBar"
import { ResetFilters } from "./ResetFilters"
import { ResizeHandle } from "./ResizeHandle"
import { SelectionBar } from "./SelectionBar"
import type { FilterDef } from "./filters"
import type { ColumnDef, IndexList } from "./useIndexList"

export { TimeText }
const SELECT_W = 44

/**
 * The index table of docs/specs/UI-TABLES.md: header with the found count, toolbar (search, composable filters, columns
 * menu) that the selection bar replaces, one scroll container with pinned select and identity columns, sticky header,
 * resizable columns, pagination. The page gives the columns, the filter fields, the row actions and the bulk actions.
 */
export function IndexTable<Row>({ list, columns, identity, title, rowId, rowLabel, defs, facets, searchLabel, emptyLabel, emptyInitialLabel, errorLabel, actions, rowActions, actionsWidth = 120, actionsLabel, selectable, bulk, selectAllError, pinnedKey = "ib-table__pin" }: {
  list: IndexList<Row>
  columns: readonly ColumnDef<Row>[]
  identity: string
  title: string
  rowId: (row: Row) => string
  rowLabel: (row: Row) => string
  defs: readonly FilterDef[]
  facets?: FacetSource
  searchLabel: string
  emptyLabel: string
  emptyInitialLabel: string
  errorLabel: string
  /** Buttons at the right of the title (create, invite). */
  actions?: ReactNode
  rowActions?: (row: Row) => ReactNode
  actionsWidth?: number
  actionsLabel: string
  /** Whether a row can be selected (the viewer, rows the action must not touch). */
  selectable?: (row: Row) => boolean
  /** The page's bulk actions; no bulk actions = no select column. */
  bulk?: ReactNode
  selectAllError?: (cause: unknown) => void
  pinnedKey?: string
}) {
  const hasSelect = bulk !== undefined
  const byKey = new Map(columns.map((c) => [c.key, c]))
  const cols = list.cols
  const tableWidth = (hasSelect ? SELECT_W : 0) + cols.reduce((sum, key) => sum + list.widthOf(key), 0) + (rowActions ? actionsWidth : 0)
  const colCount = cols.length + (hasSelect ? 1 : 0) + (rowActions ? 1 : 0)
  const firstLoad = list.loading && list.rows.length === 0
  const stateKind = list.error ? "error" : firstLoad ? "loading" : list.rows.length === 0 ? "empty" : null
  const canSelect = selectable ?? (() => true)
  const count = list.selected.size

  const toolbar = hasSelect && count > 0
    ? <SelectionBar count={count} onClear={() => list.setSelected(new Set())} selectAll={list.canSelectAll ? { total: list.total, busy: list.gathering, onSelect: () => void list.selectAllMatching(selectAllError ?? (() => undefined)) } : undefined}>{bulk}</SelectionBar>
    : <>
      <Input type="search" value={list.search} onChange={(event) => list.setSearch(event.target.value)} placeholder={searchLabel} aria-label={searchLabel} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm" />
      <FilterBar defs={defs} bag={list.bag} onChange={list.setBag} pinned={list.view.pinned ?? []} onPinned={(pinned) => list.update({ pinned })} facets={facets} />
      <ResetFilters active={list.filtered} onReset={list.resetFilters} />
      <span className="ml-auto">
        <ColumnsMenu cols={cols} allKeys={list.allKeys} identity={identity} label={(key) => byKey.get(key)?.label ?? key} onChange={(next) => list.update({ cols: next })} onReset={list.resetView} resettable={list.viewChanged} />
      </span>
    </>

  return <>
    <PageHeader title={title} count={firstLoad ? undefined : list.total} actions={actions} filters={toolbar} />
    <TableWrap fill scrollRef={list.scrollRef} label={title} rows={8} className="min-h-0">
      <table aria-busy={list.loading} style={{ width: tableWidth, minWidth: "100%" }}
        className={`ib-table ib-table--cards ib-table--fixed${hasSelect ? " ib-table--selectable" : ""}${list.loading && !firstLoad ? " is-refreshing" : ""}`} aria-label={title}>
        <colgroup>
          {hasSelect && <col style={{ width: SELECT_W }} />}
          {cols.map((key) => <col key={key} style={{ width: list.widthOf(key) }} />)}
          {rowActions && <col style={{ width: actionsWidth }} />}
        </colgroup>
        <thead>
          <tr>
            {hasSelect && <th scope="col" className="ib-table__select">
              <Checkbox aria-label={t("admin.table.selectAll")} checked={list.allSelected} disabled={list.selectableIds.length === 0}
                ref={(node) => { if (node) node.indeterminate = count > 0 && !list.allSelected }} onChange={list.toggleAll} />
            </th>}
            {cols.map((key) => {
              const col = byKey.get(key)!
              const resize = <ResizeHandle width={list.widthOf(key)} label={col.label} onLive={(w) => list.setLive((current) => ({ ...current, [key]: w }))}
                onCommit={(w) => { list.setLive((current) => { const next = { ...current }; delete next[key]; return next }); list.update({ widths: { ...list.view.widths, [key]: w } }) }} />
              return col.sort
                ? <SortTh key={key} className={key === identity ? pinnedKey : undefined} label={col.label} field={col.sort} activeField={list.sortBy} direction={list.sortDir} onSort={(field) => list.sort(field, !!col.firstDesc)}>{resize}</SortTh>
                : <Th key={key} className={key === identity ? pinnedKey : undefined}>{col.label}{resize}</Th>
            })}
            {rowActions && <Th className="ib-table__actions"><span className="sr-only">{actionsLabel}</span></Th>}
          </tr>
        </thead>
        {stateKind ? (
          <TableState colSpan={colCount} kind={stateKind} message={list.error ? errorLabel : list.filtered ? emptyLabel : emptyInitialLabel} error={list.error?.cause} onRetry={list.retry} />
        ) : (
          <tbody className={list.loading ? "pointer-events-none" : undefined}>
            {list.rows.map((row) => {
              const id = rowId(row)
              return <tr key={id} aria-selected={list.selected.has(id) || undefined}>
                {hasSelect && <td className="ib-table__select">
                  <Checkbox aria-label={t("admin.table.selectRow", { name: rowLabel(row) })} checked={list.selected.has(id)} disabled={!canSelect(row)} onChange={() => list.toggle(id)} />
                </td>}
                {cols.map((key) => {
                  const col = byKey.get(key)!
                  return key === identity
                    ? <td key={key} className={`ib-table__primary ${pinnedKey}`}>{col.cell(row)}</td>
                    : <td key={key} className={col.dim ? "ib-table__dim" : undefined} data-label={col.label}>{col.cell(row)}</td>
                })}
                {rowActions && <td className="ib-table__actions">{rowActions(row)}</td>}
              </tr>
            })}
          </tbody>
        )}
      </table>
    </TableWrap>
    <TablePagination page={list.page} pageSize={list.pageSize} total={list.total} busy={list.loading} onPage={list.goToPage} onPageSize={list.setPageSize} />
  </>
}
