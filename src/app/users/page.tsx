"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { apiGet } from "@/api/client"
import type { OffsetPage } from "@/api/pagination"
import { t } from "@/i18n/t"
import { ChevronDown } from "lucide-react"
import { RoleBadge, StatusBadge } from "@/components/users/RoleStatusBadge"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
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
import { SortableHeader } from "@/components/ui/sortable-header"

export type UserRow = {
  ID: string
  FirstName: string
  LastName: string
  Email: string
  Role: string
  Status: string
  CreatedAt: string
}
type ListResp = OffsetPage<UserRow>

const STATUSES = ["active", "blocked", "incomplete"]

function fullName(u: UserRow): string {
  const n = `${u.FirstName ?? ""} ${u.LastName ?? ""}`.trim()
  return n || u.Email
}

export default function Page() {
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [roles, setRoles] = useState<string[]>([])
  const [status, setStatus] = useState("all")
  const [users, setUsers] = useState<UserRow[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState("created")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const { can } = useRole()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  // Debounce the search box.
  useEffect(() => {
    const next = search.trim()
    // An unchanged query must not reset the page the user already moved to.
    if (next === debounced) return
    const id = setTimeout(() => { setDebounced(next); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [search, debounced])

  const query = (() => {
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
    queueMicrotask(() => { if (active) { setLoading(true); setError(false) } })
    apiGet<ListResp>(`/api/users?${query}`)
      .then((d) => { if (active) { setUsers(d.Items ?? []); setTotal(d.Total ?? 0) } })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, reloadKey])

  function goToPage(next: number) {
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0
    setLoading(true)
    setPage(next)
  }

  function sort(field: string) {
    const nextDir = field === sortBy ? sortDir === "asc" ? "desc" : "asc"
      : field === "created" ? "desc" : "asc"
    setSortBy(field)
    setSortDir(nextDir)
    goToPage(1)
  }

  function toggleRole(r: string) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
    goToPage(1)
  }

  return (
    <div className="frost-panel frost-in flex h-full min-h-0 flex-col overflow-hidden rounded-lg p-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
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
          onChange={(value) => { setStatus(value); goToPage(1) }}
          options={[{ value: "all", label: t("admin.users.filterStatusAll") }, ...STATUSES.map((value) => ({ value, label: t(`admin.status.${value}`) }))]}
          ariaLabel={t("admin.users.filterStatus")}
          className="h-10 min-w-40 text-sm"
        />
        {can("users.invite") && (
          <Button className="ml-auto h-10 shrink-0 text-sm" onClick={() => setInviteOpen(true)}>{t("admin.users.invite.button")}</Button>
        )}
      </div>

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onClosed={() => { goToPage(1); setError(false); setReloadKey((k) => k + 1) }}
      />

      <div ref={tableScrollRef} className="relative min-h-0 flex-1 overflow-auto" aria-busy={loading}>
      {error && users.length === 0 ? (
        <LoadError message={t("admin.users.loadError")} onRetry={() => { setError(false); setLoading(true); setReloadKey((k) => k + 1) }} className="h-full" />
      ) : loading && users.length === 0 ? (
        <LoadingArea className="h-full" label={t("admin.loading")} />
      ) : users.length === 0 ? (
        <EmptyState message={t(debounced || roles.length > 0 || status !== "all" ? "admin.users.empty" : "admin.users.emptyInitial")} className="h-full" />
      ) : (
        <div className={loading ? "pointer-events-none" : undefined}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <SortableHeader label={t("admin.users.col.user")} field="name" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortableHeader label={t("admin.users.col.role")} field="role" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortableHeader label={t("admin.users.col.status")} field="status" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortableHeader label={t("admin.users.col.created")} field="created" activeField={sortBy} direction={sortDir} onSort={sort} />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.ID} className="border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2">
                    <Link href={`/users/detail?id=${u.ID}`} className="block">
                      <span className="font-medium text-foreground">{fullName(u)}</span>
                      <span className="block text-xs text-muted-foreground">{u.Email}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2"><RoleBadge role={u.Role} /></td>
                  <td className="px-3 py-2"><StatusBadge status={u.Status} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{u.CreatedAt ? new Date(u.CreatedAt).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && users.length > 0 && <div className="sticky bottom-3 ml-auto mr-3 flex w-fit items-center gap-2 rounded-md border border-destructive bg-card px-3 py-1.5 text-xs text-destructive"><span role="alert">{t("admin.users.loadError")}</span><Button variant="outline" size="sm" onClick={() => { setError(false); setLoading(true); setReloadKey((k) => k + 1) }}>{t("admin.users.retry")}</Button></div>}
      </div>
      <TablePagination page={page} pageSize={pageSize} total={total} busy={loading}
        onPage={goToPage} onPageSize={(size) => { setPageSize(size); goToPage(1) }} />
    </div>
  )
}
