"use client"
import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { apiGet, apiPatch, apiDelete } from "@/api/client"
import { t } from "@/i18n/t"
import { overloadOr } from "@/i18n/apiError"
import { useRole, type Role } from "@/lib/useRole"
import { assignableRoles } from "@/lib/assignableRoles"
import { roleLabel } from "@/lib/roles"
import { RoleBadge, StatusBadge } from "@/components/users/RoleStatusBadge"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { LoadingArea } from "@/components/ui/spinner"
import { NotFoundBlock } from "@/components/ErrorPage"
import { LoadError } from "@/components/ui/load-error"
import { PageHeader } from "@/components/ui/page-header"
import { formatListDate, formatListDateTime } from "@/lib/locale"
import { isUnsetDate } from "@/lib/dates"
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

type Pending = { kind: "role"; role: string } | { kind: "block" }

// Higher rank = more rights; a change up is a grant (primary button), a change down takes rights away (danger).
const ROLE_RANK: Record<string, number> = { user: 0, admin_viewer: 1, admin: 2, super_admin: 3 }

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

  // Unblocking is instant and optimistic; saves run one after another and never disable a control.
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  function save(patch: Partial<Pick<UserDetail, "Role" | "Status">>, path: "role" | "status", body: Record<string, string>, successKey: string) {
    setUser((current) => (current ? { ...current, ...patch } : current))
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await apiPatch(`/api/users/${id}/${path}`, body)
        toast.success(t(successKey))
      } catch (err) {
        toast.error(overloadOr(err, t("admin.userDetail.actionError")))
        // Roll back by re-reading the user silently: no loader, the page keeps its content.
        try { setUser(await apiGet<UserDetail>(`/api/users/${id}`)) } catch { /* keep the shown value */ }
      }
    })
  }
  const setStatus = (status: string) => save({ Status: status }, "status", { Status: status }, "admin.userDetail.statusChanged")

  // A role change and a block change rights, so they wait for a ConfirmDialog and apply only after the server agrees.
  const [pending, setPending] = useState<Pending | null>(null)
  const [pendingBusy, setPendingBusy] = useState(false)
  const [pendingError, setPendingError] = useState<string | null>(null)
  function ask(next: Pending) { setPendingError(null); setPending(next) }
  function closePending() { if (!pendingBusy) { setPending(null); setPendingError(null) } }
  async function applyPending() {
    if (!pending) return
    setPendingBusy(true)
    setPendingError(null)
    try {
      if (pending.kind === "role") {
        await apiPatch(`/api/users/${id}/role`, { Role: pending.role })
        setUser((current) => (current ? { ...current, Role: pending.role } : current))
        toast.success(t("admin.userDetail.roleChanged"))
      } else {
        await apiPatch(`/api/users/${id}/status`, { Status: "blocked" })
        setUser((current) => (current ? { ...current, Status: "blocked" } : current))
        toast.success(t("admin.userDetail.statusChanged"))
      }
      setPending(null)
    } catch (err) {
      setPendingError(overloadOr(err, t("admin.userDetail.actionError")))
    } finally {
      setPendingBusy(false)
    }
  }
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
    return <LoadingArea className="h-full" label={t("admin.loading")} />
  }
  if (loadError) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t("admin.nav.users")} crumbs={[usersCrumb()]} />
        <LoadError message={t("admin.userDetail.loadError")} error={loadError.cause} className="flex-1" onRetry={() => { setLoading(true); setLoadError(null); setReloadKey((k) => k + 1) }} />
      </div>
    )
  }
  if (notFound || !user) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t("admin.nav.users")} crumbs={[usersCrumb()]} />
        <NotFoundBlock title={t("admin.userDetail.notFound")} />
      </div>
    )
  }

  // UI-only self-guard; the backend independently enforces this boundary.
  const isSelf = !!me && me.ID === user.ID
  const protectedSuperAdmin = user.Role === "super_admin" && !permissions.includes("*")
  const name = fullName(user)
  const canRole = can("users.role.write")
  const canStatus = can("users.status.write") && (user.Status === "active" || user.Status === "blocked")
  const canDelete = can("users.delete")
  const raising = pending?.kind === "role" && (ROLE_RANK[pending.role] ?? 0) > (ROLE_RANK[user.Role] ?? 0)
  const pendingRole = pending?.kind === "role" ? roleLabel(pending.role) : ""

  return (
    <div className="space-y-6">
      <PageHeader title={name} crumbs={[usersCrumb(), { label: name }]} sub={user.Email}
        actions={<><RoleBadge role={user.Role} /><StatusBadge status={user.Status} /></>} />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <Field label={t("admin.userDetail.signInMethods")}>
          {user.SignInMethods.length ? user.SignInMethods.map((m) => t(`admin.method.${m}`)).join(", ") : "—"}
        </Field>
        <Field label={t("admin.userDetail.emailConfirmed")}>{user.EmailConfirmed ? t("admin.userDetail.yes") : t("admin.userDetail.no")}</Field>
        <Field label={t("admin.userDetail.lastSeen")}>
          {!isUnsetDate(user.LastSeen) ? <time dateTime={user.LastSeen}>{formatListDateTime(user.LastSeen)}</time> : t("admin.userDetail.never")}
        </Field>
        <Field label={t("admin.userDetail.created")}>{user.CreatedAt ? <time dateTime={user.CreatedAt}>{formatListDate(user.CreatedAt)}</time> : "—"}</Field>
      </dl>

      {isSelf && <p className="border-t border-border pt-6 text-sm text-muted-foreground">{t("admin.userDetail.selfNote")}</p>}

      {protectedSuperAdmin && <p className="border-t border-border pt-6 text-sm text-muted-foreground">{t("admin.userDetail.protectedSuperAdmin")}</p>}

      {!isSelf && !protectedSuperAdmin && (canRole || canStatus || canDelete) && (
        // Access controls on the left; the destructive delete stands apart on the right (below them on a phone).
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-border pt-6">
          {(canRole || canStatus) && <div className="flex flex-wrap items-end gap-3">
            {canRole && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">{t("admin.userDetail.changeRole")}</span>
                <SelectMenu
                  value={user.Role}
                  onChange={(role) => { if (role !== user.Role) ask({ kind: "role", role }) }}
                  options={Array.from(new Set([user.Role, ...assignableRoles(can, callerRole, user.Role as Role)])).map((r) => ({ value: r, label: roleLabel(r) }))}
                  ariaLabel={t("admin.userDetail.changeRole")}
                  className="w-48"
                />
              </div>
            )}
            {canStatus && (
              user.Status === "blocked" ? (
                <Button variant="outline" onClick={() => setStatus("active")}>{t("admin.userDetail.unblock")}</Button>
              ) : (
                <Button variant="outline" onClick={() => ask({ kind: "block" })}>{t("admin.userDetail.block")}</Button>
              )
            )}
          </div>}

          {canDelete && (
            <Button variant="destructive" onClick={() => { setDeleteError(false); setDeleting(true) }}>{t("admin.userDetail.delete")}</Button>
          )}
        </div>
      )}

      <ConfirmDialog open={deleting} onCancel={() => setDeleting(false)} tone="danger" busy={deleteBusy} busyLabel={t("busy.deleting")}
        title={t("admin.userDetail.deleteConfirmTitle", { name })} description={t("admin.userDetail.deleteConfirmBody")}
        cancelLabel={t("admin.userDetail.cancel")} confirmLabel={t("admin.userDetail.deleteConfirm")}
        error={deleteError ? t("admin.userDetail.actionError") : null} onConfirm={() => void remove()} />

      <ConfirmDialog open={pending !== null} onCancel={closePending} busy={pendingBusy}
        tone={pending?.kind === "role" && raising ? "default" : "danger"}
        busyLabel={t(pending?.kind === "block" ? "busy.blocking" : "busy.changingRole")}
        title={pending?.kind === "block" ? t("admin.userDetail.blockConfirm.title", { name })
          : t(raising ? "admin.userDetail.roleConfirm.raiseTitle" : "admin.userDetail.roleConfirm.lowerTitle", { name, role: pendingRole })}
        description={pending?.kind === "block" ? t("admin.userDetail.blockConfirm.body")
          : t(raising ? "admin.userDetail.roleConfirm.raiseBody" : "admin.userDetail.roleConfirm.lowerBody", { role: pendingRole, current: roleLabel(user.Role) })}
        cancelLabel={t("admin.userDetail.cancel")}
        confirmLabel={t(pending?.kind === "block" ? "admin.userDetail.block" : "admin.userDetail.roleConfirm.confirm")}
        error={pendingError} onConfirm={() => void applyPending()} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd></div>
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}>
      <Detail />
    </Suspense>
  )
}
