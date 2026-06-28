# Admin Slice B — Dashboard + Users — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin app talk to AP Backend (aligned data layer + SSO bootstrap), then ship the Dashboard and full Users management (list + detail + role/status/delete), backed by one new endpoint `GET /api/users/:id`.

**Architecture:** Two repos. `admin-frontend` first adopts id-frontend's aligned `api/client.ts` (unwraps the `{Status, Data}` envelope, centralizes 401) plus the one-shot silent-SSO bootstrap, then builds pages on it. `AP Backend` gains a user-detail read endpoint and surfaces `Status` on the list. All UI is built only on the design-system components from Slice A.

**Tech Stack:** Go 1.26 (gin/gomock/testify, sqlc — but NO sql changes here); Next 16 / React 19 / Tailwind v4 (Indigo Frost DS), TypeScript.

## Global Constraints

- All admin UI builds only on `design-system/` base components + Indigo Frost tokens (already in the repo from Slice A). No bespoke colors.
- Repos & branches (no new branches): `AP Backend@feature/backend-frontend-proxy`, `admin-frontend@feature/base-redesign`.
- Commit footer on every commit: `Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7`
- Backend response envelope is `{ Status, Data }`; the aligned frontend client returns `Data`. Role values are the canonical backend strings: `super_admin`, `admin`, `admin_viewer`, `user`. Status values: `active`, `blocked`, `incomplete`, `deleted`.
- `GET /api/users/:id` requires permission `users.read` (so admin, admin_viewer, super_admin can read; under Slice A's RBAC viewer is read-only).
- i18n: every new key goes in BOTH `messages/en.json` (canonical key set) and `messages/uk.json` (active language).
- All paths are relative to repo root `/Users/volodymyrporokhniak/Projects/My/CyberICEBox`.

---

## File Structure

**Backend (`AP Backend`):**
- `internal/model/user/user.go` — add `Status` to `UserInfo`; add new `UserDetail` struct.
- `internal/useCase/auth/admin.go` — map `Status` in `ListUsers`; add `GetUser`.
- `internal/useCase/auth/admin_test.go` — tests for `GetUser`.
- `internal/delivery/controller/http/handler/user/handler.go` — add `Status`+`CreatedAt` to list DTO; add `GetUser` to `IUseCase`, route, and `getUser` handler with detail DTO.

**Frontend (`admin-frontend`):**
- `src/api/client.ts`, `src/lib/auth.ts`, `src/lib/silentAuth.ts` — replaced by id-frontend's aligned versions.
- `src/app/auth/silent/page.tsx` — new SSO terminal page (copied from id-frontend).
- `src/lib/useRole.tsx` — run bootstrap before `fetchMe`; Role union → backend strings.
- `src/components/shell/TopBar.tsx` — view-only badge keys on `admin_viewer`.
- `src/components/users/RoleStatusBadge.tsx` — shared role/status badge (new).
- `src/app/users/page.tsx` — users list.
- `src/app/users/detail/page.tsx` — user detail + actions (`?id=<uuid>`).
- `src/app/dashboard/page.tsx` — stat cards.
- `messages/en.json`, `messages/uk.json` — new keys.

---

## Task 1: Align admin data layer + SSO bootstrap to AP Backend

**Files:**
- Overwrite: `admin-frontend/src/api/client.ts`, `src/lib/auth.ts`
- Create: `admin-frontend/src/lib/silentAuth.ts`, `src/app/auth/silent/page.tsx`
- Modify: `admin-frontend/src/lib/useRole.tsx`, `src/components/shell/TopBar.tsx`

**Interfaces:**
- Consumes: id-frontend's aligned modules as the source of truth.
- Produces: `apiGet/apiPost/apiPut/apiPatch/apiDelete<T>(path, body?, init?, opts?)` that return the unwrapped `Data` payload and throw `ApiError` (with `.status`). `fetchMe(): Promise<Me|null>` hitting `/api/auth/me`. `useRole()` → `{ me, role, isLoading, canManage, canManagePlatform }` with `role` typed `"user" | "admin_viewer" | "admin" | "super_admin" | null`.

- [ ] **Step 1: Copy the four aligned files from id-frontend (verbatim)**

From the repo root:

```bash
cp id-frontend/src/api/client.ts        admin-frontend/src/api/client.ts
cp id-frontend/src/lib/auth.ts          admin-frontend/src/lib/auth.ts
cp id-frontend/src/lib/silentAuth.ts    admin-frontend/src/lib/silentAuth.ts
mkdir -p admin-frontend/src/app/auth/silent
cp id-frontend/src/app/auth/silent/page.tsx admin-frontend/src/app/auth/silent/page.tsx
```

These are app-agnostic (they resolve via `@/` aliases identical in both apps and read `NEXT_PUBLIC_ID_ORIGIN`). The unused helpers in `auth.ts` (`safeReturnTo`, `rememberReturnTo`, etc.) are harmless dead exports.

- [ ] **Step 2: Reconcile `useRole.tsx` — run the bootstrap, fix the Role union**

Replace the entire contents of `admin-frontend/src/lib/useRole.tsx` with:

```tsx
"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { fetchMe, type Me } from "@/lib/auth"
import { runSilentAuthOnce } from "@/lib/silentAuth"

// Canonical backend role strings.
export type Role = "user" | "admin_viewer" | "admin" | "super_admin"

export interface RoleState {
  me: Me | null
  role: Role | null
  isLoading: boolean
  canManage: boolean         // admin | super_admin
  canManagePlatform: boolean // super_admin
}

const RoleContext = createContext<RoleState>({
  me: null,
  role: null,
  isLoading: true,
  canManage: false,
  canManagePlatform: false,
})

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // Run the one-shot silent-SSO bootstrap first (plants a local token if the
    // user has a master session), then read identity.
    runSilentAuthOnce()
      .then(() => fetchMe())
      .then((m) => { if (!cancelled) setMe(m) })
      .catch(() => { if (!cancelled) setMe(null) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const role = (me?.Role as Role | undefined) ?? null
  const canManage = role === "admin" || role === "super_admin"
  const canManagePlatform = role === "super_admin"

  return (
    <RoleContext.Provider value={{ me, role, isLoading, canManage, canManagePlatform }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole(): RoleState {
  return useContext(RoleContext)
}
```

- [ ] **Step 3: Reconcile `TopBar.tsx` — view-only badge on `admin_viewer`**

In `admin-frontend/src/components/shell/TopBar.tsx`, change the single guard:

```tsx
{role === "viewer" && (
```

to:

```tsx
{role === "admin_viewer" && (
```

(No other change in that file.)

- [ ] **Step 4: Typecheck**

Run: `cd admin-frontend && npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 5: Production build**

Run: `cd admin-frontend && npm run build`
Expected: compiled successfully; the route list now includes `/auth/silent`.

- [ ] **Step 6: Commit**

```bash
cd admin-frontend
git add src/api/client.ts src/lib/auth.ts src/lib/silentAuth.ts src/app/auth/silent/page.tsx src/lib/useRole.tsx src/components/shell/TopBar.tsx
git commit -m "feat(admin): align data layer + silent-SSO bootstrap to AP Backend

Adopt id-frontend's envelope-unwrapping api client + one-shot silent-auth
iframe bootstrap; useRole runs the bootstrap before fetchMe and uses canonical
backend role strings (admin_viewer).

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 2: Backend — `GET /api/users/:id` + Status on the list

**Files:**
- Modify: `AP Backend/internal/model/user/user.go`
- Modify: `AP Backend/internal/useCase/auth/admin.go`
- Modify: `AP Backend/internal/useCase/auth/admin_test.go`
- Modify: `AP Backend/internal/delivery/controller/http/handler/user/handler.go`

**Interfaces:**
- Consumes: existing repo methods `GetUserByID(ctx, id) (postgres.User, error)` and `GetUserProviders(ctx, id) ([]postgres.UserProvider, error)` (both already on the auth use-case's repo interface and exercised by `account.go`); `rbac.HasPermissionInContext(ctx, rbac.PermUsersRead)`; `repositoryTools.IsObjectNotFoundError`.
- Produces: `(*AuthUseCase).GetUser(ctx, id uuid.UUID) (*userModel.UserDetail, error)`; `userModel.UserDetail`; list DTO now carries `Status` + `CreatedAt`. The handler exposes `GET /users/:userID`.

- [ ] **Step 1: Add `Status` to `UserInfo` and a `UserDetail` struct**

In `AP Backend/internal/model/user/user.go`, add a `Status` field to `UserInfo` (place it right after `Role`):

```go
	UserInfo struct {
		ID        uuid.UUID
		FirstName string
		LastName  string
		Picture   string
		Email     string
		Role      string
		Status    string
		LastSeen  time.Time
		CreatedAt time.Time
	}
```

And add a new `UserDetail` type in the same `type (...)` block (after `UserInfo`):

```go
	UserDetail struct {
		ID             uuid.UUID
		FirstName      string
		LastName       string
		Email          string
		Role           string
		Status         string
		EmailConfirmed bool
		Picture        string
		SignInMethods  []string
		LastSeen       time.Time
		CreatedAt      time.Time
	}
```

- [ ] **Step 2: Write the failing `GetUser` use-case tests**

The test file `AP Backend/internal/useCase/auth/admin_test.go` is package `auth_test`. Its helper is `newAdminUC(t *testing.T) (*auth.AuthUseCase, *postgresMocks.MockQuerier)` (the controller is created inside it; tests do NOT manage `ctrl`). Tests use plain `t.Fatalf` + `errors.Is` (NOT testify). It already imports `errors`, `context`, `testing`, `uuid` (`github.com/gofrs/uuid`), `pgx` (`github.com/jackc/pgx/v5`), `gomock`, `postgres`, `postgresMocks`, `authModel`, `rbac`, `userModel`, `auth`. **Add one import:** `"github.com/jackc/pgx/v5/pgtype"`.

Add these three tests at the end of the file, matching that style exactly:

```go
// --- GetUser ---

func TestGetUser_PermissionDenied(t *testing.T) {
	uc, _ := newAdminUC(t)
	ctx := rbac.ContextWithRole(context.Background(), rbac.RoleUser) // no users.read
	if _, err := uc.GetUser(ctx, uuid.Must(uuid.NewV7())); !errors.Is(err, authModel.ErrInsufficientPermission.Err()) {
		t.Fatalf("want ErrInsufficientPermission, got %v", err)
	}
}

func TestGetUser_NotFound(t *testing.T) {
	uc, repo := newAdminUC(t)
	ctx := rbac.ContextWithRole(context.Background(), rbac.RoleAdmin)
	id := uuid.Must(uuid.NewV7())
	repo.EXPECT().GetUserByID(gomock.Any(), id).Return(postgres.User{}, pgx.ErrNoRows)
	if _, err := uc.GetUser(ctx, id); !errors.Is(err, userModel.ErrUserNotFound.Err()) {
		t.Fatalf("want ErrUserNotFound, got %v", err)
	}
}

func TestGetUser_ReturnsDetailWithSignInMethods(t *testing.T) {
	uc, repo := newAdminUC(t)
	ctx := rbac.ContextWithRole(context.Background(), rbac.RoleAdmin)
	id := uuid.Must(uuid.NewV7())
	repo.EXPECT().GetUserByID(gomock.Any(), id).Return(postgres.User{
		ID: id, Email: "a@b.test", FirstName: "Al", LastName: "Ice",
		Role: string(rbac.RoleAdmin), Status: userModel.UserStatusActive,
		EmailConfirmed: true,
		HashedPassword: pgtype.Text{String: "x", Valid: true},
	}, nil)
	repo.EXPECT().GetUserProviders(gomock.Any(), id).Return([]postgres.UserProvider{
		{Provider: userModel.GoogleProvider},
	}, nil)

	got, err := uc.GetUser(ctx, id)
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if got.Email != "a@b.test" || got.Status != userModel.UserStatusActive {
		t.Fatalf("unexpected detail: %+v", got)
	}
	if len(got.SignInMethods) != 2 || got.SignInMethods[0] != "email" || got.SignInMethods[1] != userModel.GoogleProvider {
		t.Fatalf("unexpected sign-in methods: %v", got.SignInMethods)
	}
}
```

- [ ] **Step 3: Run the tests, expect FAIL (GetUser undefined)**

Run: `cd "AP Backend" && go test ./internal/useCase/auth/ -run TestGetUser`
Expected: FAIL — `uc.GetUser undefined` (compile error) or method missing.

- [ ] **Step 4: Implement `GetUser` in `admin.go`**

In `AP Backend/internal/useCase/auth/admin.go`, add (after `ListUsers`):

```go
// GetUser returns a single user's detail view (profile + status + sign-in
// methods) for the admin UI. Requires PermUsersRead.
func (u *AuthUseCase) GetUser(ctx context.Context, userID uuid.UUID) (*userModel.UserDetail, error) {
	if !rbac.HasPermissionInContext(ctx, rbac.PermUsersRead) {
		return nil, authModel.ErrInsufficientPermission.Err()
	}

	usr, err := u.repo.GetUserByID(ctx, userID)
	if err != nil {
		if repositoryTools.IsObjectNotFoundError(err) {
			return nil, userModel.ErrUserNotFound.Err()
		}
		return nil, model.ErrPlatform.WithError(err).WithMessage("Failed to get user").Err()
	}

	providers, err := u.repo.GetUserProviders(ctx, userID)
	if err != nil {
		return nil, model.ErrPlatform.WithError(err).WithMessage("Failed to get user providers").Err()
	}

	methods := make([]string, 0, len(providers)+1)
	if usr.HashedPassword.Valid && usr.HashedPassword.String != "" {
		methods = append(methods, "email")
	}
	for _, p := range providers {
		methods = append(methods, p.Provider)
	}

	return &userModel.UserDetail{
		ID:             usr.ID,
		FirstName:      usr.FirstName,
		LastName:       usr.LastName,
		Email:          usr.Email,
		Role:           usr.Role,
		Status:         usr.Status,
		EmailConfirmed: usr.EmailConfirmed,
		Picture:        usr.Picture,
		SignInMethods:  methods,
		LastSeen:       usr.LastSeen,
		CreatedAt:      usr.CreatedAt,
	}, nil
}
```

Also, in the same file, map `Status` in `ListUsers` — change the `UserInfo` literal in the loop to include `Status: r.Status,` (right after `Role: r.Role,`).

- [ ] **Step 5: Run the tests, expect PASS**

Run: `cd "AP Backend" && go test ./internal/useCase/auth/ -run TestGetUser`
Expected: PASS (3 tests).

- [ ] **Step 6: Wire the handler — list DTO fields + detail route**

In `AP Backend/internal/delivery/controller/http/handler/user/handler.go`:

(a) Add `GetUser` to the `IUseCase` interface (after `ListUsers`):

```go
		GetUser(ctx context.Context, userID uuid.UUID) (*userModel.UserDetail, error)
```

(b) Extend the list `userResponse` struct with `Status` + `CreatedAt`, and add a `userDetailResponse` struct (in the `type (...)` block, after `listUsersResponse`). Add `"time"` to the imports:

```go
	userResponse struct {
		ID        uuid.UUID `json:"ID"`
		FirstName string    `json:"FirstName"`
		LastName  string    `json:"LastName"`
		Email     string    `json:"Email"`
		Role      string    `json:"Role"`
		Status    string    `json:"Status"`
		CreatedAt time.Time `json:"CreatedAt"`
	}

	userDetailResponse struct {
		ID             uuid.UUID `json:"ID"`
		FirstName      string    `json:"FirstName"`
		LastName       string    `json:"LastName"`
		Email          string    `json:"Email"`
		Role           string    `json:"Role"`
		Status         string    `json:"Status"`
		EmailConfirmed bool      `json:"EmailConfirmed"`
		Picture        string    `json:"Picture"`
		SignInMethods  []string  `json:"SignInMethods"`
		LastSeen       time.Time `json:"LastSeen"`
		CreatedAt      time.Time `json:"CreatedAt"`
	}
```

(c) In `listUsers`, populate the two new fields in the append loop:

```go
		resp.Users = append(resp.Users, userResponse{
			ID:        x.ID,
			FirstName: x.FirstName,
			LastName:  x.LastName,
			Email:     x.Email,
			Role:      x.Role,
			Status:    x.Status,
			CreatedAt: x.CreatedAt,
		})
```

(d) Register the detail route in `Init` (after the `users.GET("", ...)` line):

```go
	users.GET(":userID", h.prot.RequirePermission(rbac.PermUsersRead), h.getUser)
```

(e) Add the handler method (after `listUsers`):

```go
// getUser godoc
// @Summary  Get a single user's detail
// @Tags     users
// @Produce  json
// @Param    userID  path      string  true  "target user UUID"
// @Success  200  {object}  response.Response{data=userDetailResponse}
// @Failure  401  {object}  response.Response
// @Failure  403  {object}  response.Response
// @Failure  404  {object}  response.Response
// @Router   /users/{userID} [get]
func (h *Handler) getUser(ctx *gin.Context) {
	targetID, ok := parseUserID(ctx)
	if !ok {
		return
	}
	d, err := h.useCase.GetUser(ctx.Request.Context(), targetID)
	if err != nil {
		response.AbortWithError(ctx, err)
		return
	}
	response.AbortWithData(ctx, userDetailResponse{
		ID:             d.ID,
		FirstName:      d.FirstName,
		LastName:       d.LastName,
		Email:          d.Email,
		Role:           d.Role,
		Status:         d.Status,
		EmailConfirmed: d.EmailConfirmed,
		Picture:        d.Picture,
		SignInMethods:  d.SignInMethods,
		LastSeen:       d.LastSeen,
		CreatedAt:      d.CreatedAt,
	})
}
```

Note on route order: gin matches `:userID` as a path param; the existing static segment `invite` (POST) and the param routes (`:userID/role`, etc.) do not collide with `GET :userID`. Keep `GET :userID` after `GET ""`.

- [ ] **Step 7: Update the hand-written handler fake + build**

The handler's `IUseCase` gained `GetUser`, so the hand-written `fakeUC` in `AP Backend/internal/delivery/controller/http/handler/user/handler_test.go` (package `user_test`) no longer satisfies the interface. Add this method to `fakeUC` (next to its other methods like `ListUsers`):

```go
func (f *fakeUC) GetUser(_ context.Context, _ uuid.UUID) (*userModel.UserDetail, error) {
	return &userModel.UserDetail{}, nil
}
```

There is no generated mock for this handler interface (it's a hand fake). Then:

Run: `cd "AP Backend" && go build ./... && go test ./...`
Expected: all `ok`. If any existing handler test asserts the exact list-response JSON and now fails on the added `Status`/`CreatedAt` fields, update that assertion to include them (the fields are additive).

- [ ] **Step 8: Commit**

```bash
cd "AP Backend"
git add internal/model/user/user.go internal/useCase/auth/admin.go internal/useCase/auth/admin_test.go internal/delivery/controller/http/handler/user/handler.go
git commit -m "feat(users): GET /users/:id detail endpoint + Status on list

Adds AuthUseCase.GetUser (profile + status + sign-in methods, users.read) and
surfaces Status + CreatedAt on the user list DTO. No SQL changes (rows already
SELECT *).

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 3: Frontend — Users list page

**Files:**
- Create: `admin-frontend/src/components/users/RoleStatusBadge.tsx`
- Modify: `admin-frontend/src/app/users/page.tsx`
- Modify: `admin-frontend/messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `apiGet<UsersList>("/api/users?...")`; `useRole()`; DS `Card`; `t`.
- Produces: `RoleStatusBadge` (reused by Task 4); the `UserRow`/`UsersList` TS types; the `/users` list view linking each row to `/users/[id]`.

- [ ] **Step 1: Add i18n keys (en.json)**

Add to `admin-frontend/messages/en.json` (near the `admin.*` block):

```json
"admin.users.title": "Users",
"admin.users.search": "Search by name or email",
"admin.users.col.user": "User",
"admin.users.col.role": "Role",
"admin.users.col.status": "Status",
"admin.users.col.created": "Created",
"admin.users.empty": "No users found",
"admin.users.loadError": "Failed to load users",
"admin.users.total": "Total",
"admin.role.user": "User",
"admin.role.admin_viewer": "Viewer",
"admin.role.admin": "Admin",
"admin.role.super_admin": "Super admin",
"admin.status.active": "Active",
"admin.status.blocked": "Blocked",
"admin.status.incomplete": "Incomplete",
"admin.status.deleted": "Deleted"
```

- [ ] **Step 2: Add the same keys (uk.json)**

Add to `admin-frontend/messages/uk.json`:

```json
"admin.users.title": "Користувачі",
"admin.users.search": "Пошук за іменем або email",
"admin.users.col.user": "Користувач",
"admin.users.col.role": "Роль",
"admin.users.col.status": "Статус",
"admin.users.col.created": "Створено",
"admin.users.empty": "Користувачів не знайдено",
"admin.users.loadError": "Не вдалося завантажити користувачів",
"admin.users.total": "Усього",
"admin.role.user": "Користувач",
"admin.role.admin_viewer": "Перегляд",
"admin.role.admin": "Адміністратор",
"admin.role.super_admin": "Суперадмін",
"admin.status.active": "Активний",
"admin.status.blocked": "Заблокований",
"admin.status.incomplete": "Незавершений",
"admin.status.deleted": "Видалений"
```

- [ ] **Step 3: Create the shared badge component**

Create `admin-frontend/src/components/users/RoleStatusBadge.tsx`:

```tsx
import { t } from "@/i18n/t"

const ROLE_STYLES: Record<string, string> = {
  super_admin: "bg-primary/15 text-primary",
  admin: "bg-accent/40 text-accent-foreground",
  admin_viewer: "bg-secondary text-secondary-foreground",
  user: "bg-muted text-muted-foreground",
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  blocked: "bg-destructive/15 text-destructive",
  incomplete: "bg-muted text-muted-foreground",
  deleted: "bg-destructive/15 text-destructive",
}

function pill(styles: string, label: string) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  return pill(ROLE_STYLES[role] ?? "bg-muted text-muted-foreground", t(`admin.role.${role}`))
}

export function StatusBadge({ status }: { status: string }) {
  return pill(STATUS_STYLES[status] ?? "bg-muted text-muted-foreground", t(`admin.status.${status}`))
}
```

- [ ] **Step 4: Build the users list page**

Replace the entire contents of `admin-frontend/src/app/users/page.tsx` with:

```tsx
"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { apiGet } from "@/api/client"
import { t } from "@/i18n/t"
import { RoleBadge, StatusBadge } from "@/components/users/RoleStatusBadge"

export type UserRow = {
  ID: string
  FirstName: string
  LastName: string
  Email: string
  Role: string
  Status: string
  CreatedAt: string
}
type UsersList = { Users: UserRow[]; Total: number }

function fullName(u: UserRow): string {
  const n = `${u.FirstName ?? ""} ${u.LastName ?? ""}`.trim()
  return n || u.Email
}

export default function Page() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""
    apiGet<UsersList>(`/api/users${q}`)
      .then((d) => { if (!cancelled) { setUsers(d.Users ?? []); setTotal(d.Total ?? 0) } })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search])

  return (
    <div className="frost-panel frost-in rounded-lg p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-foreground">{t("admin.users.title")}</h1>
        <span className="text-xs text-muted-foreground">{t("admin.users.total")}: {total}</span>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("admin.users.search")}
        className="mb-4 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

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
                  <td className="px-3 py-2 text-muted-foreground">
                    {u.CreatedAt ? new Date(u.CreatedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0; `/users` builds.

- [ ] **Step 6: Commit**

```bash
cd admin-frontend
git add src/components/users/RoleStatusBadge.tsx src/app/users/page.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): users list page (search, role/status badges, row links)

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 4: Frontend — User detail page + actions

**Files:**
- Create: `admin-frontend/src/app/users/detail/page.tsx`
- Modify: `admin-frontend/messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `apiGet<UserDetail>`, `apiPatch`, `apiDelete`; `useRole()` (`canManage`, `canManagePlatform`); DS `Button`, `Dialog*`; `RoleBadge`/`StatusBadge`; `t`.
- Produces: the `/users/detail?id=<uuid>` view with role change, block/unblock, delete.

**Why a query param, not `[id]`:** `next.config.mjs` sets `output: 'export'` (static export) with `trailingSlash: true`. A dynamic `[id]` segment under static export requires `generateStaticParams`, which can't enumerate arbitrary user UUIDs. The codebase convention (mirroring id-frontend) is **query-param routing** for client-rendered detail views. `useSearchParams()` under static export must be wrapped in `<Suspense>`.

- [ ] **Step 1: Add i18n keys (en.json)**

```json
"admin.userDetail.back": "Back to users",
"admin.userDetail.notFound": "User not found",
"admin.userDetail.signInMethods": "Sign-in methods",
"admin.userDetail.emailConfirmed": "Email confirmed",
"admin.userDetail.lastSeen": "Last seen",
"admin.userDetail.created": "Created",
"admin.userDetail.yes": "Yes",
"admin.userDetail.no": "No",
"admin.userDetail.changeRole": "Role",
"admin.userDetail.block": "Block",
"admin.userDetail.unblock": "Unblock",
"admin.userDetail.delete": "Delete user",
"admin.userDetail.deleteConfirmTitle": "Delete this user?",
"admin.userDetail.deleteConfirmBody": "This action cannot be undone.",
"admin.userDetail.cancel": "Cancel",
"admin.userDetail.actionError": "Action failed",
"admin.userDetail.never": "Never",
"admin.method.email": "Email",
"admin.method.google": "Google"
```

- [ ] **Step 2: Add the same keys (uk.json)**

```json
"admin.userDetail.back": "До користувачів",
"admin.userDetail.notFound": "Користувача не знайдено",
"admin.userDetail.signInMethods": "Способи входу",
"admin.userDetail.emailConfirmed": "Email підтверджено",
"admin.userDetail.lastSeen": "Останній вхід",
"admin.userDetail.created": "Створено",
"admin.userDetail.yes": "Так",
"admin.userDetail.no": "Ні",
"admin.userDetail.changeRole": "Роль",
"admin.userDetail.block": "Заблокувати",
"admin.userDetail.unblock": "Розблокувати",
"admin.userDetail.delete": "Видалити користувача",
"admin.userDetail.deleteConfirmTitle": "Видалити цього користувача?",
"admin.userDetail.deleteConfirmBody": "Цю дію не можна скасувати.",
"admin.userDetail.cancel": "Скасувати",
"admin.userDetail.actionError": "Помилка дії",
"admin.userDetail.never": "Ніколи",
"admin.method.email": "Email",
"admin.method.google": "Google"
```

- [ ] **Step 3: Build the detail page**

Create `admin-frontend/src/app/users/detail/page.tsx`:

```tsx
"use client"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { apiGet, apiPatch, apiDelete } from "@/api/client"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { RoleBadge, StatusBadge } from "@/components/users/RoleStatusBadge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"

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

// Roles assignable by the current caller (super_admin can grant super_admin; admin cannot).
function assignableRoles(canManagePlatform: boolean): string[] {
  return canManagePlatform
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
  const { canManage, canManagePlatform } = useRole()

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
    return <div className="frost-panel frost-in rounded-lg p-8 text-sm text-muted-foreground">{t("admin.loading")}</div>
  }
  if (notFound || !user) {
    return (
      <div className="frost-panel frost-in rounded-lg p-8">
        <Link href="/users" className="text-sm text-primary hover:underline">← {t("admin.userDetail.back")}</Link>
        <p className="mt-4 text-sm text-muted-foreground">{t("admin.userDetail.notFound")}</p>
      </div>
    )
  }

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

      {canManage && (
        <div className="mt-8 flex flex-wrap items-end gap-3 border-t border-border pt-6">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted-foreground">
            {t("admin.userDetail.changeRole")}
            <select
              value={user.Role}
              disabled={busy}
              onChange={(e) => changeRole(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* Always show the current role even if not normally assignable by this caller. */}
              {Array.from(new Set([user.Role, ...assignableRoles(canManagePlatform)])).map((r) => (
                <option key={r} value={r}>{t(`admin.role.${r}`)}</option>
              ))}
            </select>
          </label>

          {user.Status === "blocked" ? (
            <Button variant="outline" disabled={busy} onClick={() => setStatus("active")}>{t("admin.userDetail.unblock")}</Button>
          ) : (
            <Button variant="outline" disabled={busy} onClick={() => setStatus("blocked")}>{t("admin.userDetail.block")}</Button>
          )}

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

          {actionError && <span className="text-sm text-destructive">{t("admin.userDetail.actionError")}</span>}
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="frost-panel frost-in rounded-lg p-8 text-sm text-muted-foreground">{t("admin.loading")}</div>}>
      <Detail />
    </Suspense>
  )
}
```

- [ ] **Step 4: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0; `/users/detail` builds as a static route. (`useSearchParams` is already wrapped in `<Suspense>`, which `output: export` requires.) If the build complains that `useSearchParams` must be wrapped in a suspense boundary, confirm the `<Suspense>` wrapper from Step 3 is present.

- [ ] **Step 5: Commit**

```bash
cd admin-frontend
git add src/app/users/detail/page.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): user detail page (profile + role/status/delete actions)

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 5: Frontend — Dashboard stat cards

**Files:**
- Modify: `admin-frontend/src/app/dashboard/page.tsx`
- Modify: `admin-frontend/messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `apiGet<UsersList>("/api/users?limit=1000")` (reuses the list endpoint to derive counts); DS `Card*`; `t`.
- Produces: the `/dashboard` overview.

- [ ] **Step 1: Add i18n keys (en.json)**

```json
"admin.dashboard.title": "Dashboard",
"admin.dashboard.totalUsers": "Total users",
"admin.dashboard.admins": "Admins",
"admin.dashboard.blocked": "Blocked",
"admin.dashboard.loadError": "Failed to load dashboard"
```

- [ ] **Step 2: Add the same keys (uk.json)**

```json
"admin.dashboard.title": "Дашборд",
"admin.dashboard.totalUsers": "Усього користувачів",
"admin.dashboard.admins": "Адміністратори",
"admin.dashboard.blocked": "Заблоковані",
"admin.dashboard.loadError": "Не вдалося завантажити дашборд"
```

- [ ] **Step 3: Build the dashboard**

Replace the entire contents of `admin-frontend/src/app/dashboard/page.tsx` with:

```tsx
"use client"
import { useEffect, useState } from "react"
import { apiGet } from "@/api/client"
import { t } from "@/i18n/t"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { UserRow } from "@/app/users/page"

type UsersList = { Users: UserRow[]; Total: number }

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

export default function Page() {
  const [list, setList] = useState<UsersList | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiGet<UsersList>("/api/users?limit=1000")
      .then((d) => { if (!cancelled) setList(d) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const total = list?.Total ?? 0
  const admins = (list?.Users ?? []).filter((u) => u.Role === "admin" || u.Role === "super_admin").length
  const blocked = (list?.Users ?? []).filter((u) => u.Status === "blocked").length

  return (
    <div className="frost-in">
      <h1 className="mb-4 text-lg font-semibold text-foreground">{t("admin.dashboard.title")}</h1>
      {error ? (
        <p className="text-sm text-destructive">{t("admin.dashboard.loadError")}</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t("admin.dashboard.totalUsers")} value={total} />
          <StatCard label={t("admin.dashboard.admins")} value={admins} />
          <StatCard label={t("admin.dashboard.blocked")} value={blocked} />
        </div>
      )}
    </div>
  )
}
```

(Note: `admins`/`blocked` are counted from the fetched page, capped at `limit=1000` — adequate for the current scale. If the platform exceeds that, a dedicated stats endpoint is a later concern, out of scope here.)

- [ ] **Step 4: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd admin-frontend
git add src/app/dashboard/page.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): dashboard stat cards (total users, admins, blocked)

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Self-Review

**Spec coverage (spec §"Slice B — Dashboard + Users"):**
- `GET /api/users/:id` (perm `users.read`) → Task 2. Status surfaced on list (needed by the spec's list "status" column) → Task 2.
- Users list (email, name, role, status, created; search; row → detail) → Task 3.
- User detail (profile: email/name/role/status/dates/sign-in methods; actions: role change gated by CanAssignRole, block/unblock, delete+confirm) → Task 4. Password reset intentionally absent (spec decision).
- Dashboard (basic stat cards over existing data; no charts) → Task 5. The super-admin notification-health card depends on Slice C's `/notifications/stats` and is deferred per spec.
- Data-layer prerequisite (envelope unwrap + `/api/auth/me` + silent SSO) → Task 1 (discovered gap; user chose "copy from id-frontend").

**Placeholder scan:** No TBD/TODO. Every code step shows complete content; copy steps use exact `cp`. The two conditional notes (mock regen in Task 2 Step 7; `generateStaticParams` in Task 4 Step 4) are explicit contingencies with exact code, not open-ended hand-waving.

**Type consistency:** `UserDetail` fields match between the Go DTO (Task 2 `userDetailResponse`) and the TS type (Task 4) — ID, FirstName, LastName, Email, Role, Status, EmailConfirmed, Picture, SignInMethods, LastSeen, CreatedAt. `UserRow`/`UsersList` match the list DTO (Task 2 `userResponse` + `listUsersResponse`: Users, Total; row adds Status, CreatedAt). `RoleBadge`/`StatusBadge` exported from Task 3 are imported by Task 4. `useRole` Role union (`admin_viewer`) set in Task 1 is used by Task 4's `canManage`/`canManagePlatform`. Role/status i18n keys (`admin.role.*`, `admin.status.*`) are added once in Task 3 and reused in Tasks 4–5.
