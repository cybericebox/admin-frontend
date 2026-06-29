"use client"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { apiGet, apiPatch, apiDelete } from "@/api/client"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { RoleBadge, StatusBadge } from "@/components/users/RoleStatusBadge"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"

type UserDetail = {
  ID: string
  FirstName: string
  LastName: string
  Email: string
  Role: string
  Status: string
  EmailConfirmed: boolean
  Picture: string
  SignInMethods: string[]
  LastSeen: string
  CreatedAt: string
}

// Roles assignable by the current caller (only a holder of "*" — super_admin — can grant super_admin).
function assignableRoles(permissions: string[]): string[] {
  return permissions.includes("*")
    ? ["super_admin", "admin", "admin_viewer", "user"]
    : ["admin", "admin_viewer", "user"]
}

function fullName(u: UserDetail): string {
  const n = `${u.FirstName ?? ""} ${u.LastName ?? ""}`.trim()
  return n || u.Email
}

function Detail() {
  const params = useSearchParams()
  const id = params.get("id") ?? ""
  const router = useRouter()
  const { can, permissions, me } = useRole()

  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(false)

  function load() {
    if (!id) { setNotFound(true); setLoading(false); return }
    setLoading(true)
    setNotFound(false)
    apiGet<UserDetail>(`/api/users/${id}`)
      .then((d) => setUser(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  async function changeRole(role: string) {
    setBusy(true); setActionError(false)
    try {
      await apiPatch(`/api/users/${id}/role`, { Role: role })
      load()
    } catch { setActionError(true) } finally { setBusy(false) }
  }
  async function setStatus(status: string) {
    setBusy(true); setActionError(false)
    try {
      await apiPatch(`/api/users/${id}/status`, { Status: status })
      load()
    } catch { setActionError(true) } finally { setBusy(false) }
  }
  async function remove() {
    setBusy(true); setActionError(false)
    try {
      await apiDelete(`/api/users/${id}`)
      router.push("/users")
    } catch { setActionError(true); setBusy(false) }
  }

  if (loading) {
    return <div className="frost-panel frost-in flex justify-center rounded-lg p-8"><Spinner label={t("admin.loading")} /></div>
  }
  if (notFound || !user) {
    return (
      <div className="frost-panel frost-in rounded-lg p-8">
        <Link href="/users" className="text-sm text-primary hover:underline">← {t("admin.userDetail.back")}</Link>
        <p className="mt-4 text-sm text-muted-foreground">{t("admin.userDetail.notFound")}</p>
      </div>
    )
  }

  // Self-guard: an admin viewing their own account may inspect it but cannot act
  // on it (no self role-change, self-block, or self-delete). Me carries no ID, so
  // identity is matched on the unique email. UI-only — the backend enforces too.
  const isSelf = !!me && me.Email === user.Email

  return (
    <div className="frost-panel frost-in rounded-lg p-6">
      <Link href="/users" className="text-sm text-primary hover:underline">← {t("admin.userDetail.back")}</Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">{fullName(user)}</h1>
        <RoleBadge role={user.Role} />
        <StatusBadge status={user.Status} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{user.Email}</p>

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.userDetail.signInMethods")}</dt>
          <dd className="text-sm text-foreground">
            {user.SignInMethods.length ? user.SignInMethods.map((m) => t(`admin.method.${m}`)).join(", ") : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.userDetail.emailConfirmed")}</dt>
          <dd className="text-sm text-foreground">{user.EmailConfirmed ? t("admin.userDetail.yes") : t("admin.userDetail.no")}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.userDetail.lastSeen")}</dt>
          <dd className="text-sm text-foreground">
            {user.LastSeen && !user.LastSeen.startsWith("0001") ? new Date(user.LastSeen).toLocaleString() : t("admin.userDetail.never")}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.userDetail.created")}</dt>
          <dd className="text-sm text-foreground">{user.CreatedAt ? new Date(user.CreatedAt).toLocaleDateString() : "—"}</dd>
        </div>
      </dl>

      {isSelf && (
        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
          {t("admin.userDetail.selfNote")}
        </p>
      )}

      {!isSelf && (can("users.role.write") || can("users.status.write") || can("users.delete")) && (
        <div className="mt-8 flex flex-wrap items-end gap-3 border-t border-border pt-6">
          {can("users.role.write") && (
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted-foreground">
              {t("admin.userDetail.changeRole")}
              <SelectMenu
                value={user.Role}
                onChange={changeRole}
                options={Array.from(new Set([user.Role, ...assignableRoles(permissions)])).map((r) => ({ value: r, label: t(`admin.role.${r}`) }))}
                disabled={busy}
                className="w-48"
              />
            </label>
          )}

          {can("users.status.write") && (
            user.Status === "blocked" ? (
              <Button variant="outline" disabled={busy} onClick={() => setStatus("active")}>{t("admin.userDetail.unblock")}</Button>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => setStatus("blocked")}>{t("admin.userDetail.block")}</Button>
            )
          )}

          {can("users.delete") && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" disabled={busy}>{t("admin.userDetail.delete")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("admin.userDetail.deleteConfirmTitle")}</DialogTitle>
                  <DialogDescription>{t("admin.userDetail.deleteConfirmBody")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t("admin.userDetail.cancel")}</Button>
                  </DialogClose>
                  <Button variant="destructive" disabled={busy} onClick={remove}>{t("admin.userDetail.delete")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {actionError && <span className="text-sm text-destructive">{t("admin.userDetail.actionError")}</span>}
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="frost-panel frost-in flex justify-center rounded-lg p-8"><Spinner label={t("admin.loading")} /></div>}>
      <Detail />
    </Suspense>
  )
}
