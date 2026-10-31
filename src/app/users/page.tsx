"use client"
import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDown, Send } from "lucide-react"
import { ApiError } from "@/api/client"
import { bulkUsers, INACTIVE_DAYS, listUsers, resendInvitation, SIGN_IN_FILTERS, type BulkAction, type UserFilters, type UserRow } from "@/api/users"
import { t } from "@/i18n/t"
import { tPlural } from "@/i18n/plural"
import { overloadOr } from "@/i18n/apiError"
import { RoleBadge, StatusBadge } from "@/components/users/RoleStatusBadge"
import { Avatar } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { SortTh, TableState, TableWrap, Th, TimeText } from "@/components/common/DsTable"
import { ResetFilters } from "@/components/table/ResetFilters"
import { SelectionBar } from "@/components/table/SelectionBar"
import { useUrlState } from "@/lib/useUrlState"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SelectMenu } from "@/components/ui/select-menu"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
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

function fullName(u: UserRow): string {
  const n = `${u.FirstName ?? ""} ${u.LastName ?? ""}`.trim()
  return n || u.Email
}

const DEFAULTS = { q: "", role: "", status: "all", confirmed: "all", signIn: "all", inactive: "0", page: "1", size: "50", sort: "created", dir: "desc" }
const FILTER_KEYS = ["q", "role", "status", "confirmed", "signIn", "inactive"] as const

// What a bulk action does: the permission it needs, the confirmation texts and the busy label (AGENTS.md: ConfirmDialog, busy buttons).
const BULK: Record<BulkAction, { permission: string; danger: boolean; busy: string }> = {
  "resend-invitation": { permission: "users.invite", danger: false, busy: "busy.sending" },
  block: { permission: "users.status.write", danger: true, busy: "busy.blocking" },
  unblock: { permission: "users.status.write", danger: false, busy: "busy.unblocking" },
  "end-sessions": { permission: "users.status.write", danger: true, busy: "busy.endingSessions" },
}
const BULK_ORDER: BulkAction[] = ["resend-invitation", "block", "unblock", "end-sessions"]

function UsersList() {
  const [query, setQuery] = useUrlState(DEFAULTS)
  const roles = query.role ? query.role.split(",").filter(Boolean) : []
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Number(query.size) || 50
  const sortBy = query.sort
  const sortDir: "asc" | "desc" = query.dir === "asc" ? "asc" : "desc"
  const debounced = query.q

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
  const selectAllRef = useRef<HTMLInputElement>(null)

  // Any change of the view starts a new selection: the chosen rows would no longer be the rows on screen.
  function change(patch: Partial<typeof DEFAULTS>) {
    setSelected(new Set())
    setQuery(patch)
  }

  // Debounce the search box into the URL; an unchanged query must not reset the page the user moved to.
  useEffect(() => {
    const next = search.trim()
    if (next === debounced) return
    const id = setTimeout(() => { setSelected(new Set()); setQuery({ q: next, page: "1" }) }, 300)
    return () => clearTimeout(id)
  }, [search, debounced, setQuery])

  const filters: UserFilters = {
    search: debounced, roles, status: query.status, confirmed: query.confirmed, signIn: query.signIn, inactiveDays: query.inactive,
    page, pageSize, sortBy, sortDir,
  }
  const requestKey = JSON.stringify(filters)

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setLoading(true); setError(null) } })
    listUsers(JSON.parse(requestKey) as UserFilters)
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
    change({ sort: field, dir: nextDir, page: "1" })
  }

  function toggleRole(r: string) {
    const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]
    change({ role: PLATFORM_ROLES.filter((x) => next.includes(x)).join(","), page: "1" })
  }

  function resetFilters() {
    setSearch("")
    change({ q: "", role: "", status: "all", confirmed: "all", signIn: "all", inactive: "0", page: "1" })
  }

  const filtered = FILTER_KEYS.some((key) => query[key] !== DEFAULTS[key])
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
  const colCount = hasSelect ? 9 : 8

  return (
    <div className="ib-index">
      <PageHeader title={t("admin.users.title")} count={loading && users.length === 0 ? undefined : total}
        actions={can("users.invite") ? <Button className="h-10 shrink-0 text-sm" onClick={() => setInviteOpen(true)}>{t("admin.users.invite.button")}</Button> : undefined}
        filters={<>
          <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.users.search")} aria-label={t("admin.users.search")}
            className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 min-w-48 justify-between px-3 text-sm font-normal">
                <span className="truncate">
                  {roles.length === 0
                    ? t("admin.users.filterRolesAll")
                    : PLATFORM_ROLES.filter((r) => roles.includes(r)).map(roleLabel).join(", ")}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              {PLATFORM_ROLES.map((r) => (
                <DropdownMenuCheckboxItem
                  key={r}
                  checked={roles.includes(r)}
                  onCheckedChange={() => toggleRole(r)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {roleLabel(r)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <SelectMenu
            value={query.status}
            onChange={(value) => change({ status: value, page: "1" })}
            options={[{ value: "all", label: t("admin.users.filterStatusAll") }, ...STATUSES.map((value) => ({ value, label: t(`admin.status.${value}`) }))]}
            ariaLabel={t("admin.users.filterStatus")}
            className="h-10 min-w-40 text-sm"
          />
          <SelectMenu
            value={query.confirmed}
            onChange={(value) => change({ confirmed: value, page: "1" })}
            options={[{ value: "all", label: t("admin.users.filterConfirmedAll") }, { value: "yes", label: t("admin.users.filterConfirmedYes") }, { value: "no", label: t("admin.users.filterConfirmedNo") }]}
            ariaLabel={t("admin.users.filterConfirmed")}
            className="h-10 min-w-44 text-sm"
          />
          <SelectMenu
            value={query.signIn}
            onChange={(value) => change({ signIn: value, page: "1" })}
            options={[{ value: "all", label: t("admin.users.filterSignInAll") }, ...SIGN_IN_FILTERS.map((value) => ({ value, label: t(`admin.method.${value === "password" ? "email" : value}`) }))]}
            ariaLabel={t("admin.users.filterSignIn")}
            className="h-10 min-w-44 text-sm"
          />
          <SelectMenu
            value={query.inactive}
            onChange={(value) => change({ inactive: value, page: "1" })}
            options={[{ value: "0", label: t("admin.users.filterInactiveAll") }, ...INACTIVE_DAYS.map((days) => ({ value: String(days), label: tPlural("admin.users.filterInactiveDays", days) }))]}
            ariaLabel={t("admin.users.filterInactive")}
            className="h-10 min-w-48 text-sm"
          />
          <ResetFilters active={filtered} onReset={resetFilters} />
        </>} />

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onClosed={() => { goToPage(1); setError(null); setReloadKey((k) => k + 1) }}
      />

      {selectCount > 0 && bulkActions.length > 0 && (
        <SelectionBar count={selectCount} onClear={() => setSelected(new Set())}>
          {bulkActions.map((action) => (
            <Button key={action} type="button" variant="outline" size="sm" onClick={() => { setBulkError(null); setBulk(action) }}>{t(`admin.users.bulk.${action}`)}</Button>
          ))}
        </SelectionBar>
      )}

      <TableWrap fill scrollRef={tableScrollRef} label={t("admin.users.title")} rows={8} className="min-h-0">
          <table aria-busy={loading} className={`ib-table ib-table--cards${hasSelect ? " ib-table--selectable" : ""}${loading && !firstLoad ? " is-refreshing" : ""}`} aria-label={t("admin.users.title")}>
            <thead>
              <tr>
                {hasSelect && <th scope="col" className="ib-table__select">
                  <Checkbox ref={selectAllRef} aria-label={t("admin.table.selectAll")} checked={allSelected} disabled={selectableIds.length === 0}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(selectableIds))} />
                </th>}
                <SortTh className="ib-table__pin" label={t("admin.users.col.user")} field="name" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortTh label={t("admin.users.col.email")} field="email" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortTh label={t("admin.users.col.role")} field="role" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortTh label={t("admin.users.col.status")} field="status" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortTh label={t("admin.users.col.signIn")} field="signIn" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortTh label={t("admin.users.col.lastSeen")} field="lastSeen" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortTh label={t("admin.users.col.created")} field="created" activeField={sortBy} direction={sortDir} onSort={sort} />
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
                    <td className="ib-table__primary ib-table__pin">
                      <div className="ib-person">
                        <Avatar picture={u.Picture} firstName={u.FirstName} lastName={u.LastName} email={u.Email} />
                        <Link href={`/users/detail?id=${u.ID}`} title={fullName(u)} className="ib-table__name block min-w-32 max-w-64 truncate py-1 hover:underline">{fullName(u)}</Link>
                      </div>
                    </td>
                    <td className="ib-table__dim" data-label={t("admin.users.col.email")}>{u.Email}</td>
                    <td data-label={t("admin.users.col.role")}><RoleBadge role={u.Role} size="sm" /></td>
                    <td data-label={t("admin.users.col.status")}><StatusBadge status={u.Status} size="sm" /></td>
                    <td className="ib-table__dim" data-label={t("admin.users.col.signIn")}>{u.SignInMethods?.length ? u.SignInMethods.map((m) => t(`admin.method.${m}`)).join(", ") : "—"}</td>
                    <td className="ib-table__dim" data-label={t("admin.users.col.lastSeen")}>
                      {isUnsetDate(u.LastSeen) ? t("admin.users.never") : <HoverTooltip text={formatListDateTime(u.LastSeen)}><span><TimeText iso={u.LastSeen}>{relativeTime(u.LastSeen)}</TimeText></span></HoverTooltip>}
                    </td>
                    <td className="ib-table__dim" data-label={t("admin.users.col.created")}><TimeText iso={u.CreatedAt}>{formatListDateTime(u.CreatedAt)}</TimeText></td>
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
