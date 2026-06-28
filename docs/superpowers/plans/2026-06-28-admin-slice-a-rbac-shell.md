# Admin Slice A — RBAC Realign + DS Refresh + Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the foundation of the admin domain — realign backend RBAC so notification/platform management is super_admin-only, refresh admin-frontend onto the current design system, and rebuild the sidebar into role-gated grouped sections.

**Architecture:** Two repos, two independent deliverables joined by one slice. Backend (`AP Backend`) changes the static role→permission map and the tests that encode the old policy. Frontend (`admin-frontend`) replaces drifted DS base components + theme tokens, then rewrites `Sidebar` to model sections/divider/role-gating.

**Tech Stack:** Go 1.26 (gin, gomock, testify); Next 16 / React 19 / Tailwind v4 (Indigo Frost DS), TypeScript.

## Global Constraints

- Design system is mandatory: all admin UI builds only on `design-system/` base components + Indigo Frost tokens. No bespoke colors or off-DS component variants. Source of truth: `design-system/src/components/ui` + `design-system/src/globals.css`.
- Repos are separate git repos with their own branches; commit in each repo's working dir. Backend: `AP Backend@feature/backend-frontend-proxy`. Frontend: `admin-frontend@feature/base-redesign`. No new branches (user decision).
- RBAC target sets (verbatim):
  - `super_admin: { * }`
  - `admin: { users, notifications.self }`
  - `admin_viewer: { users.read, notifications.self }`
  - `user: { notifications.self }`
  - `events.*` / `exercises.*` permission constants are NOT introduced in this slice.
- i18n: `messages/en.json` is the canonical key set (drives the TS `MessageKey` type); `messages/uk.json` is the active UI language. Every new key goes in BOTH files.
- All paths below are relative to the repo root `/Users/volodymyrporokhniak/Projects/My/CyberICEBox`.

---

## File Structure

**Backend (`AP Backend`):**
- `internal/model/rbac/permission.go` — the `rolePermissions` map (only change).
- `internal/model/rbac/permission_test.go` — flip the admin/viewer notification + platform expectations.
- `internal/useCase/platformSettings/setting_test.go` — 3 tests encode "admin/viewer can read permissioned settings"; update to the super_admin-only policy.

**Frontend (`admin-frontend`):**
- `src/app/globals.css` — replace with DS globals (Indigo Frost), minus the DS-only `@source` lines.
- `src/components/ui/{alert,button,card,input}.tsx` — overwrite from DS.
- `src/components/ui/checkbox.tsx` — new, from DS.
- `src/components/brand/{Wordmark,Logo}.tsx` — Wordmark overwrite + Logo new, from DS.
- `src/components/shell/Sidebar.tsx` — rewrite into grouped, role-gated sections.
- `messages/en.json`, `messages/uk.json` — add two section-heading keys.

---

## Task 1: Backend RBAC realign (+ dependent tests)

**Files:**
- Modify: `AP Backend/internal/model/rbac/permission_test.go`
- Modify: `AP Backend/internal/useCase/platformSettings/setting_test.go`
- Modify: `AP Backend/internal/model/rbac/permission.go`

**Interfaces:**
- Consumes: existing `rbac` API — `HasPermission(role, required) bool`, `CanAssignRole(caller, target) bool`, role constants `RoleSuperAdmin/RoleAdmin/RoleAdminViewer/RoleUser/RolePublic`, permission constants `PermAll/PermUsers/PermUsersRead/PermNotificationsSelf/PermPlatformSettingsRead/...`.
- Produces: a `rolePermissions` map where `admin`/`admin_viewer` no longer hold `platform.settings.*` or notification-management perms. Downstream middleware/use-cases that call `HasPermission` automatically enforce the new policy; no signature changes.

- [ ] **Step 1: Update `permission_test.go` expectations to the new policy**

In `AP Backend/internal/model/rbac/permission_test.go`, inside `TestHasPermission`'s `cases` slice, change exactly these rows' `want` from `true` to `false` (keep every other row unchanged):

```go
{RoleAdmin, "platform.settings.write", false},        // admin loses platform settings
{RoleAdminViewer, "platform.settings.read", false},   // viewer loses platform settings
{RoleAdmin, "notifications.templates.write", false},  // notification mgmt is super_admin-only
{RoleAdmin, "notifications.settings.write", false},
{RoleAdmin, "notifications.test", false},
{RoleAdminViewer, "notifications.templates.read", false},
{RoleAdminViewer, "notifications.settings.read", false},
```

Leave these `true` (own-inbox capability is retained by every role):

```go
{RoleAdmin, "notifications.self", true},
{RoleAdminViewer, "notifications.self", true},
{RoleUser, "notifications.self", true},
```

`TestCanAssignRole` and `TestCovers` need NO changes — recompute confirms every existing `CanAssignRole` expectation still holds under the new sets.

- [ ] **Step 2: Update `setting_test.go` to the super_admin-only policy**

In `AP Backend/internal/useCase/platformSettings/setting_test.go`:

Replace `TestGet_PermissionedSettingAllowedByAdmin` (the `RoleAdmin` reads a permissioned setting test) so the privileged reader is `super_admin`:

```go
// TestGet_PermissionedSettingAllowedBySuperAdmin verifies that a setting requiring
// "platform.settings.read" is returned to super_admin (held via "*").
func TestGet_PermissionedSettingAllowedBySuperAdmin(t *testing.T) {
	ctrl, repo, _, uc := setup(t)
	defer ctrl.Finish()
	ctx := rbac.ContextWithRole(context.Background(), rbac.RoleSuperAdmin)
	repo.EXPECT().
		GetPlatformSettingByKey(gomock.Any(), "secret").
		Return(sampleRow("secret", string(rbac.PermPlatformSettingsRead)), nil)

	got, err := uc.GetSetting(ctx, "secret")
	require.NoError(t, err)
	assert.Equal(t, "secret", got.Key)
}
```

Replace `TestGet_PermissionedSettingAllowedByAdminViewer` with a denial test for `admin` (admin no longer holds platform.settings):

```go
// TestGet_PermissionedSettingDeniedForAdmin verifies that under the super_admin-only
// platform-settings policy a permissioned setting is hidden from a regular admin.
func TestGet_PermissionedSettingDeniedForAdmin(t *testing.T) {
	ctrl, repo, _, uc := setup(t)
	defer ctrl.Finish()
	ctx := rbac.ContextWithRole(context.Background(), rbac.RoleAdmin)
	repo.EXPECT().
		GetPlatformSettingByKey(gomock.Any(), "secret").
		Return(sampleRow("secret", string(rbac.PermPlatformSettingsRead)), nil)

	_, err := uc.GetSetting(ctx, "secret")
	require.Error(t, err)
	assert.True(t, platformSettingsModel.ErrSettingNotFound.Err().Is(err))
}
```

Replace `TestList_ReturnsAllForAdmin` so the all-seeing role is `super_admin`:

```go
// TestList_ReturnsAllForSuperAdmin verifies that super_admin sees both public and
// permissioned settings.
func TestList_ReturnsAllForSuperAdmin(t *testing.T) {
	ctrl, repo, _, uc := setup(t)
	defer ctrl.Finish()
	ctx := rbac.ContextWithRole(context.Background(), rbac.RoleSuperAdmin)
	repo.EXPECT().ListPlatformSettings(gomock.Any()).Return([]postgres.AppSetting{
		sampleRow("public-key", ""),
		sampleRow("admin-key", string(rbac.PermPlatformSettingsRead)),
	}, nil)

	got, err := uc.ListSettings(ctx)
	require.NoError(t, err)
	assert.Len(t, got, 2)
}
```

- [ ] **Step 3: Run the affected tests to verify they FAIL against the old map**

Run: `cd "AP Backend" && go test ./internal/model/rbac/... ./internal/useCase/platformSettings/...`
Expected: FAIL — e.g. `HasPermission("admin","platform.settings.write")=true want false` and the platformSettings get/list assertions, because `rolePermissions` still grants the old perms.

- [ ] **Step 4: Realign the `rolePermissions` map**

In `AP Backend/internal/model/rbac/permission.go`, replace the `rolePermissions` map literal with:

```go
var rolePermissions = map[Role][]Permission{
	RoleSuperAdmin:  {PermAll},
	RoleAdmin:       {PermUsers, PermNotificationsSelf},
	RoleAdminViewer: {PermUsersRead, PermNotificationsSelf},
	RoleUser:        {PermNotificationsSelf},
}
```

Also update the map's doc comment above it to: `// rolePermissions is the static role → held-permission map. admin/viewer manage`
`// users (+ own inbox); platform settings and notification management are`
`// super_admin-only (reachable only via "*").`

- [ ] **Step 5: Run the affected tests to verify they PASS**

Run: `cd "AP Backend" && go test ./internal/model/rbac/... ./internal/useCase/platformSettings/...`
Expected: PASS (ok for both packages).

- [ ] **Step 6: Run the full backend suite (catch any other dependency)**

Run: `cd "AP Backend" && go build ./... && go test ./...`
Expected: all packages `ok`. (Analysis found only the two packages above encode the old admin/viewer platform perms; `protection_test.go` checks `users.read` which admin still holds, and `proxy_test.go` uses the coarse `IsAdminTier` gate — both unaffected.) If any other test fails, it is asserting the old policy: update its expectation to match the new sets, mirroring Step 1/2.

- [ ] **Step 7: Commit**

```bash
cd "AP Backend"
git add internal/model/rbac/permission.go internal/model/rbac/permission_test.go internal/useCase/platformSettings/setting_test.go
git commit -m "feat(rbac): restrict platform + notification management to super_admin

admin/viewer keep users (+ own inbox); platform.settings and notification
management (templates/global settings/test) are now super_admin-only.

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 2: Frontend DS refresh (theme + base ui + brand)

**Files:**
- Modify: `admin-frontend/src/app/globals.css`
- Modify: `admin-frontend/src/components/ui/alert.tsx`, `button.tsx`, `card.tsx`, `input.tsx`
- Create: `admin-frontend/src/components/ui/checkbox.tsx`
- Modify: `admin-frontend/src/components/brand/Wordmark.tsx`
- Create: `admin-frontend/src/components/brand/Logo.tsx`

**Interfaces:**
- Consumes: DS sources under `design-system/src/components/{ui,brand}` and `design-system/src/globals.css`. DS components import via `@/utils/cn` and `class-variance-authority` / `@radix-ui/react-slot` — all already in `admin-frontend/package.json`; DS `checkbox.tsx` is custom (only React + cn), so NO new dependency is needed.
- Produces: admin-frontend rendering on Indigo Frost light tokens (`--background:#E8F3FC`, `--primary:#1E2A6B`, `--accent-warm:#0091EA`) with the `--color-accent-warm` theme mapping available, and DS-current `alert/button/card/input/checkbox` + the DS brand lockup (`Wordmark` importing `Logo`).

- [ ] **Step 1: Replace the theme stylesheet with DS globals**

From the repo root, overwrite admin globals with the DS source:

```bash
cp design-system/src/globals.css admin-frontend/src/app/globals.css
```

Then delete the DS-only trailing content-source directives (the last two non-blank lines of the file) so they don't point at non-existent admin dirs:

```
/* design-sync: explicit content sources for standalone Tailwind v4 compile */
@source "./components";
@source "./stubs";
```

Remove those three lines (the comment + both `@source` lines) from `admin-frontend/src/app/globals.css`. Leave the rest of the file verbatim.

- [ ] **Step 2: Overwrite the drifted base ui components + add checkbox**

From the repo root:

```bash
cp design-system/src/components/ui/alert.tsx    admin-frontend/src/components/ui/alert.tsx
cp design-system/src/components/ui/button.tsx   admin-frontend/src/components/ui/button.tsx
cp design-system/src/components/ui/card.tsx     admin-frontend/src/components/ui/card.tsx
cp design-system/src/components/ui/input.tsx    admin-frontend/src/components/ui/input.tsx
cp design-system/src/components/ui/checkbox.tsx admin-frontend/src/components/ui/checkbox.tsx
```

- [ ] **Step 3: Refresh the brand lockup**

From the repo root:

```bash
cp design-system/src/components/brand/Wordmark.tsx admin-frontend/src/components/brand/Wordmark.tsx
cp design-system/src/components/brand/Logo.tsx     admin-frontend/src/components/brand/Logo.tsx
```

(`IceMark.tsx` is left in place but becomes unused — the DS `Wordmark` imports `Logo`. Leave it; no other file imports it.)

- [ ] **Step 4: Typecheck**

Run: `cd admin-frontend && npx tsc --noEmit`
Expected: no output (exit 0). If `tsc` reports an unresolved import for a brand/ui file, confirm the `cp` in Steps 2–3 completed.

- [ ] **Step 5: Production build (integration check)**

Run: `cd admin-frontend && npm run build`
Expected: `✓ Compiled successfully` and the static export completes without errors.

- [ ] **Step 6: Commit**

```bash
cd admin-frontend
git add src/app/globals.css src/components/ui/alert.tsx src/components/ui/button.tsx src/components/ui/card.tsx src/components/ui/input.tsx src/components/ui/checkbox.tsx src/components/brand/Wordmark.tsx src/components/brand/Logo.tsx
git commit -m "refactor(ds): adopt Indigo Frost theme + refresh base ui/brand from design-system

Replaces drifted dark theme with DS light tokens (accent-warm), refreshes
alert/button/card/input, adds checkbox, and the DS brand lockup (Logo).

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 3: Frontend shell — grouped, role-gated sidebar

**Files:**
- Modify: `admin-frontend/src/components/shell/Sidebar.tsx`
- Modify: `admin-frontend/messages/en.json`
- Modify: `admin-frontend/messages/uk.json`

**Interfaces:**
- Consumes: `useRole()` → `{ canManagePlatform }` (super_admin); `Wordmark` (refreshed in Task 2); `t(key)` i18n; existing nav keys `admin.nav.dashboard|users|notifications`.
- Produces: a sidebar that renders Dashboard (all admin-tier), a "Domains" section with Users, a divider, and a super_admin-only "Platform" section with Notifications. Events/Exercises/Labs are no longer linked (deferred to later slices). This is the navigation surface later slices (B users page, C notifications tabs) hang their routes on.

- [ ] **Step 1: Add the two section-heading keys to `messages/en.json`**

Add these entries to `admin-frontend/messages/en.json` (next to the other `admin.nav.*` keys):

```json
"admin.nav.section.domains": "Domains",
"admin.nav.section.platform": "Platform",
```

- [ ] **Step 2: Add the same keys to `messages/uk.json`**

Add to `admin-frontend/messages/uk.json` (next to the other `admin.nav.*` keys):

```json
"admin.nav.section.domains": "Домени",
"admin.nav.section.platform": "Платформа",
```

- [ ] **Step 3: Rewrite `Sidebar.tsx` as grouped sections**

Replace the entire contents of `admin-frontend/src/components/shell/Sidebar.tsx` with:

```tsx
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Bell, Users } from "lucide-react"
import { Wordmark } from "@/components/brand/Wordmark"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }
type Section = { headingKey?: string; superOnly?: boolean; divider?: boolean; items: Item[] }

const SECTIONS: Section[] = [
  { items: [{ href: "/dashboard", label: "admin.nav.dashboard", icon: LayoutDashboard }] },
  {
    headingKey: "admin.nav.section.domains",
    items: [{ href: "/users", label: "admin.nav.users", icon: Users }],
  },
  {
    headingKey: "admin.nav.section.platform",
    superOnly: true,
    divider: true,
    items: [{ href: "/notifications", label: "admin.nav.notifications", icon: Bell }],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { canManagePlatform } = useRole()
  const sections = SECTIONS.filter((s) => !s.superOnly || canManagePlatform)

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

- [ ] **Step 4: Typecheck**

Run: `cd admin-frontend && npx tsc --noEmit`
Expected: no output (exit 0). The new keys must exist in `en.json` or `t()`'s `MessageKey` type would reject them.

- [ ] **Step 5: Production build**

Run: `cd admin-frontend && npm run build`
Expected: `✓ Compiled successfully`, static export completes.

- [ ] **Step 6: Commit**

```bash
cd admin-frontend
git add src/components/shell/Sidebar.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): grouped role-gated sidebar (Domains / super-only Platform)

Dashboard for all admin-tier; Domains section (Users); divider; Platform
section (Notifications) gated to super_admin. Events/Exercises/Labs unlinked
until their slices.

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Self-Review

**Spec coverage (slice A scope):**
- RBAC realign (spec §"RBAC realignment") → Task 1, incl. the dependent platformSettings tests the spec's policy change implies.
- DS mandate + drift fix (spec §"Design system", §"Navigation/IA" first bullet) → Task 2 (theme tokens incl. accent-warm, refreshed alert/button/card/input, new checkbox, DS brand).
- Grouped role-gated sidebar with divider + super-only Platform section; events/exercises hidden (spec §"Navigation / IA") → Task 3.
- Notification sub-tabs (Statistics/Logs/Global/Templates) and pages are slice C, not slice A — intentionally absent here; Sidebar links Notifications to `/notifications` only.

**Placeholder scan:** No TBD/TODO; every code/edit step shows exact content or exact `cp`/command. Verification steps state exact commands + expected output.

**Type consistency:** `rolePermissions` sets in Task 1 Step 4 match the constants asserted in Step 1. Sidebar `Section`/`Item` types are self-contained; `canManagePlatform` matches `useRole`'s `RoleState`. New i18n keys are added to `en.json` (the `MessageKey` source) before use in `Sidebar.tsx`.
