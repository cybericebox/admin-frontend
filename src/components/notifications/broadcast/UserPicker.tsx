"use client"
import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { apiGet } from "@/api/client"
import type { OffsetPage } from "@/api/pagination"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { HoverTooltip } from "@/components/ui/hover-tooltip"

export type PickedUser = { id: string; name: string; email: string }
type UserRow = { ID: string; FirstName: string; LastName: string; Email: string }

const PAGE_SIZE = 20

function displayName(user: UserRow): string {
  return `${user.FirstName ?? ""} ${user.LastName ?? ""}`.trim() || user.Email
}

// Search picker over the platform users list (GET /api/users?search=). Selected users stay
// visible as chips while the search changes.
export function UserPicker({ value, onChange, selection = "user", maxSelected, showSelected = true }: {
  value: PickedUser[]; onChange: (users: PickedUser[]) => void;
  selection?: "user" | "email"; maxSelected?: number; showSelected?: boolean;
}) {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const next = search.trim()
    if (next === query) return
    const timer = setTimeout(() => setQuery(next), 300)
    return () => clearTimeout(timer)
  }, [search, query])

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setLoading(true); setError(null) } })
    const params = new URLSearchParams({ page: "1", pageSize: String(PAGE_SIZE), sortBy: "created", sortDir: "desc" })
    if (query) params.set("search", query)
    apiGet<OffsetPage<UserRow>>(`/api/users?${params.toString()}`)
      .then((page) => { if (active) setRows(page.Items ?? []) })
      .catch((cause) => { if (active) setError({ cause }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, reload])

  const keyOf = (user: PickedUser) => selection === "email" ? user.email.trim().toLowerCase() : user.id
  const selected = new Set(value.map(keyOf))
  function toggle(row: UserRow) {
    const user = { id: row.ID, name: displayName(row), email: row.Email?.trim() ?? "" }
    const key = keyOf(user)
    if (selection === "email" && !key) return
    onChange(selected.has(key) ? value.filter((item) => keyOf(item) !== key) : [...value, user])
  }

  return (
    <div className="space-y-3">
      <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.notif.broadcast.users.search")} aria-label={t("admin.notif.broadcast.users.search")} />
      {showSelected && value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("admin.notif.broadcast.users.selected", { count: value.length })}>
          {value.map((user) => (
            <li key={user.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-3 pr-1 text-sm text-foreground">
              <span>{user.name}</span>
              <HoverTooltip text={t("admin.notif.broadcast.users.remove")}>
                <button type="button" aria-label={t("admin.notif.broadcast.users.removeNamed", { name: user.name })} onClick={() => onChange(value.filter((item) => item.id !== user.id))} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </HoverTooltip>
            </li>
          ))}
        </ul>
      )}
      <div className="flex h-56 flex-col overflow-auto rounded-md border border-border" aria-busy={loading}>
        {error ? (
          <LoadError message={t("admin.notif.broadcast.users.loadError")} error={error.cause} compact className="flex-1" onRetry={() => setReload((n) => n + 1)} />
        ) : loading ? (
          <LoadingArea compact className="flex-1" label={t("admin.loading")} />
        ) : rows.length === 0 ? (
          <EmptyState compact className="flex-1" message={t("admin.notif.broadcast.users.empty")} />
        ) : (
          <ul>
            {rows.map((row) => {
              const email = row.Email?.trim() ?? ""
              const checked = selected.has(selection === "email" ? email.toLowerCase() : row.ID)
              const unavailable = selection === "email" && !email
              return (
              <li key={row.ID} className="border-b border-border/50 px-3 py-2 last:border-b-0">
                <Checkbox checked={checked} disabled={unavailable || !checked && maxSelected !== undefined && selected.size >= maxSelected} onChange={() => toggle(row)}
                  label={selection === "email" ? <span className="grid min-w-0 gap-0.5 [overflow-wrap:anywhere]"><span>{displayName(row)}</span><span className="text-xs text-muted-foreground">{email || t("admin.errors.settings.userNoEmail")}</span></span>
                    : <span>{displayName(row)} <span className="text-muted-foreground">{row.Email}</span></span>} />
              </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
