"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { apiGet } from "@/api/client"
import { t } from "@/i18n/t"
import { RoleBadge, StatusBadge } from "@/components/users/RoleStatusBadge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRole } from "@/lib/useRole"
import InviteUsersDialog from "@/components/users/InviteUsersDialog"

export type UserRow = {
  ID: string
  FirstName: string
  LastName: string
  Email: string
  Role: string
  Status: string
  CreatedAt: string
}
type ListResp = { Users: UserRow[]; NextCursor: string; HasMore: boolean }

const ROLES = ["super_admin", "admin", "admin_viewer", "user"]
const PAGE = 50

function fullName(u: UserRow): string {
  const n = `${u.FirstName ?? ""} ${u.LastName ?? ""}`.trim()
  return n || u.Email
}

export default function Page() {
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [roles, setRoles] = useState<string[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [cursor, setCursor] = useState("")
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const { can } = useRole()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const buildQuery = useCallback((cur: string) => {
    const p = new URLSearchParams()
    if (debounced) p.set("search", debounced)
    roles.forEach((r) => p.append("role", r))
    if (cur) p.set("cursor", cur)
    p.set("limit", String(PAGE))
    return p.toString()
  }, [debounced, roles])

  // First page on filter/search change.
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false); setUsers([]); setCursor(""); setHasMore(false)
    apiGet<ListResp>(`/api/users?${buildQuery("")}`)
      .then((d) => { if (!cancelled) { setUsers(d.Users ?? []); setCursor(d.NextCursor ?? ""); setHasMore(d.HasMore ?? false) } })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [buildQuery, reloadKey])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !cursor) return
    setLoadingMore(true)
    apiGet<ListResp>(`/api/users?${buildQuery(cursor)}`)
      .then((d) => {
        setUsers((prev) => [...prev, ...(d.Users ?? [])])
        setCursor(d.NextCursor ?? "")
        setHasMore(d.HasMore ?? false)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [hasMore, loadingMore, cursor, buildQuery])

  // Keep the latest loadMore in a ref so the observer effect runs once.
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current() },
      { rootMargin: "200px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  function toggleRole(r: string) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  return (
    <div className="frost-panel frost-in rounded-lg p-6">
      <div className="mb-3 flex items-center gap-3">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.users.search")}
          className="max-w-sm"
        />
        {can("users.invite") && (
          <Button onClick={() => setInviteOpen(true)}>{t("admin.users.invite.button")}</Button>
        )}
      </div>

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onClosed={() => setReloadKey((k) => k + 1)}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.users.filterRoles")}</span>
        {ROLES.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Switch checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} aria-label={t(`admin.role.${r}`)} />
            {t(`admin.role.${r}`)}
          </label>
        ))}
      </div>

      {error ? (
        <p className="py-8 text-center text-sm text-destructive">{t("admin.users.loadError")}</p>
      ) : loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.loading")}</p>
      ) : users.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.users.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("admin.users.col.user")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.users.col.role")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.users.col.status")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.users.col.created")}</th>
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
                  <td className="px-3 py-2 text-muted-foreground">{u.CreatedAt ? new Date(u.CreatedAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Infinite-scroll sentinel + status line. */}
      <div ref={sentinelRef} className="h-6" />
      {loadingMore && <p className="py-2 text-center text-xs text-muted-foreground">{t("admin.users.loadingMore")}</p>}
      {!loading && !hasMore && users.length > 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">{t("admin.users.endOfList")}</p>
      )}
    </div>
  )
}
