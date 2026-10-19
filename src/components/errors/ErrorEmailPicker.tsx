"use client"
import { useEffect, useId, useRef, useState } from "react"
import { apiGet, apiPost, apiPatch } from "@/api/client"
import type { OffsetPage } from "@/api/pagination"
import type { ErrorEmailRecipient } from "@/api/errorJournal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useRole } from "@/lib/useRole"
import { assignableRoles } from "@/lib/assignableRoles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { errorOr } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { roleLabel } from "@/lib/roles"

type User = { ID: string; FirstName: string; LastName: string; Email: string; Role: string; Status: string; EmailConfirmed: boolean }
export function recipientState(user?: ErrorEmailRecipient) {
  if (user?.Status === "blocked") return "blocked"
  if (user?.Role && user.Role !== "super_admin") return "needsPromotion"
  if (user?.Eligible && user.Role === "super_admin") return "ready"
  return user?.Status === "blocked" ? "blocked" : "pending"
}
export function ErrorEmailPicker({ selected, canInvite, onSelect, onClose }: {
  selected: string[]; canInvite: boolean; onSelect: (email: string, recipient: ErrorEmailRecipient) => void; onClose: () => void
}) {
  const { can, role } = useRole()
  const mayGrantSuperAdmin = assignableRoles(can, role).includes("super_admin")
  const canPromote = can("users.role.write") && mayGrantSuperAdmin
  const [promoting, setPromoting] = useState<User | null>(null)
  const [promotionBusy, setPromotionBusy] = useState(false)
  const [promotionError, setPromotionError] = useState("")
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<User[]>([])
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [reload, setReload] = useState(0)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [focused, setFocused] = useState(0)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ pageSize: "10" })
    if (query) params.set("search", query)
    else params.set("role", "super_admin")
    apiGet<OffsetPage<User>>(`/api/users?${params}`)
      .then((page) => { if (active) { setRows(page.Items ?? []); setLoadedQuery(query); setError(null) } })
      .catch((cause) => { if (active) { setError({ cause }); setLoadedQuery(query) } })
    return () => { active = false }
  }, [query, reload])
  const searching = loadedQuery !== search.trim()
  const email = search.trim().toLowerCase()
  const exact = rows.some((user) => user.Email?.trim().toLowerCase() === email)
  const isSelected = (value: string) => selected.some((item) => item.toLowerCase() === value.trim().toLowerCase())
  const available = rows.filter((row) => row.Email && row.Status !== "blocked" && (row.Role === "super_admin" || canPromote) && !isSelected(row.Email))
  const canCreate = canInvite && mayGrantSuperAdmin && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !searching && !error && !exact && !isSelected(email)
  const choose = (user: User) => {
    if (user.Role !== "super_admin") {
      if (canPromote) { setPromoting(user); setPromotionError("") }
      return
    }
    onSelect(user.Email.trim(), { Email: user.Email.trim(), UserID: user.ID, FirstName: user.FirstName, LastName: user.LastName, Role: user.Role, Status: user.Status, EmailConfirmed: user.EmailConfirmed, Eligible: user.Role === "super_admin" && user.Status === "active" && user.EmailConfirmed === true })
    onClose()
  }
  // An invitation creates a super administrator: the typed address is confirmed first (a typo would hand full access to a stranger).
  const [confirmingInvite, setConfirmingInvite] = useState(false)
  async function invite() {
    if (!canCreate || inviting) return
    setInviting(true); setInviteError("")
    try {
      const result = await apiPost<{ Email: string; Code?: string }[]>("/api/users/invite", { Entries: [{ Email: email, FirstName: "", LastName: "", Role: "super_admin" }] })
      const outcome = result?.find((item) => item.Email.toLowerCase() === email)
      if (!outcome) { setInviteError(t("admin.users.invite.missingResult")); return }
      if (outcome.Code) {
        if (outcome.Code === "user_exists") { setReload((value) => value + 1); setInviteError(t("admin.errors.settings.accountExists")); return }
        setInviteError(t(`admin.users.invite.code.${outcome.Code}`)); return
      }
      const page = await apiGet<OffsetPage<User>>(`/api/users?${new URLSearchParams({ search: email, pageSize: "10" })}`)
      const account = page.Items?.find((item) => item.Email.trim().toLowerCase() === email && item.Role === "super_admin")
      if (!account) { setInviteError(t("admin.errors.settings.invitedNotFound")); return }
      choose(account)
    } catch (cause) { setInviteError(errorOr(cause, t("admin.users.invite.error"))) }
    finally { setInviting(false) }
  }
  async function promote() {
    if (!promoting || !canPromote || promotionBusy) return
    setPromotionBusy(true); setPromotionError("")
    try {
      await apiPatch(`/api/users/${encodeURIComponent(promoting.ID)}/role`, { Role: "super_admin" })
      choose({ ...promoting, Role: "super_admin" })
      setPromoting(null)
    } catch (cause) { setPromotionError(errorOr(cause, t("admin.userDetail.actionError"))) }
    finally { setPromotionBusy(false) }
  }
  return <div className="space-y-2 rounded-md border border-border p-3" onKeyDown={(event) => { if (event.key === "Escape" && !inviting && !promoting && !promotionBusy && !confirmingInvite) { event.stopPropagation(); onClose() } }}>
    <ConfirmDialog open={promoting !== null} onCancel={() => { if (!promotionBusy) setPromoting(null) }}
      title={t("admin.errors.settings.promoteTitle")} description={t("admin.errors.settings.promoteHelp", { email: promoting?.Email ?? "" })}
      confirmLabel={t("admin.errors.settings.promoteAndAdd")} busy={promotionBusy} busyLabel={t("busy.promoting")} error={promotionError} onConfirm={() => void promote()} />
    <ConfirmDialog open={confirmingInvite} onCancel={() => { if (!inviting) { setConfirmingInvite(false); setInviteError("") } }}
      title={t("admin.errors.settings.inviteConfirmTitle")} description={t("admin.errors.settings.inviteConfirmHelp")}
      confirmLabel={t("admin.errors.settings.inviteConfirm")} busy={inviting} busyLabel={t("busy.inviting")} error={inviteError || null} onConfirm={() => void invite()}>
      <p className="break-all text-base font-semibold text-foreground">{email}</p>
    </ConfirmDialog>
    <Input ref={input} role="combobox" aria-expanded="true" aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={!searching && available.length ? `${id}-${available[focused % available.length]?.ID}` : undefined}
      aria-label={t("admin.errors.settings.searchRecipient")} placeholder={t("admin.errors.settings.searchRecipient")} value={search}
      onChange={(event) => { setSearch(event.target.value); setFocused(0); setInviteError("") }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setFocused((value) => Math.max(0, value + (event.key === "ArrowDown" ? 1 : -1))) }
        if (event.key === "Enter" && !searching && available.length) { event.preventDefault(); choose(available[focused % available.length]) }
      }} />
    <div className="flex h-48 flex-col overflow-auto rounded-md border border-border" aria-busy={searching}>
      {error ? <LoadError compact className="flex-1" message={t("admin.notif.broadcast.users.loadError")} error={error.cause} onRetry={() => setReload((value) => value + 1)} />
        : loadedQuery === null ? <LoadingArea compact className="flex-1" label={t("admin.loading")} />
          : <ul id={`${id}-list`} role="listbox" aria-label={t("admin.errors.settings.searchRecipient")} className="flex flex-1 flex-col">
            {rows.length === 0 ? <li className="flex flex-1"><EmptyState compact className="flex-1" message={t("admin.notif.broadcast.users.empty")} /></li> : rows.map((user) => {
              const disabled = searching || !user.Email || user.Status === "blocked" || (user.Role !== "super_admin" && !canPromote) || isSelected(user.Email)
              return <li key={user.ID} role="presentation"><button type="button" role="option" id={`${id}-${user.ID}`} aria-selected={isSelected(user.Email)} disabled={disabled}
                onClick={() => choose(user)} tabIndex={-1} className={`flex w-full flex-col gap-0.5 border-b border-border/50 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${available[focused % available.length]?.ID === user.ID && !searching ? "bg-accent" : ""}`}>
                <span className="font-medium [overflow-wrap:anywhere]">{`${user.FirstName ?? ""} ${user.LastName ?? ""}`.trim() || user.Email}</span>
                <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{user.Email}</span>
                <span className="text-xs text-muted-foreground">{t("admin.errors.settings.recipientDetails", { role: roleLabel(user.Role), state: t(`admin.errors.settings.recipientState.${user.Status === "blocked" ? "blocked" : user.Role !== "super_admin" ? "needsPromotion" : user.Status === "active" && user.EmailConfirmed ? "ready" : "pending"}`) })}</span>
                {user.Role !== "super_admin" && canPromote && <span className="text-xs font-medium text-primary">{t("admin.errors.settings.promoteAndAdd")}</span>}
              </button></li>
            })}
          </ul>}
    </div>
    <p className="text-xs text-muted-foreground">{t(canInvite ? "admin.errors.settings.inviteHelp" : "admin.errors.settings.selectHelp")}</p>
    {inviteError && !confirmingInvite && <p role="alert" className="text-sm text-destructive">{inviteError}</p>}
    <div className="flex flex-wrap gap-2">
      {canCreate && <Button type="button" size="sm" className="h-auto min-h-9 whitespace-normal break-all" onClick={() => { setInviteError(""); setConfirmingInvite(true) }}>{t("admin.errors.settings.inviteAndAdd", { email })}</Button>}
      <Button type="button" variant="outline" size="sm" disabled={inviting} onClick={onClose}>{t("confirm.cancel")}</Button>
    </div>
  </div>
}
