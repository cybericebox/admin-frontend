"use client"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Send } from "lucide-react"
import { ApiError } from "@/api/client"
import { bulkUsers, getUserFacets, listUsers, resendInvitation, type BulkAction, type UserQuery, type UserRow } from "@/api/users"
import { t } from "@/i18n/t"
import { tPlural } from "@/i18n/plural"
import { overloadOr } from "@/i18n/apiError"
import { RoleBadge, StatusBadge } from "@/components/users/RoleStatusBadge"
import { Avatar } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { SortTh, TableState, TableWrap, Th, TimeText } from "@/components/common/DsTable"
import { ColumnsMenu } from "@/components/table/ColumnsMenu"
import { FilterBar, type FacetSource } from "@/components/table/FilterBar"
import { ResetFilters } from "@/components/table/ResetFilters"
import { ResizeHandle } from "@/components/table/ResizeHandle"
import { SelectionBar } from "@/components/table/SelectionBar"
import { columnWidth } from "@/components/table/columns"
import { activeCount, bagFromUrl, serializeCond, urlKey, type FilterBag, type FilterDef } from "@/components/table/filters"
import { useTableView } from "@/components/table/view"
import { useUrlState } from "@/lib/useUrlState"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useRole } from "@/lib/useRole"
import { PLATFORM_ROLES, roleLabel } from "@/lib/roles"
import { canManageAccount } from "@/lib/assignableRoles"
import InviteUsersDialog from "@/components/users/InviteUsersDialog"
import { LoadingArea } from "@/components/ui/spinner"
import { TablePagination } from "@/components/ui/table-pagination"
import { toast } from "@/components/ui/toast"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { formatListDateTime } from "@/lib/locale"
import { relativeTime } from "@/utils/relativeTime"
import { isUnsetDate } from "@/lib/dates"

export type { UserRow }

const STATUSES = ["active", "blocked", "incomplete"]
const SIGN_IN = ["password", "google", "passkey"]
const BULK_LIMIT = 200
const SELECT_W = 44
const ACTIONS_W = 190

function fullName(u: UserRow): string {
  const n = `${u.FirstName ?? ""} ${u.LastName ?? ""}`.trim()
  return n || u.Email
}

// The columns: key, header text, sort field (the API's sortBy), configured width. «user» is the pinned identity.
const COLUMNS = [
  { key: "user", label: "admin.users.col.user", sort: "name", width: 260 },
  { key: "email", label: "admin.users.col.email", sort: "email", width: 240 },
  { key: "role", label: "admin.users.col.role", sort: "role", width: 200 },
  { key: "status", label: "admin.users.col.status", sort: "status", width: 150 },
  { key: "signIn", label: "admin.users.col.signIn", sort: "signIn", width: 220 },
  { key: "lastSeen", label: "admin.users.col.lastSeen", sort: "lastSeen", width: 170 },
  { key: "created", label: "admin.users.col.created", sort: "created", width: 180 },
] as const
const ALL_KEYS = COLUMNS.map((c) => c.key)
const IDENTITY = "user"
const colOf = (key: string) => COLUMNS.find((c) => c.key === key)!
const FILTER_KEYS = ["role", "status", "confirmed", "signIn", "inactive"]

// What a bulk action does: the permission it needs, the confirmation texts and the busy label (AGENTS.md: ConfirmDialog, busy buttons).
const BULK: Record<BulkAction, { permission: string; danger: boolean; busy: string }> = {
  "resend-invitation": { permission: "users.invite", danger: false, busy: "busy.sending" },
  block: { permission: "users.status.write", danger: true, busy: "busy.blocking" },
  unblock: { permission: "users.status.write", danger: false, busy: "busy.unblocking" },
  "end-sessions": { permission: "users.status.write", danger: true, busy: "busy.endingSessions" },
}
const BULK_ORDER: BulkAction[] = ["resend-invitation", "block", "unblock", "end-sessions"]

function UsersList() {
  const { view, cols, update, reset, changed } = useTableView({ table: "admin.users", allKeys: ALL_KEYS, identity: IDENTITY, defaultCols: ALL_KEYS })
  const filterDefaults = Object.fromEntries(FILTER_KEYS.map((key) => [urlKey(key), ""]))
  const [query, setQuery] = useUrlState({ q: "", page: "1", size: view.size ?? "50", sort: view.sort ?? "created", dir: view.dir ?? "desc", ...filterDefaults })
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Number(query.size) || 50
  const sortBy = query.sort
  const sortDir: "asc" | "desc" = query.dir === "asc" ? "asc" : "desc"
  const debounced = query.q

  // The page declares its fields once; the operators are the ones the API understands.
  const defs = useMemo<FilterDef[]>(() => [
    { key: "role", label: t("admin.users.col.role"), type: "choice", ops: ["in"], options: PLATFORM_ROLES.map((value) => ({ value, label: roleLabel(value) })) },
    { key: "status", label: t("admin.users.col.status"), type: "choice", single: true, ops: ["in"], options: STATUSES.map((value) => ({ value, label: t(`admin.status.${value}`) })) },
    { key: "confirmed", label: t("admin.users.filterConfirmed"), type: "boolean", ops: ["is"] },
    { key: "signIn", label: t("admin.users.col.signIn"), type: "choice", single: true, ops: ["in"], options: SIGN_IN.map((value) => ({ value, label: t(`admin.method.${value === "password" ? "email" : value}`) })) },
    { key: "inactive", label: t("admin.users.filterInactive"), type: "number", ops: ["gte"] },
  ], [])
  const bag = bagFromUrl(query, defs)

  const [search, setSearch] = useState(query.q)
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ cause: unknown } | null>(null)

  const { can, me, role: callerRole } = useRole()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState<BulkAction | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [resending, setResending] = useState<string | null>(null)
  const [gathering, setGathering] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const [live, setLive] = useState<Record<string, number>>({})

  // Any change of the view starts a new selection: the chosen rows would no longer be the rows on screen.
  function change(patch: Record<string, string>) {
    setSelected(new Set())
    setQuery(patch)
    if ("size" in patch) update({ size: patch.size })
  }
  function setBag(next: FilterBag) {
    change({ page: "1", ...Object.fromEntries(defs.map((def) => [urlKey(def.key), serializeCond(next[def.key])])) })
  }

  // Debounce the search box into the URL; an unchanged query must not reset the page the user moved to.
  useEffect(() => {
    const next = search.trim()
    if (next === debounced) return
    const id = setTimeout(() => { setSelected(new Set()); setQuery({ q: next, page: "1" }) }, 300)
    return () => clearTimeout(id)
  }, [search, debounced, setQuery])

  const request: UserQuery = { search: debounced, bag, page, pageSize, sortBy, sortDir }
  const requestKey = JSON.stringify(request)

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setLoading(true); setError(null) } })
    listUsers(JSON.parse(requestKey) as UserQuery)
      .then((d) => { if (active) { setUsers(d.Items ?? []); setTotal(d.Total ?? 0) } })
      .catch((cause) => { if (active) setError({ cause }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [requestKey, reloadKey])

  function goToPage(next: number) {
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0
    change({ page: String(next) })
  }

  function sort(field: string) {
    const nextDir = field === sortBy ? sortDir === "asc" ? "desc" : "asc"
      : field === "created" || field === "lastSeen" ? "desc" : "asc"
    update({ sort: field, dir: nextDir })
    change({ sort: field, dir: nextDir, page: "1" })
  }

  const facets: FacetSource = (def, others) => getUserFacets(def.key, debounced, others)
  const filtered = activeCount(bag) > 0 || query.q !== ""
  function resetFilters() {
    setSearch("")
    setBag({})
    setQuery({ q: "" })
  }

  const firstLoad = loading && users.length === 0
  const stateKind = error ? "error" : firstLoad ? "loading" : users.length === 0 ? "empty" : null

  // The viewer and accounts of an equal or higher role cannot be selected (the server refuses them too).
  const selectable = (u: UserRow) => u.ID !== me?.ID && canManageAccount(callerRole, u.Role)
  const selectableIds = users.filter(selectable).map((u) => u.ID)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selected.size > 0 && !allSelected
  }, [selected, allSelected])

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // «Вибрати всі за фільтром»: reads the other pages (a bulk action takes at most BULK_LIMIT accounts).
  async function selectAllMatching() {
    setGathering(true)
    try {
      const ids = new Set<string>()
      for (let at = 1; ids.size < total && at <= Math.ceil(BULK_LIMIT / 100); at += 1) {
        const res = await listUsers({ ...request, page: at, pageSize: 100 })
        for (const u of res.Items ?? []) if (selectable(u)) ids.add(u.ID)
        if ((res.Items ?? []).length < 100) break
      }
      setSelected(ids)
    } catch (err) {
      toast.error(overloadOr(err, t("admin.users.loadError")))
    } finally {
      setGathering(false)
    }
  }

  const bulkActions = BULK_ORDER.filter((action) => can(BULK[action].permission))
  const retry = () => { setError(null); setLoading(true); setReloadKey((k) => k + 1) }

  async function runBulk() {
    if (!bulk) return
    setBulkBusy(true)
    setBulkError(null)
    try {
      const results = await bulkUsers(bulk, [...selected])
      const done = results.filter((r) => r.Ok).length
      const skipped = selected.size - done
      if (skipped > 0) toast.error(t("admin.users.bulk.partial", { done, skipped }))
      else toast.success(tPlural("admin.users.bulk.done", done))
      setBulk(null)
      setSelected(new Set())
      setReloadKey((k) => k + 1)
    } catch (err) {
      setBulkError(overloadOr(err, t("admin.users.bulk.error")))
    } finally {
      setBulkBusy(false)
    }
  }

  async function resend(user: UserRow) {
    setResending(user.ID)
    try {
      await resendInvitation(user.ID)
      toast.success(t("admin.users.resend.done", { email: user.Email }))
    } catch (err) {
      toast.error(err instanceof ApiError ? overloadOr(err, t("admin.users.resend.error")) : t("admin.users.resend.error"))
    } finally {
      setResending(null)
    }
  }

  const selectCount = selected.size
  const canResend = can("users.invite")
  const hasSelect = bulkActions.length > 0
  const widthOf = (key: string) => live[key] ?? columnWidth(colOf(key).width, view.widths?.[key])
  const tableWidth = (hasSelect ? SELECT_W : 0) + cols.reduce((sum, key) => sum + widthOf(key), 0) + ACTIONS_W
  const colCount = cols.length + (hasSelect ? 1 : 0) + 1
  const canSelectAll = selectCount < total && total <= BULK_LIMIT && total > selectCount

  const cell = (key: string, u: UserRow) => {
    switch (key) {
      case "user": return <div className="ib-person">
        <Avatar picture={u.Picture} firstName={u.FirstName} lastName={u.LastName} email={u.Email} />
        <Link href={`/users/detail?id=${u.ID}`} title={fullName(u)} className="ib-table__name block min-w-0 truncate py-1 hover:underline">{fullName(u)}</Link>
      </div>
      case "email": return u.Email
      case "role": return <RoleBadge role={u.Role} size="sm" />
      case "status": return <StatusBadge status={u.Status} size="sm" />
      case "signIn": return u.SignInMethods?.length ? u.SignInMethods.map((m) => t(`admin.method.${m}`)).join(", ") : "—"
      case "lastSeen": return isUnsetDate(u.LastSeen) ? t("admin.users.never") : <HoverTooltip text={formatListDateTime(u.LastSeen)}><span><TimeText iso={u.LastSeen}>{relativeTime(u.LastSeen)}</TimeText></span></HoverTooltip>
      default: return <TimeText iso={u.CreatedAt}>{formatListDateTime(u.CreatedAt)}</TimeText>
    }
  }

  const toolbar = selectCount > 0 && hasSelect
    ? <SelectionBar count={selectCount} onClear={() => setSelected(new Set())} selectAll={canSelectAll ? { total, busy: gathering, onSelect: () => void selectAllMatching() } : undefined}>
      {bulkActions.map((action) => (
        <Button key={action} type="button" variant="outline" size="sm" onClick={() => { setBulkError(null); setBulk(action) }}>{t(`admin.users.bulk.${action}`)}</Button>
      ))}
    </SelectionBar>
    : <>
      <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
        placeholder={t("admin.users.search")} aria-label={t("admin.users.search")}
        className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm" />
      <FilterBar defs={defs} bag={bag} onChange={setBag} pinned={view.pinned ?? []} onPinned={(pinned) => update({ pinned })} facets={facets} />
      <ResetFilters active={filtered} onReset={resetFilters} />
      <span className="ml-auto">
        <ColumnsMenu cols={cols} allKeys={ALL_KEYS} identity={IDENTITY} label={(key) => t(colOf(key).label)} onChange={(next) => update({ cols: next })} onReset={reset} resettable={changed} />
      </span>
    </>

  return (
    <div className="ib-index">
      <PageHeader title={t("admin.users.title")} count={loading && users.length === 0 ? undefined : total}
        actions={can("users.invite") ? <Button className="h-10 shrink-0 text-sm" onClick={() => setInviteOpen(true)}>{t("admin.users.invite.button")}</Button> : undefined}
        filters={toolbar} />

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onClosed={() => { goToPage(1); setError(null); setReloadKey((k) => k + 1) }}
      />

      <TableWrap fill scrollRef={tableScrollRef} label={t("admin.users.title")} rows={8} className="min-h-0">
        <table aria-busy={loading} style={{ width: tableWidth, minWidth: "100%" }}
          className={`ib-table ib-table--cards ib-table--fixed${hasSelect ? " ib-table--selectable" : ""}${loading && !firstLoad ? " is-refreshing" : ""}`} aria-label={t("admin.users.title")}>
          <colgroup>
            {hasSelect && <col style={{ width: SELECT_W }} />}
            {cols.map((key) => <col key={key} style={{ width: widthOf(key) }} />)}
            <col style={{ width: ACTIONS_W }} />
          </colgroup>
          <thead>
            <tr>
              {hasSelect && <th scope="col" className="ib-table__select">
                <Checkbox ref={selectAllRef} aria-label={t("admin.table.selectAll")} checked={allSelected} disabled={selectableIds.length === 0}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(selectableIds))} />
              </th>}
              {cols.map((key) => {
                const col = colOf(key)
                return <SortTh key={key} className={key === IDENTITY ? "ib-table__pin" : undefined} label={t(col.label)} field={col.sort} activeField={sortBy} direction={sortDir} onSort={sort}>
                  <ResizeHandle width={widthOf(key)} label={t(col.label)} onLive={(w) => setLive((current) => ({ ...current, [key]: w }))}
                    onCommit={(w) => { setLive((current) => { const next = { ...current }; delete next[key]; return next }); update({ widths: { ...view.widths, [key]: w } }) }} />
                </SortTh>
              })}
              <Th className="ib-table__actions"><span className="sr-only">{t("admin.users.col.actions")}</span></Th>
            </tr>
          </thead>
          {stateKind ? (
            <TableState colSpan={colCount} kind={stateKind}
              message={error ? t("admin.users.loadError") : t(filtered ? "admin.users.empty" : "admin.users.emptyInitial")}
              error={error?.cause} onRetry={retry} />
          ) : (
            <tbody className={loading ? "pointer-events-none" : undefined}>
              {users.map((u) => (
                <tr key={u.ID} aria-selected={selected.has(u.ID) || undefined}>
                  {hasSelect && <td className="ib-table__select">
                    <Checkbox aria-label={t("admin.table.selectRow", { name: fullName(u) })} checked={selected.has(u.ID)} disabled={!selectable(u)} onChange={() => toggleOne(u.ID)} />
                  </td>}
                  {cols.map((key) => key === IDENTITY
                    ? <td key={key} className="ib-table__primary ib-table__pin">{cell(key, u)}</td>
                    : <td key={key} className={key === "email" || key === "signIn" || key === "lastSeen" || key === "created" ? "ib-table__dim" : undefined} data-label={t(colOf(key).label)}>{cell(key, u)}</td>)}
                  <td className="ib-table__actions">
                    {canResend && u.Status === "incomplete" && selectable(u) && (
                      <Button type="button" variant="outline" size="sm" className="min-w-max" busy={resending === u.ID} busyLabel={t("busy.sending")} onClick={() => void resend(u)}>
                        <Send aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />{t("admin.users.resend.button")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </TableWrap>
      <TablePagination page={page} pageSize={pageSize} total={total} busy={loading}
        onPage={goToPage} onPageSize={(size) => change({ size: String(size), page: "1" })} />

      <ConfirmDialog open={bulk !== null} onCancel={() => { if (!bulkBusy) setBulk(null) }} tone={bulk && BULK[bulk].danger ? "danger" : "default"}
        busy={bulkBusy} busyLabel={t(bulk ? BULK[bulk].busy : "busy.applying")} error={bulkError}
        title={bulk ? tPlural(`admin.users.bulk.${bulk}.title`, selectCount) : ""}
        description={bulk ? t(`admin.users.bulk.${bulk}.body`) : undefined}
        confirmLabel={bulk ? t(`admin.users.bulk.${bulk}.confirm`) : ""}
        onConfirm={() => void runBulk()} />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}>
      <UsersList />
    </Suspense>
  )
}
