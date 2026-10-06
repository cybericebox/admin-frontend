"use client"
import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { apiGet, apiPatch, apiDelete } from "@/api/client"
import { t } from "@/i18n/t"
import { useRole, type Role } from "@/lib/useRole"
import { assignableRoles } from "@/lib/assignableRoles"
import { roleLabel } from "@/lib/roles"
import { RoleBadge, StatusBadge } from "@/components/users/RoleStatusBadge"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { LoadingArea } from "@/components/ui/spinner"
import { NotFoundScreen } from "@/components/NotFoundScreen"
import { LoadError } from "@/components/ui/load-error"
import { PageHeader } from "@/components/ui/page-header"
import { formatListDate, formatListDateTime } from "@/lib/locale"
import { toast } from "@/components/ui/toast"

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

function fullName(u: UserDetail): string {
  const n = `${u.FirstName ?? ""} ${u.LastName ?? ""}`.trim()
  return n || u.Email
}

const usersCrumb = () => ({ label: t("admin.nav.users"), href: "/users" })

function isNotFound(error: unknown): boolean {
  return !!error && typeof error === "object" && "status" in error && error.status === 404
}

function Detail() {
  const params = useSearchParams()
  const id = params.get("id") ?? ""
  const router = useRouter()
  const { can, permissions, me, role: callerRole } = useRole()

  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<{ cause: unknown } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    apiGet<UserDetail>(`/api/users/${id}`)
      .then((data) => { if (active) setUser(data) })
      .catch((error) => { if (active) { setNotFound(isNotFound(error)); setLoadError(isNotFound(error) ? null : { cause: error }) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, reloadKey])

  // Role and status saves run one after another; the controls react at once and never wait or disable.
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  function save(patch: Partial<Pick<UserDetail, "Role" | "Status">>, path: "role" | "status", body: Record<string, string>, successKey: string) {
    setUser((current) => (current ? { ...current, ...patch } : current))
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await apiPatch(`/api/users/${id}/${path}`, body)
        toast.success(t(successKey))
      } catch {
        toast.error(t("admin.userDetail.actionError"))
        // Roll back by re-reading the user silently: no loader, the page keeps its content.
        try { setUser(await apiGet<UserDetail>(`/api/users/${id}`)) } catch { /* keep the shown value */ }
      }
    })
  }
  const changeRole = (role: string) => save({ Role: role }, "role", { Role: role }, "admin.userDetail.roleChanged")
  const setStatus = (status: string) => save({ Status: status }, "status", { Status: status }, "admin.userDetail.statusChanged")
  async function remove() {
    setDeleteBusy(true)
    setDeleteError(false)
    try {
      await apiDelete(`/api/users/${id}`)
      toast.success(t("admin.userDetail.deleted"))
      router.push("/users")
    } catch { setDeleteError(true); setDeleteBusy(false) }
  }

  if (loading && id) {
    return <LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />
  }
  if (loadError) {
    return (
      <div className="frost-panel frost-in rounded-lg p-8">
        <PageHeader title={t("admin.nav.users")} crumbs={[usersCrumb()]} />
        <LoadError message={t("admin.userDetail.loadError")} error={loadError.cause} onRetry={() => { setLoading(true); setLoadError(null); setReloadKey((k) => k + 1) }} />
      </div>
    )
  }
  if (notFound || !user) {
    return (
      <div className="frost-panel frost-in flex h-full flex-col rounded-lg p-8">
        <PageHeader title={t("admin.nav.users")} crumbs={[usersCrumb()]} />
        <NotFoundScreen block title={t("admin.userDetail.notFound")} />
      </div>
    )
  }

  // UI-only self-guard; the backend independently enforces this boundary.
  const isSelf = !!me && me.ID === user.ID
  const protectedSuperAdmin = user.Role === "super_admin" && !permissions.includes("*")

  return (
    <div className="frost-panel frost-in rounded-lg p-6">
      <PageHeader title={fullName(user)} crumbs={[usersCrumb(), { label: fullName(user) }]} sub={user.Email}
        actions={<><RoleBadge role={user.Role} /><StatusBadge status={user.Status} /></>} />

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
            {user.LastSeen && !user.LastSeen.startsWith("0001") ? <time dateTime={user.LastSeen}>{formatListDateTime(user.LastSeen)}</time> : t("admin.userDetail.never")}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.userDetail.created")}</dt>
          <dd className="text-sm text-foreground">{user.CreatedAt ? <time dateTime={user.CreatedAt}>{formatListDate(user.CreatedAt)}</time> : "—"}</dd>
        </div>
      </dl>

      {isSelf && (
        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
          {t("admin.userDetail.selfNote")}
        </p>
      )}

      {protectedSuperAdmin && <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">{t("admin.userDetail.protectedSuperAdmin")}</p>}

      {!isSelf && !protectedSuperAdmin && (can("users.role.write") || can("users.status.write") || can("users.delete")) && (
        <div className="mt-8 flex flex-wrap items-end gap-3 border-t border-border pt-6">
          {can("users.role.write") && (
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted-foreground">
              {t("admin.userDetail.changeRole")}
              <SelectMenu
                value={user.Role}
                onChange={changeRole}
                options={Array.from(new Set([user.Role, ...assignableRoles(can, callerRole, user.Role as Role)])).map((r) => ({ value: r, label: roleLabel(r) }))}
                className="w-48"
              />
            </label>
          )}

          {can("users.status.write") && (user.Status === "active" || user.Status === "blocked") && (
            user.Status === "blocked" ? (
              <Button variant="outline" onClick={() => setStatus("active")}>{t("admin.userDetail.unblock")}</Button>
            ) : (
              <Button variant="outline" onClick={() => setStatus("blocked")}>{t("admin.userDetail.block")}</Button>
            )
          )}

          {can("users.delete") && (
            <>
              <Button variant="destructive" onClick={() => { setDeleteError(false); setDeleting(true) }}>{t("admin.userDetail.delete")}</Button>
              <ConfirmDialog open={deleting} onCancel={() => setDeleting(false)} tone="danger" busy={deleteBusy}
                title={t("admin.userDetail.deleteConfirmTitle")} description={t("admin.userDetail.deleteConfirmBody")}
                cancelLabel={t("admin.userDetail.cancel")} confirmLabel={t("admin.userDetail.delete")}
                error={deleteError ? t("admin.userDetail.actionError") : null} onConfirm={() => void remove()} />
            </>
          )}

        </div>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />}>
      <Detail />
    </Suspense>
  )
}
