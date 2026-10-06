"use client"
import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { apiGet } from "@/api/client"
import type { OffsetPage } from "@/api/pagination"
import { t } from "@/i18n/t"
import { ChevronDown } from "lucide-react"
import { RoleBadge, StatusBadge } from "@/components/users/RoleStatusBadge"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { SortTh, TableState, TableWrap, TimeText } from "@/components/common/DsTable"
import { useUrlState } from "@/lib/useUrlState"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { useRole } from "@/lib/useRole"
import { PLATFORM_ROLES, roleLabel } from "@/lib/roles"
import InviteUsersDialog from "@/components/users/InviteUsersDialog"
import { LoadingArea } from "@/components/ui/spinner"
import { TablePagination } from "@/components/ui/table-pagination"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { formatListDateTime } from "@/lib/locale"
import { relativeTime } from "@/utils/relativeTime"

export type UserRow = {
  ID: string
  FirstName: string
  LastName: string
  Email: string
  Role: string
  Status: string
  LastSeen?: string
  CreatedAt: string
}
type ListResp = OffsetPage<UserRow>

const STATUSES = ["active", "blocked", "incomplete"]

function fullName(u: UserRow): string {
  const n = `${u.FirstName ?? ""} ${u.LastName ?? ""}`.trim()
  return n || u.Email
}

const DEFAULTS = { q: "", role: "", status: "all", page: "1", size: "50", sort: "created", dir: "desc" }

function UsersList() {
  const [query, setQuery] = useUrlState(DEFAULTS)
  const roles = query.role ? query.role.split(",").filter(Boolean) : []
  const status = query.status
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

  const { can } = useRole()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  // Debounce the search box into the URL; an unchanged query must not reset the page the user moved to.
  useEffect(() => {
    const next = search.trim()
    if (next === debounced) return
    const id = setTimeout(() => setQuery({ q: next, page: "1" }), 300)
    return () => clearTimeout(id)
  }, [search, debounced, setQuery])

  const requestQuery = (() => {
    const p = new URLSearchParams()
    if (debounced) p.set("search", debounced)
    roles.forEach((r) => p.append("role", r))
    if (status !== "all") p.set("status", status)
    p.set("page", String(page))
    p.set("pageSize", String(pageSize))
    p.set("sortBy", sortBy)
    p.set("sortDir", sortDir)
    return p.toString()
  })()

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setLoading(true); setError(null) } })
    apiGet<ListResp>(`/api/users?${requestQuery}`)
      .then((d) => { if (active) { setUsers(d.Items ?? []); setTotal(d.Total ?? 0) } })
      .catch((cause) => { if (active) setError({ cause }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [requestQuery, reloadKey])

  function goToPage(next: number) {
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0
    setQuery({ page: String(next) })
  }

  function sort(field: string) {
    const nextDir = field === sortBy ? sortDir === "asc" ? "desc" : "asc"
      : field === "created" || field === "lastSeen" ? "desc" : "asc"
    setQuery({ sort: field, dir: nextDir, page: "1" })
  }

  function toggleRole(r: string) {
    const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]
    setQuery({ role: PLATFORM_ROLES.filter((x) => next.includes(x)).join(","), page: "1" })
  }

  const filtered = !!(debounced || roles.length > 0 || status !== "all")
  const firstLoad = loading && users.length === 0
  const stateKind = error ? "error" : firstLoad ? "loading" : users.length === 0 ? "empty" : null

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
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
            value={status}
            onChange={(value) => setQuery({ status: value, page: "1" })}
            options={[{ value: "all", label: t("admin.users.filterStatusAll") }, ...STATUSES.map((value) => ({ value, label: t(`admin.status.${value}`) }))]}
            ariaLabel={t("admin.users.filterStatus")}
            className="h-10 min-w-40 text-sm"
          />
        </>} />

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onClosed={() => { goToPage(1); setError(null); setReloadKey((k) => k + 1) }}
      />

      <div ref={tableScrollRef} className="min-h-0 overflow-auto" aria-busy={loading}>
        <TableWrap label={t("admin.users.title")} rows={8} className="min-h-0">
          <table className={`ib-table${loading && !firstLoad ? " is-refreshing" : ""}`} aria-label={t("admin.users.title")}>
            <thead>
              <tr>
                <SortTh label={t("admin.users.col.user")} field="name" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortTh label={t("admin.users.col.role")} field="role" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortTh label={t("admin.users.col.status")} field="status" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortTh label={t("admin.users.col.lastSeen")} field="lastSeen" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortTh label={t("admin.users.col.created")} field="created" activeField={sortBy} direction={sortDir} onSort={sort} />
              </tr>
            </thead>
            {stateKind ? (
              <TableState colSpan={5} kind={stateKind}
                message={error ? t("admin.users.loadError") : t(filtered ? "admin.users.empty" : "admin.users.emptyInitial")}
                error={error?.cause} onRetry={() => { setError(null); setLoading(true); setReloadKey((k) => k + 1) }} />
            ) : (
              <tbody className={loading ? "pointer-events-none" : undefined}>
                {users.map((u) => (
                  <tr key={u.ID}>
                    <td>
                      <Link href={`/users/detail?id=${u.ID}`} className="block py-1">
                        <span className="ib-table__name">{fullName(u)}</span>
                        <span className="ib-table__dim block text-[length:var(--ib-fs-13)]">{u.Email}</span>
                      </Link>
                    </td>
                    <td><RoleBadge role={u.Role} size="sm" /></td>
                    <td><StatusBadge status={u.Status} size="sm" /></td>
                    <td className="ib-table__dim">
                      {u.LastSeen ? <HoverTooltip text={formatListDateTime(u.LastSeen)}><span><TimeText iso={u.LastSeen}>{relativeTime(u.LastSeen)}</TimeText></span></HoverTooltip> : "—"}
                    </td>
                    <td className="ib-table__dim"><TimeText iso={u.CreatedAt}>{formatListDateTime(u.CreatedAt)}</TimeText></td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </TableWrap>
      </div>
      <TablePagination page={page} pageSize={pageSize} total={total} busy={loading}
        onPage={goToPage} onPageSize={(size) => setQuery({ size: String(size), page: "1" })} />
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
