# Admin — Permission-Driven UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive admin-frontend navigation and action gating from the user's actual permission set (fetched from the backend) instead of hardcoded role checks. The backend exposes the held permissions on `/api/auth/me`; the frontend gains a `can(permission)` helper and a generic `RequirePermission` gate, replacing `RequireSuperAdmin`/`RequireManage`/`canManage`/`canManagePlatform`.

**Architecture:** `/api/auth/me` returns `Permissions []string` (from the static `rbac.Permissions(role)` map). `useRole` reads them and exposes `permissions` + `can(required)` implementing the same dotted-prefix `covers` rule as the backend. Every menu item, page gate, and action control is rendered against a concrete permission.

**Tech Stack:** Go 1.26 (gin); Next 16 / React 19 / TypeScript.

## Global Constraints

- Repos & branches (no new branches): `AP Backend@feature/backend-frontend-proxy`, `admin-frontend@feature/base-redesign`.
- Commit footer on every commit: `Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7`
- The frontend `covers` rule must match the backend exactly: a held permission `h` grants required `r` iff `h === "*"` OR `h === r` OR `r` starts with `h + "."`.
- Permission strings used by the UI: `users.read`, `users.role.write`, `users.status.write`, `users.delete`, `notifications.templates.read`, `platform.settings.read`. Super_admin holds `*`.
- Do NOT edit the DS-verbatim `src/lib/auth.ts` — read `Permissions` off the `me` payload through an augmented type in `useRole`.
- All paths relative to repo root `/Users/volodymyrporokhniak/Projects/My/CyberICEBox`.

---

## Task 1: Backend — expose `Permissions` on `/api/auth/me`

**Files:**
- Modify: `AP Backend/internal/delivery/controller/http/handler/auth/handler.go`
- Create: `AP Backend/internal/delivery/controller/http/handler/auth/me_test.go`

**Interfaces:**
- Consumes: `rbac.Permissions(role rbac.Role) []rbac.Permission`, `rbac.Role`; the existing `getSelfProfile` use-case result `*userModel.UserInfo` (fields `ID, FirstName, LastName, Picture, Email, Role`).
- Produces: `GET /api/auth/me` now returns `{ ID, FirstName, LastName, Email, Picture, Role, Permissions: []string }`. A package-local helper `permissionsForRole(role string) []string`.

- [ ] **Step 1: Write the failing helper test**

Create `AP Backend/internal/delivery/controller/http/handler/auth/me_test.go` (package `auth`, so it can see the unexported helper):

```go
package auth

import (
	"testing"

	"github.com/cybericebox/daemon/internal/model/rbac"
)

func TestPermissionsForRole(t *testing.T) {
	contains := func(xs []string, want string) bool {
		for _, x := range xs {
			if x == want {
				return true
			}
		}
		return false
	}

	super := permissionsForRole(string(rbac.RoleSuperAdmin))
	if len(super) != 1 || super[0] != "*" {
		t.Fatalf("super_admin should hold [\"*\"], got %v", super)
	}

	admin := permissionsForRole(string(rbac.RoleAdmin))
	if !contains(admin, "users") || !contains(admin, "notifications.self") {
		t.Fatalf("admin should hold users + notifications.self, got %v", admin)
	}
	if contains(admin, "platform.settings") {
		t.Fatalf("admin must not hold platform.settings, got %v", admin)
	}

	user := permissionsForRole(string(rbac.RoleUser))
	if len(user) != 1 || user[0] != "notifications.self" {
		t.Fatalf("user should hold [notifications.self], got %v", user)
	}

	if permissionsForRole("nonsense") != nil && len(permissionsForRole("nonsense")) != 0 {
		t.Fatalf("unknown role should hold nothing, got %v", permissionsForRole("nonsense"))
	}
}
```

- [ ] **Step 2: Run the test, expect FAIL (helper undefined)**

Run: `cd "AP Backend" && go test ./internal/delivery/controller/http/handler/auth/ -run TestPermissionsForRole`
Expected: FAIL — `undefined: permissionsForRole`.

- [ ] **Step 3: Add the helper + me response DTO, and use them in `getSelfProfile`**

In `AP Backend/internal/delivery/controller/http/handler/auth/handler.go`:

(a) Add the helper (near `getSelfProfile`):

```go
// permissionsForRole returns the held permission strings for a role, for the
// frontend to drive permission-based rendering (mirrors rbac.Permissions).
func permissionsForRole(role string) []string {
	held := rbac.Permissions(rbac.Role(role))
	out := make([]string, 0, len(held))
	for _, p := range held {
		out = append(out, string(p))
	}
	return out
}
```

(b) Add a response DTO (in a `type (...)` block or as a standalone type near the other auth DTOs):

```go
type meResponse struct {
	ID          uuid.UUID `json:"ID"`
	FirstName   string    `json:"FirstName"`
	LastName    string    `json:"LastName"`
	Email       string    `json:"Email"`
	Picture     string    `json:"Picture"`
	Role        string    `json:"Role"`
	Permissions []string  `json:"Permissions"`
}
```

(c) Replace the body of `getSelfProfile`'s success response. The current code ends with:
```go
	p, err := h.useCase.GetSelfProfile(ctx.Request.Context(), userID)
	if err != nil {
		response.AbortWithError(ctx, err)
		return
	}
	response.AbortWithData(ctx, p)
```
Change the final line to build the `meResponse`:
```go
	response.AbortWithData(ctx, meResponse{
		ID:          p.ID,
		FirstName:   p.FirstName,
		LastName:    p.LastName,
		Email:       p.Email,
		Picture:     p.Picture,
		Role:        p.Role,
		Permissions: permissionsForRole(p.Role),
	})
```

(Confirm `uuid` and `rbac` are already imported in `handler.go` — they are, used elsewhere in the file.)

- [ ] **Step 4: Run the test, expect PASS**

Run: `cd "AP Backend" && go test ./internal/delivery/controller/http/handler/auth/ -run TestPermissionsForRole`
Expected: PASS.

- [ ] **Step 5: Build + full suite**

Run: `cd "AP Backend" && go build ./... && go test ./...`
Expected: all `ok`.

- [ ] **Step 6: Commit**

```bash
cd "AP Backend"
git add internal/delivery/controller/http/handler/auth/handler.go internal/delivery/controller/http/handler/auth/me_test.go
git commit -m "feat(auth): expose held Permissions on /api/auth/me

The frontend drives nav + action gating from the user's permission set
(rbac.Permissions(role)) instead of hardcoded role checks.

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 2: Frontend — `can()` + `RequirePermission`, retrofit all gates

**Files:**
- Modify: `admin-frontend/src/lib/useRole.tsx`
- Create: `admin-frontend/src/components/rbac/RequirePermission.tsx`
- Delete: `admin-frontend/src/components/rbac/RequireSuperAdmin.tsx`, `admin-frontend/src/components/rbac/RequireManage.tsx`
- Modify: `admin-frontend/src/components/shell/Sidebar.tsx`
- Modify: `admin-frontend/src/app/users/detail/page.tsx`
- Modify: `admin-frontend/src/app/settings/page.tsx`

**Interfaces:**
- Consumes: the `Permissions` field now on the `/api/auth/me` payload (Task 1).
- Produces: `useRole()` → `{ me, role, isLoading, permissions: string[], can: (req: string) => boolean }` (no more `canManage`/`canManagePlatform`); `RequirePermission` component.

This is one cohesive task — `useRole` drops `canManage`/`canManagePlatform`, so every consumer must change in the same commit to keep the build green.

- [ ] **Step 1: Rewrite `useRole.tsx`**

Replace the entire contents of `admin-frontend/src/lib/useRole.tsx` with:

```tsx
"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { fetchMe, type Me } from "@/lib/auth"
import { runSilentAuthOnce } from "@/lib/silentAuth"

export type Role = "user" | "admin_viewer" | "admin" | "super_admin"

// covers mirrors the backend rbac.covers: a held permission grants a required one
// when held is "*", exactly equal, or a dotted-prefix ancestor of required.
function covers(held: string, required: string): boolean {
  return held === "*" || held === required || required.startsWith(held + ".")
}

export interface RoleState {
  me: Me | null
  role: Role | null
  isLoading: boolean
  permissions: string[]
  can: (required: string) => boolean
}

const RoleContext = createContext<RoleState>({
  me: null,
  role: null,
  isLoading: true,
  permissions: [],
  can: () => false,
})

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    runSilentAuthOnce()
      .then(() => fetchMe())
      .then((m) => { if (!cancelled) setMe(m) })
      .catch(() => { if (!cancelled) setMe(null) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const role = (me?.Role as Role | undefined) ?? null
  // Me (from the DS-verbatim lib/auth.ts) has no Permissions field, but the
  // /api/auth/me payload carries it — read it through an augmented view.
  const permissions = ((me as unknown as { Permissions?: string[] } | null)?.Permissions) ?? []
  const can = useCallback(
    (required: string) => permissions.some((h) => covers(h, required)),
    [permissions],
  )

  return (
    <RoleContext.Provider value={{ me, role, isLoading, permissions, can }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole(): RoleState {
  return useContext(RoleContext)
}
```

- [ ] **Step 2: Create `RequirePermission.tsx`**

Create `admin-frontend/src/components/rbac/RequirePermission.tsx`:

```tsx
"use client"
import { useRole } from "@/lib/useRole"

// Renders children only when the user holds (covers) the required permission.
export function RequirePermission({
  perm,
  children,
  fallback = null,
}: {
  perm: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { can } = useRole()
  return <>{can(perm) ? children : fallback}</>
}
```

- [ ] **Step 3: Delete the old role-specific gate components**

```bash
rm admin-frontend/src/components/rbac/RequireSuperAdmin.tsx admin-frontend/src/components/rbac/RequireManage.tsx
```

- [ ] **Step 4: Retrofit `Sidebar.tsx`**

Replace the entire contents of `admin-frontend/src/components/shell/Sidebar.tsx` with:

```tsx
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Bell, Users } from "lucide-react"
import { Wordmark } from "@/components/brand/Wordmark"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; perm?: string }
type Section = { headingKey?: string; divider?: boolean; items: Item[] }

const SECTIONS: Section[] = [
  { items: [{ href: "/dashboard", label: "admin.nav.dashboard", icon: LayoutDashboard }] },
  {
    headingKey: "admin.nav.section.domains",
    items: [{ href: "/users", label: "admin.nav.users", icon: Users, perm: "users.read" }],
  },
  {
    headingKey: "admin.nav.section.platform",
    divider: true,
    items: [{ href: "/notifications", label: "admin.nav.notifications", icon: Bell, perm: "notifications.templates.read" }],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { can } = useRole()
  // Keep only items the user is permitted to see; drop empty sections.
  const sections = SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((it) => !it.perm || can(it.perm)) }))
    .filter((s) => s.items.length > 0)

  return (
    <aside className="frost-panel sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-1 p-3">
      <div className="mb-4 px-2 pt-2">
        <Wordmark size="md" />
      </div>
      <nav className="flex flex-col gap-1">
        {sections.map((section, si) => (
          <div key={section.headingKey ?? `s-${si}`} className="flex flex-col gap-1">
            {section.divider && <div className="my-2 h-px bg-border" />}
            {section.headingKey && (
              <p className="px-3 pt-1 pb-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t(section.headingKey)}
              </p>
            )}
            {section.items.map((it) => {
              const active = pathname.startsWith(it.href)
              const Icon = it.icon
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={
                    "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors " +
                    (active
                      ? "frost-panel text-foreground before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary before:shadow-[0_0_10px_var(--frost-glow)]"
                      : "text-muted-foreground hover:bg-accent/10")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t(it.label)}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 5: Retrofit `users/detail/page.tsx`**

In `admin-frontend/src/app/users/detail/page.tsx`, make these exact changes:

(a) Change the `assignableRoles` signature from role-based to permission-based:
```tsx
// Roles assignable by the current caller (only a holder of "*" — super_admin — can grant super_admin).
function assignableRoles(permissions: string[]): string[] {
  return permissions.includes("*")
    ? ["super_admin", "admin", "admin_viewer", "user"]
    : ["admin", "admin_viewer", "user"]
}
```

(b) Change the hook destructure:
```tsx
  const { can, permissions } = useRole()
```
(replacing `const { canManage, canManagePlatform } = useRole()`).

(c) Replace the entire actions block. Replace the block that currently starts with `{canManage && (` and ends with its matching `)}` (the `<div className="mt-8 flex flex-wrap ...">` container) with:

```tsx
      {(can("users.role.write") || can("users.status.write") || can("users.delete")) && (
        <div className="mt-8 flex flex-wrap items-end gap-3 border-t border-border pt-6">
          {can("users.role.write") && (
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted-foreground">
              {t("admin.userDetail.changeRole")}
              <select
                value={user.Role}
                disabled={busy}
                onChange={(e) => changeRole(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* Always show the current role even if not normally assignable by this caller. */}
                {Array.from(new Set([user.Role, ...assignableRoles(permissions)])).map((r) => (
                  <option key={r} value={r}>{t(`admin.role.${r}`)}</option>
                ))}
              </select>
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
```

- [ ] **Step 6: Retrofit `settings/page.tsx`**

Replace the entire contents of `admin-frontend/src/app/settings/page.tsx` with:

```tsx
"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { t } from "@/i18n/t"

export default function Page() {
  return (
    <RequirePermission
      perm="platform.settings.read"
      fallback={
        <div className="frost-panel rounded-lg p-8 text-center text-muted-foreground">{t("admin.noAccess.title")}</div>
      }
    >
      <div className="frost-panel frost-in rounded-lg p-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">{t("admin.nav.settings")}</p>
        <p className="mt-2 text-muted-foreground">{t("admin.comingSoon")}</p>
      </div>
    </RequirePermission>
  )
}
```

- [ ] **Step 7: Verify no stale references remain**

Run: `cd admin-frontend && grep -rn "canManage\|canManagePlatform\|RequireSuperAdmin\|RequireManage" src/`
Expected: NO matches (all migrated/deleted).

- [ ] **Step 8: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0; all routes build.

- [ ] **Step 9: Commit**

```bash
cd admin-frontend
git add src/lib/useRole.tsx src/components/rbac/ src/components/shell/Sidebar.tsx src/app/users/detail/page.tsx src/app/settings/page.tsx
git commit -m "feat(admin): permission-driven nav + action gating (can/RequirePermission)

useRole exposes permissions + can() (mirrors backend covers); sidebar items,
page gates, and user-detail actions render against concrete permissions.
Removes RequireSuperAdmin/RequireManage/canManage/canManagePlatform.

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Self-Review

**Spec coverage:**
- Backend exposes the held permission set on `/api/auth/me` → Task 1.
- Frontend `can(permission)` mirrors the backend `covers` rule → Task 2 Step 1.
- Menu items rendered per-permission (Users → `users.read`, Notifications → `notifications.templates.read`; Dashboard ungated for any admin-tier) → Task 2 Step 4.
- Page gate generic `RequirePermission` replaces `RequireSuperAdmin` → Task 2 Steps 2/6 (and the C-2 notifications page consumes it).
- Action controls gated by concrete permissions (`users.role.write` / `users.status.write` / `users.delete`) → Task 2 Step 5 ("full transition").
- `RequireSuperAdmin`/`RequireManage`/`canManage`/`canManagePlatform` removed → Task 2 Steps 3/7 (grep gate).

**Placeholder scan:** No TBD/TODO. Every edit shows exact code or an exact `rm`/`grep` command. The users/detail edit (Step 5c) names the exact block boundaries to replace.

**Type consistency:** `useRole` returns `permissions: string[]` + `can: (string) => boolean`; consumers (Sidebar `can`, users/detail `can`+`permissions`, `RequirePermission` `can`, settings `RequirePermission`) all match. `assignableRoles(permissions: string[])` signature matches its single call site. Permission strings are consistent with the backend RBAC constants (`users.read`, `users.role.write`, `users.status.write`, `users.delete`, `notifications.templates.read`, `platform.settings.read`, `*`).
