"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client"
import type { CursorPage } from "@/api/pagination"
import type { EventManager } from "@/api/events/catalog"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { FieldHelp } from "@/components/ui/field-help"
import { Input } from "@/components/ui/input"
import { SelectMenu } from "@/components/ui/select-menu"
import { assignableRoles } from "@/lib/assignableRoles"
import { useRole, type Role } from "@/lib/useRole"
import { eventRoleLabel, roleLabel } from "@/lib/roles"
import { t } from "@/i18n/t"

type UserSummary = { ID: string; FirstName: string; LastName: string; Email: string }
type InviteResult = { Email: string; Error?: string }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const managerRoles = [1, 2].map((code) => ({ value: String(code), label: eventRoleLabel(code) }))

function nameOf(user: UserSummary | undefined, fallback: string): string {
  if (!user) return fallback
  return `${user.FirstName ?? ""} ${user.LastName ?? ""}`.trim() || user.Email || fallback
}

export function EventManagersCard({ eventID, managers, editable, onChanged, onRemoved }: {
  eventID: string
  managers: EventManager[]
  editable: boolean
  onChanged: (manager: EventManager) => void
  onRemoved?: (userID: string) => void
}) {
  const { can } = useRole()
  const assignablePlatformRoles = assignableRoles(can)
  const [users, setUsers] = useState<Record<string, UserSummary>>({})
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState("")
  const [matches, setMatches] = useState<UserSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [searchedQuery, setSearchedQuery] = useState("")
  const [foundExact, setFoundExact] = useState(false)
  const [selected, setSelected] = useState<UserSummary | null>(null)
  const [newRole, setNewRole] = useState("1")
  const [platformRole, setPlatformRole] = useState<Role>("user")
  const [busyID, setBusyID] = useState("")
  const [removing, setRemoving] = useState<EventManager | null>(null)
  const [removeError, setRemoveError] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    Promise.allSettled(managers.map((manager) => apiGet<UserSummary>(`/api/users/${encodeURIComponent(manager.UserID)}`)))
      .then((results) => {
        if (!active) return
        setUsers((previous) => {
          const next = { ...previous }
          results.forEach((result) => { if (result.status === "fulfilled") next[result.value.ID] = result.value })
          return next
        })
      })
    return () => { active = false }
  }, [managers])

  useEffect(() => {
    if (!adding || !search.trim()) return
    let active = true
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({ search: search.trim(), pageSize: "10" })
      setSearching(true)
      apiGet<CursorPage<UserSummary>>(`/api/users?${query}`)
        .then((page) => { if (active) { setMatches((page.Items ?? []).filter((user) => !managers.some((manager) => manager.UserID === user.ID))); setFoundExact((page.Items ?? []).some((user) => user.Email.toLowerCase() === search.trim().toLowerCase())); setSearchedQuery(search.trim()) } })
        .catch(() => { if (active) setError(t("admin.events.manager.searchError")) })
        .finally(() => { if (active) setSearching(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [adding, managers, search])

  async function save(userID: string, role: number) {
    setBusyID(userID)
    setError("")
    try {
      const result = await apiPut<EventManager>(`/api/events/${encodeURIComponent(eventID)}/managers/${encodeURIComponent(userID)}`, { Role: role })
      onChanged(result)
      toast.success(t("admin.events.manager.saved"))
      if (selected?.ID === userID) {
        setUsers((previous) => ({ ...previous, [selected.ID]: selected }))
        setSelected(null)
        setSearch("")
        setMatches([])
        setAdding(false)
      }
    } catch {
      toast.error(t("admin.events.manager.saveError"))
    } finally {
      setBusyID("")
    }
  }

  const inviteEmail = search.trim().toLowerCase()
  const canInvite = editable && can("users.invite") && EMAIL_RE.test(inviteEmail) && searchedQuery.toLowerCase() === inviteEmail && !searching && !selected && !foundExact

  // One fixed-size results block: crest while searching, matches, or the empty state before the invite form.
  const showResults = !selected && (searching || matches.length > 0 || canInvite)

  async function inviteAndAdd() {
    if (!canInvite || !assignablePlatformRoles.includes(platformRole)) return
    setBusyID("invite")
    setError("")
    let invited = false
    try {
      const results = await apiPost<InviteResult[]>("/api/users/invite", { Emails: [inviteEmail], Role: platformRole })
      if (!results?.[0] || results[0].Error) throw new Error(results?.[0]?.Error ?? "invite_failed")
      invited = true
      const page = await apiGet<CursorPage<UserSummary>>(`/api/users?${new URLSearchParams({ search: inviteEmail, pageSize: "10" })}`)
      const user = (page.Items ?? []).find((item) => item.Email.toLowerCase() === inviteEmail)
      if (!user) throw new Error("invited_user_not_found")
      const manager = await apiPut<EventManager>(`/api/events/${encodeURIComponent(eventID)}/managers/${encodeURIComponent(user.ID)}`, { Role: Number(newRole) })
      setUsers((previous) => ({ ...previous, [user.ID]: user }))
      onChanged(manager)
      toast.success(t("admin.events.manager.invited"))
      setSearch("")
      setSearchedQuery("")
      setMatches([])
      setAdding(false)
    } catch {
      toast.error(t(invited ? "admin.events.manager.invitedNotAssigned" : "admin.events.manager.inviteError"))
    } finally {
      setBusyID("")
    }
  }

  async function remove() {
    if (!removing) return
    setBusyID(removing.UserID)
    setError("")
    try {
      await apiDelete(`/api/events/${encodeURIComponent(eventID)}/managers/${encodeURIComponent(removing.UserID)}`)
      onRemoved?.(removing.UserID)
      toast.success(t("admin.events.manager.removed"))
      setRemoving(null)
    } catch {
      setRemoveError(t("admin.events.manager.removeError"))
    } finally {
      setBusyID("")
    }
  }

  return <Card><CardContent className="pt-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-base font-semibold text-foreground">{t("admin.events.manager.title")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("admin.events.manager.description")}</p></div>
      {editable && <Button type="button" variant="outline" size="sm" onClick={() => { setAdding((value) => !value); setError("") }}>{adding ? t("admin.events.dialog.cancel") : t("admin.events.manager.add")}</Button>}
    </div>

    {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    <ul className="divide-y divide-border">
      {managers.map((manager) => {
        const user = users[manager.UserID]
        const displayName = nameOf(user, manager.UserID)
        return <li key={manager.UserID} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link className="break-words text-sm font-medium text-primary hover:underline" href={`/users/detail?id=${encodeURIComponent(manager.UserID)}`}>{displayName}</Link>
            {user?.Email && <p className="break-all text-xs text-muted-foreground">{user.Email}</p>}
          </div>
          {manager.Role === 0 ? <span className="text-sm text-muted-foreground">{eventRoleLabel(0)}</span> : editable ? <>
            <SelectMenu value={String(manager.Role)} onChange={(value) => void save(manager.UserID, Number(value))} options={managerRoles} disabled={!!busyID} ariaLabel={t("admin.events.manager.changeRole", { name: displayName })} className="w-36" />
            <Button type="button" variant="outline" size="sm" disabled={!!busyID} onClick={() => { setRemoveError(""); setRemoving(manager) }} aria-label={t("admin.events.manager.removeName", { name: displayName })}>{t("admin.events.manager.remove")}</Button>
          </> : <span className="text-sm text-muted-foreground">{eventRoleLabel(manager.Role)}</span>}
        </li>
      })}
    </ul>

    {adding && editable && <div className="mt-4 space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center gap-1.5"><label className="text-sm font-medium" htmlFor="event-manager-search">{t("admin.events.manager.user")}</label><FieldHelp text={t("admin.events.manager.userHelp")} /></div>
      <Input id="event-manager-search" value={search} onChange={(event) => { setSearch(event.target.value); setSelected(null); setMatches([]); setSearchedQuery(""); setFoundExact(false) }} placeholder={t("admin.events.manager.searchPlaceholder")} autoComplete="off" />
      {showResults && <div className="flex h-48 flex-col overflow-y-auto rounded-md border border-border">
        {searching ? <LoadingArea compact className="flex-1" label={t("admin.events.manager.searching")} /> : matches.length > 0 ? <ul>{matches.map((user) => <li key={user.ID}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setSelected(user); setSearch(`${nameOf(user, user.ID)} — ${user.Email}`); setMatches([]) }}>{nameOf(user, user.ID)} <span className="text-muted-foreground">{user.Email}</span></button></li>)}</ul> : <EmptyState message={t("admin.events.manager.notFoundInvite")} compact className="flex-1" />}
      </div>}
      <div className="flex flex-wrap items-end gap-2"><div className="space-y-1.5"><div className="flex items-center gap-1.5"><span className="text-sm font-medium">{t("admin.events.manager.eventRole")}</span><FieldHelp text={t("admin.events.manager.eventRoleHelp")} /></div><SelectMenu value={newRole} onChange={setNewRole} options={managerRoles} ariaLabel={t("admin.events.manager.newRole")} className="w-40" /></div><Button type="button" busy={!!selected && busyID === selected.ID} disabled={!selected || !!busyID} onClick={() => { if (selected) void save(selected.ID, Number(newRole)) }}>{t("admin.events.manager.grant")}</Button></div>
      {canInvite && <div className="space-y-2 border-t border-border pt-3">{matches.length > 0 && <p className="text-sm text-muted-foreground">{t("admin.events.manager.notFoundInvite")}</p>}<div className="flex flex-wrap items-end gap-2"><div className="space-y-1.5"><div className="flex items-center gap-1.5"><span className="text-sm font-medium">{t("admin.events.manager.platformRole")}</span><FieldHelp text={t("admin.events.manager.platformRoleHelp")} /></div><SelectMenu value={platformRole} onChange={(value) => setPlatformRole(value as Role)} options={assignablePlatformRoles.map((role) => ({ value: role, label: roleLabel(role) }))} ariaLabel={t("admin.events.manager.platformRole")} disabled={!!busyID} className="w-44" /></div><Button type="button" variant="outline" busy={busyID === "invite"} disabled={!!busyID} onClick={() => void inviteAndAdd()}>{t("admin.events.manager.inviteAndAdd")}</Button></div></div>}
    </div>}

    <ConfirmDialog open={!!removing} onCancel={() => { if (!busyID) setRemoving(null) }} tone="danger"
      busy={!!removing && busyID === removing.UserID} disabled={!!busyID} error={removeError}
      title={t("admin.events.manager.removeTitle")}
      description={removing ? t("admin.events.manager.removeBody", { name: nameOf(users[removing.UserID], removing.UserID) }) : ""}
      cancelLabel={t("admin.events.dialog.cancel")} confirmLabel={t("admin.events.manager.removeConfirm")}
      onConfirm={() => void remove()} />
  </CardContent></Card>
}
