# Users — Filtering + Cursor Pagination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin Users list's offset pagination with cursor (keyset) pagination + multi-role filter + debounced search + infinite scroll, and feed the dashboard from a new `GET /api/users/stats` endpoint.

**Architecture:** Backend gains a keyset `ListUsersCursor` query (filtered by search + role array, ordered `created_at DESC, id DESC`) and user-count queries; the use-case encodes/decodes an opaque base64 cursor and computes `HasMore` via `limit+1`. The handler swaps the list endpoint to cursor + adds `/users/stats`. The frontend Users page does debounced search, role checkboxes, and `IntersectionObserver` infinite scroll; the dashboard reads `/users/stats`.

**Tech Stack:** Go 1.26 (gin v1.12, sqlc via `make sqlcGenerate`); Next 16 / React 19 / TypeScript.

## Global Constraints

- Repos & branches (no new branches): `AP Backend@feature/backend-frontend-proxy`, `admin-frontend@feature/base-redesign`.
- Commit footer on every commit: `Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7`
- Order is fixed `created_at DESC, id DESC` (no sorting). Cursor = `base64url(created_at_rfc3339nano|id)`. Empty cursor → sentinel `(9999-12-31, max-uuid)` so one keyset predicate serves the first page. `HasMore` via `limit+1` (no COUNT per page).
- List endpoint: `GET /api/users?search=&role=<r>&role=<r>&cursor=&limit=` → `{Users, NextCursor, HasMore}`; permission `users.read`. Stats: `GET /api/users/stats` → `{Total, Blocked, NewLast7d, ActiveLast7d, AvgDailyActive7d, ByRole:[{Role,Count}], RegistrationsByDay:[{Day,Count}]}` over a 7-day window; permission `users.read`.
- `UserRow` shape unchanged: `{ID,FirstName,LastName,Email,Role,Status,CreatedAt}`.
- All UI on the design-system components/tokens. New i18n keys in BOTH `messages/en.json` + `messages/uk.json`.
- Paths relative to repo root `/Users/volodymyrporokhniak/Projects/My/CyberICEBox`.

---

## File Structure

**Backend (`AP Backend`):**
- `internal/delivery/repository/postgres/queries/users.sql` — add `ListUsersCursor`, `CountUsersByRoleAll`, `CountUsersByStatus`. Remove the offset `ListUsers` (replaced).
- regenerated `postgres/{users.sql.go, querier.go}` + `mocks/mock_querier.go`.
- `internal/model/user/user.go` — add `UsersFilter`, `UsersListResult`, `RoleCount`, `UserStats`.
- `internal/useCase/auth/admin.go` — cursor encode/decode helpers; rewrite `ListUsers(ctx, filter)`; add `GetUserStats`.
- `internal/useCase/auth/admin_test.go` — rewrite ListUsers tests to cursor; add GetUserStats test.
- `internal/delivery/controller/http/handler/user/handler.go` — interface + list handler (cursor) + stats handler + route + DTOs.
- `internal/delivery/controller/http/handler/user/handler_test.go` — update fake + list test; add stats test.

**Frontend (`admin-frontend`):**
- `src/app/users/page.tsx` — debounced search + role checkboxes + infinite scroll.
- `src/app/dashboard/page.tsx` — read `/api/users/stats`.
- `messages/en.json`, `messages/uk.json`.

---

## Task 1: Backend — sqlc cursor + stats queries

**Files:**
- Modify: `AP Backend/internal/delivery/repository/postgres/queries/users.sql`
- Regenerate: `postgres/{users.sql.go, querier.go}`
- Modify: `postgres/mocks/mock_querier.go`

**Interfaces:**
- Produces (generated `Querier` methods, exact signatures):
  - `ListUsersCursor(ctx, arg ListUsersCursorParams) ([]User, error)` — `ListUsersCursorParams{ Search string; Roles []string; CursorCreatedAt time.Time; CursorID uuid.UUID; LimitVal int32 }`
  - `CountUsersByRoleAll(ctx) ([]CountUsersByRoleAllRow, error)` — `CountUsersByRoleAllRow{ Role string; Count int64 }`
  - `CountUsersByStatus(ctx, status string) (int64, error)`
  - `CountUsersCreatedSince(ctx, createdAt time.Time) (int64, error)`
  - `CountUsersActiveSince(ctx, lastSeen time.Time) (int64, error)`
  - `AvgDailyActiveSince(ctx, createdAt time.Time) (float64, error)`
  - `RegistrationsByDaySince(ctx, createdAt time.Time) ([]RegistrationsByDaySinceRow, error)` — `RegistrationsByDaySinceRow{ Day time.Time; Count int64 }`
  - existing `CountUsers(ctx, search string) (int64, error)` is retained (used by stats for Total).
  - the old `ListUsers(ctx, ListUsersParams)` (offset) is removed.

- [ ] **Step 1: Edit `users.sql`**

In `AP Backend/internal/delivery/repository/postgres/queries/users.sql`, REPLACE the existing `-- name: ListUsers :many` query block with the cursor version, and add the two count queries. Keep `CountUsers`, `CountUsersByRole`, and all other queries untouched.

Replace:
```sql
-- name: ListUsers :many
SELECT *
FROM users
WHERE deleted_at IS NULL
  AND (sqlc.arg(search)::text = '' OR email ILIKE '%' || sqlc.arg(search)::text || '%'
       OR first_name ILIKE '%' || sqlc.arg(search)::text || '%'
       OR last_name ILIKE '%' || sqlc.arg(search)::text || '%')
ORDER BY created_at DESC
LIMIT sqlc.arg(limit_val) OFFSET sqlc.arg(offset_val);
```
with:
```sql
-- name: ListUsersCursor :many
SELECT *
FROM users
WHERE deleted_at IS NULL
  AND (sqlc.arg(search)::text = '' OR email ILIKE '%' || sqlc.arg(search)::text || '%'
       OR first_name ILIKE '%' || sqlc.arg(search)::text || '%'
       OR last_name ILIKE '%' || sqlc.arg(search)::text || '%')
  AND (cardinality(sqlc.arg(roles)::text[]) = 0 OR role = ANY (sqlc.arg(roles)::text[]))
  AND (created_at, id) < (sqlc.arg(cursor_created_at)::timestamptz, sqlc.arg(cursor_id)::uuid)
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(limit_val);
```
And append:
```sql
-- name: CountUsersByRoleAll :many
SELECT role, count(*)::bigint AS count
FROM users
WHERE deleted_at IS NULL
GROUP BY role;

-- name: CountUsersByStatus :one
SELECT count(*)
FROM users
WHERE deleted_at IS NULL
  AND status = $1;

-- name: CountUsersCreatedSince :one
SELECT count(*)
FROM users
WHERE deleted_at IS NULL
  AND created_at >= $1;

-- name: CountUsersActiveSince :one
SELECT count(*)
FROM users
WHERE deleted_at IS NULL
  AND last_seen >= $1;

-- name: AvgDailyActiveSince :one
SELECT COALESCE(count(*), 0)::float8 / 7.0 AS avg_daily_active
FROM (SELECT date_trunc('day', created_at) AS d, user_id
      FROM sessions
      WHERE created_at >= $1
      GROUP BY 1, 2) x;

-- name: RegistrationsByDaySince :many
SELECT date_trunc('day', created_at) AS day, count(*)::bigint AS count
FROM users
WHERE deleted_at IS NULL
  AND created_at >= $1
GROUP BY 1
ORDER BY 1;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd "AP Backend" && make sqlcGenerate`
Expected: regenerates `users.sql.go` (`ListUsersCursor`/`CountUsersByRoleAll`/`CountUsersByStatus`, the old `ListUsers`/`ListUsersParams` gone) + `querier.go`. Verify:
`grep -n "ListUsersCursor\|CountUsersByRoleAll\|CountUsersByStatus\|func (q \*Queries) ListUsers(" internal/delivery/repository/postgres/users.sql.go`
(the last pattern — bare `ListUsers(` — must NOT match anymore.)
If Docker is unavailable, STOP and report BLOCKED.

- [ ] **Step 3: Update the mock**

In `internal/delivery/repository/postgres/mocks/mock_querier.go`: the old `ListUsers` mock pair must be removed (the interface no longer has it) and the three new methods added. Easiest reliable path: if `mockgen` is installed, regenerate. Otherwise: delete the `ListUsers`/`ListUsersParams` method + recorder pair, and add (matching the file's existing style; `time`/`uuid` already imported):

```go
func (m *MockQuerier) ListUsersCursor(ctx context.Context, arg postgres.ListUsersCursorParams) ([]postgres.User, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ListUsersCursor", ctx, arg)
	ret0, _ := ret[0].([]postgres.User)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}
func (mr *MockQuerierMockRecorder) ListUsersCursor(ctx, arg any) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ListUsersCursor", reflect.TypeOf((*MockQuerier)(nil).ListUsersCursor), ctx, arg)
}

func (m *MockQuerier) CountUsersByRoleAll(ctx context.Context) ([]postgres.CountUsersByRoleAllRow, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "CountUsersByRoleAll", ctx)
	ret0, _ := ret[0].([]postgres.CountUsersByRoleAllRow)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}
func (mr *MockQuerierMockRecorder) CountUsersByRoleAll(ctx any) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "CountUsersByRoleAll", reflect.TypeOf((*MockQuerier)(nil).CountUsersByRoleAll), ctx)
}

func (m *MockQuerier) CountUsersByStatus(ctx context.Context, status string) (int64, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "CountUsersByStatus", ctx, status)
	ret0, _ := ret[0].(int64)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}
func (mr *MockQuerierMockRecorder) CountUsersByStatus(ctx, status any) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "CountUsersByStatus", reflect.TypeOf((*MockQuerier)(nil).CountUsersByStatus), ctx, status)
}

func (m *MockQuerier) CountUsersCreatedSince(ctx context.Context, createdAt time.Time) (int64, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "CountUsersCreatedSince", ctx, createdAt)
	ret0, _ := ret[0].(int64)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}
func (mr *MockQuerierMockRecorder) CountUsersCreatedSince(ctx, createdAt any) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "CountUsersCreatedSince", reflect.TypeOf((*MockQuerier)(nil).CountUsersCreatedSince), ctx, createdAt)
}

func (m *MockQuerier) CountUsersActiveSince(ctx context.Context, lastSeen time.Time) (int64, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "CountUsersActiveSince", ctx, lastSeen)
	ret0, _ := ret[0].(int64)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}
func (mr *MockQuerierMockRecorder) CountUsersActiveSince(ctx, lastSeen any) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "CountUsersActiveSince", reflect.TypeOf((*MockQuerier)(nil).CountUsersActiveSince), ctx, lastSeen)
}

func (m *MockQuerier) AvgDailyActiveSince(ctx context.Context, createdAt time.Time) (float64, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "AvgDailyActiveSince", ctx, createdAt)
	ret0, _ := ret[0].(float64)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}
func (mr *MockQuerierMockRecorder) AvgDailyActiveSince(ctx, createdAt any) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "AvgDailyActiveSince", reflect.TypeOf((*MockQuerier)(nil).AvgDailyActiveSince), ctx, createdAt)
}

func (m *MockQuerier) RegistrationsByDaySince(ctx context.Context, createdAt time.Time) ([]postgres.RegistrationsByDaySinceRow, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "RegistrationsByDaySince", ctx, createdAt)
	ret0, _ := ret[0].([]postgres.RegistrationsByDaySinceRow)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}
func (mr *MockQuerierMockRecorder) RegistrationsByDaySince(ctx, createdAt any) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "RegistrationsByDaySince", reflect.TypeOf((*MockQuerier)(nil).RegistrationsByDaySince), ctx, createdAt)
}
```

- [ ] **Step 4: Build (expect compile errors in admin.go/handler — that's fine here)**

Run: `cd "AP Backend" && go build ./internal/delivery/repository/...`
Expected: the `postgres` + `mocks` packages compile (the use-case/handler packages still reference the old `ListUsers` and will be fixed in Tasks 2–3 — do NOT build `./...` yet).

- [ ] **Step 5: Commit**

```bash
cd "AP Backend"
git add internal/delivery/repository/postgres/queries/users.sql internal/delivery/repository/postgres/users.sql.go internal/delivery/repository/postgres/querier.go internal/delivery/repository/postgres/mocks/mock_querier.go
git commit -m "feat(repo): users keyset list query + role/status count queries

Replaces offset ListUsers with cursor ListUsersCursor (search + role array +
keyset); adds CountUsersByRoleAll + CountUsersByStatus for the user-stats endpoint.

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 2: Backend — model + use-case (cursor + stats)

**Files:**
- Modify: `AP Backend/internal/model/user/user.go`
- Modify: `AP Backend/internal/useCase/auth/admin.go`
- Modify: `AP Backend/internal/useCase/auth/admin_test.go`

**Interfaces:**
- Consumes: the Task-1 `Querier` methods; `rbac.HasPermissionInContext`, `rbac.PermUsersRead`; `model.ErrPlatform`; `userModel.UserStatusBlocked`.
- Produces:
  - `(*AuthUseCase).ListUsers(ctx, f userModel.UsersFilter) (userModel.UsersListResult, error)`
  - `(*AuthUseCase).GetUserStats(ctx) (userModel.UserStats, error)`
  - model types `UsersFilter`, `UsersListResult`, `RoleCount`, `UserStats`.

- [ ] **Step 1: Add model types**

In `AP Backend/internal/model/user/user.go`, add to the `type (...)` block (after `UserDetail`):

```go
	UsersFilter struct {
		Search string
		Roles  []string
		Cursor string
		Limit  int32
	}

	UsersListResult struct {
		Users      []UserInfo
		NextCursor string
		HasMore    bool
	}

	RoleCount struct {
		Role  string
		Count int64
	}

	DayCount struct {
		Day   time.Time
		Count int64
	}

	UserStats struct {
		Total            int64
		Blocked          int64
		NewLast7d        int64
		ActiveLast7d     int64
		AvgDailyActive7d float64
		ByRole           []RoleCount
		RegistrationsByDay []DayCount
	}
```
(`user.go` already imports `"time"`.)

- [ ] **Step 2: Write the failing use-case tests**

In `AP Backend/internal/useCase/auth/admin_test.go`: REPLACE the existing `TestAdminListUsers_PermissionDenied` and `TestAdminListUsers_Success` with the cursor versions below, and add a stats test. Add imports `"encoding/base64"`, `"strings"`, `"time"`, `"github.com/jackc/pgx/v5/pgtype"` if not present (check first). Use the package's plain `t.Fatalf` style.

```go
func TestAdminListUsers_PermissionDenied(t *testing.T) {
	uc, _ := newAdminUC(t)
	ctx := rbac.ContextWithRole(context.Background(), rbac.RoleUser)
	if _, err := uc.ListUsers(ctx, userModel.UsersFilter{Limit: 10}); !errors.Is(err, authModel.ErrInsufficientPermission.Err()) {
		t.Fatalf("want ErrInsufficientPermission, got %v", err)
	}
}

func TestAdminListUsers_FirstPageNoMore(t *testing.T) {
	uc, repo := newAdminUC(t)
	ctx := rbac.ContextWithRole(context.Background(), rbac.RoleSuperAdmin)
	uid := uuid.Must(uuid.NewV7())
	// limit 10 → use-case requests 11; repo returns 1 → HasMore false, no cursor.
	repo.EXPECT().ListUsersCursor(gomock.Any(), gomock.AssignableToTypeOf(postgres.ListUsersCursorParams{})).
		DoAndReturn(func(_ context.Context, arg postgres.ListUsersCursorParams) ([]postgres.User, error) {
			if arg.LimitVal != 11 {
				t.Fatalf("want limit+1=11, got %d", arg.LimitVal)
			}
			if arg.Search != "alice" {
				t.Fatalf("want search=alice, got %q", arg.Search)
			}
			return []postgres.User{{ID: uid, Email: "alice@test.test", Role: "user"}}, nil
		})
	res, err := uc.ListUsers(ctx, userModel.UsersFilter{Search: "alice", Limit: 10})
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if len(res.Users) != 1 || res.HasMore || res.NextCursor != "" {
		t.Fatalf("unexpected: %+v", res)
	}
}

func TestAdminListUsers_HasMoreEmitsCursor(t *testing.T) {
	uc, repo := newAdminUC(t)
	ctx := rbac.ContextWithRole(context.Background(), rbac.RoleSuperAdmin)
	last := uuid.Must(uuid.NewV7())
	ts := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	// limit 2 → requests 3; repo returns 3 → HasMore true, cursor from the 2nd (last kept) row.
	repo.EXPECT().ListUsersCursor(gomock.Any(), gomock.Any()).Return([]postgres.User{
		{ID: uuid.Must(uuid.NewV7()), Email: "a@b", Role: "user", CreatedAt: ts.Add(2 * time.Hour)},
		{ID: last, Email: "c@d", Role: "user", CreatedAt: ts},
		{ID: uuid.Must(uuid.NewV7()), Email: "e@f", Role: "user", CreatedAt: ts.Add(-time.Hour)},
	}, nil)
	res, err := uc.ListUsers(ctx, userModel.UsersFilter{Limit: 2})
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if len(res.Users) != 2 || !res.HasMore || res.NextCursor == "" {
		t.Fatalf("unexpected: %+v", res)
	}
	// NextCursor decodes back to the last kept row's (created_at, id).
	dec, _ := base64.RawURLEncoding.DecodeString(res.NextCursor)
	parts := strings.SplitN(string(dec), "|", 2)
	if len(parts) != 2 || parts[1] != last.String() {
		t.Fatalf("cursor does not encode last kept id: %q", string(dec))
	}
}

func TestGetUserStats_Aggregates(t *testing.T) {
	uc, repo := newAdminUC(t)
	ctx := rbac.ContextWithRole(context.Background(), rbac.RoleSuperAdmin)
	repo.EXPECT().CountUsers(gomock.Any(), "").Return(int64(42), nil)
	repo.EXPECT().CountUsersByRoleAll(gomock.Any()).Return([]postgres.CountUsersByRoleAllRow{
		{Role: "admin", Count: 3}, {Role: "user", Count: 39},
	}, nil)
	repo.EXPECT().CountUsersByStatus(gomock.Any(), userModel.UserStatusBlocked).Return(int64(5), nil)
	repo.EXPECT().CountUsersCreatedSince(gomock.Any(), gomock.Any()).Return(int64(8), nil)
	repo.EXPECT().CountUsersActiveSince(gomock.Any(), gomock.Any()).Return(int64(20), nil)
	repo.EXPECT().AvgDailyActiveSince(gomock.Any(), gomock.Any()).Return(4.5, nil)
	repo.EXPECT().RegistrationsByDaySince(gomock.Any(), gomock.Any()).Return([]postgres.RegistrationsByDaySinceRow{
		{Day: time.Date(2026, 6, 27, 0, 0, 0, 0, time.UTC), Count: 8},
	}, nil)
	s, err := uc.GetUserStats(ctx)
	if err != nil {
		t.Fatalf("GetUserStats: %v", err)
	}
	if s.Total != 42 || s.Blocked != 5 || len(s.ByRole) != 2 {
		t.Fatalf("unexpected stats: %+v", s)
	}
	if s.NewLast7d != 8 || s.ActiveLast7d != 20 || s.AvgDailyActive7d != 4.5 || len(s.RegistrationsByDay) != 1 {
		t.Fatalf("unexpected window stats: %+v", s)
	}
}
```
(If `pgtype` ends up unused after the rewrite, drop that import — it is listed only in case the existing file already needs it; the tests above do not require it.)

- [ ] **Step 3: Run the tests, expect FAIL (signatures changed / methods missing)**

Run: `cd "AP Backend" && go test ./internal/useCase/auth/ -run 'TestAdminListUsers|TestGetUserStats'`
Expected: FAIL (compile: `ListUsers` old signature, `GetUserStats`/`UsersFilter` undefined).

- [ ] **Step 4: Rewrite the use-case**

In `AP Backend/internal/useCase/auth/admin.go`:

(a) Add imports `"encoding/base64"`, `"strings"`, `"time"` (keep existing).

(b) Add the cursor helpers + sentinel (near the top of the file, after imports):

```go
// maxUUID sorts after any real UUID; used with cursorSentinelTime as the
// first-page keyset sentinel so one predicate (created_at,id) < (ts,id) works.
var maxUUID = uuid.Must(uuid.FromString("ffffffff-ffff-ffff-ffff-ffffffffffff"))

var cursorSentinelTime = time.Date(9999, 12, 31, 23, 59, 59, 0, time.UTC)

// encodeUserCursor packs a row's keyset position into an opaque token.
func encodeUserCursor(createdAt time.Time, id uuid.UUID) string {
	raw := createdAt.UTC().Format(time.RFC3339Nano) + "|" + id.String()
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

// decodeUserCursor returns the keyset position to page after. An empty or
// unparseable cursor yields the first-page sentinel (forgiving by design).
func decodeUserCursor(s string) (time.Time, uuid.UUID) {
	if s == "" {
		return cursorSentinelTime, maxUUID
	}
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return cursorSentinelTime, maxUUID
	}
	parts := strings.SplitN(string(b), "|", 2)
	if len(parts) != 2 {
		return cursorSentinelTime, maxUUID
	}
	ts, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return cursorSentinelTime, maxUUID
	}
	id, err := uuid.FromString(parts[1])
	if err != nil {
		return cursorSentinelTime, maxUUID
	}
	return ts, id
}
```

(c) REPLACE the entire existing `ListUsers` function with:

```go
// ListUsers returns a cursor (keyset) page of users filtered by search and role
// set, newest first. Requires PermUsersRead.
func (u *AuthUseCase) ListUsers(ctx context.Context, f userModel.UsersFilter) (userModel.UsersListResult, error) {
	if !rbac.HasPermissionInContext(ctx, rbac.PermUsersRead) {
		return userModel.UsersListResult{}, authModel.ErrInsufficientPermission.Err()
	}

	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	curTs, curID := decodeUserCursor(f.Cursor)
	roles := f.Roles
	if roles == nil {
		roles = []string{}
	}

	rows, err := u.repo.ListUsersCursor(ctx, postgres.ListUsersCursorParams{
		Search:          f.Search,
		Roles:           roles,
		CursorCreatedAt: curTs,
		CursorID:        curID,
		LimitVal:        limit + 1,
	})
	if err != nil {
		return userModel.UsersListResult{}, model.ErrPlatform.WithError(err).WithMessage("Failed to list users").Err()
	}

	hasMore := false
	if int32(len(rows)) > limit {
		hasMore = true
		rows = rows[:limit]
	}

	users := make([]userModel.UserInfo, 0, len(rows))
	for _, r := range rows {
		users = append(users, userModel.UserInfo{
			ID: r.ID, FirstName: r.FirstName, LastName: r.LastName, Picture: r.Picture,
			Email: r.Email, Role: r.Role, Status: r.Status, LastSeen: r.LastSeen, CreatedAt: r.CreatedAt,
		})
	}

	next := ""
	if hasMore && len(rows) > 0 {
		last := rows[len(rows)-1]
		next = encodeUserCursor(last.CreatedAt, last.ID)
	}
	return userModel.UsersListResult{Users: users, NextCursor: next, HasMore: hasMore}, nil
}
```

(d) Add `GetUserStats` (after `ListUsers`):

```go
// GetUserStats returns aggregate user counts + a 7-day window for the admin
// dashboard. Requires PermUsersRead.
func (u *AuthUseCase) GetUserStats(ctx context.Context) (userModel.UserStats, error) {
	if !rbac.HasPermissionInContext(ctx, rbac.PermUsersRead) {
		return userModel.UserStats{}, authModel.ErrInsufficientPermission.Err()
	}
	since := time.Now().AddDate(0, 0, -7)

	total, err := u.repo.CountUsers(ctx, "")
	if err != nil {
		return userModel.UserStats{}, model.ErrPlatform.WithError(err).WithMessage("Failed to count users").Err()
	}
	byRole, err := u.repo.CountUsersByRoleAll(ctx)
	if err != nil {
		return userModel.UserStats{}, model.ErrPlatform.WithError(err).WithMessage("Failed to count users by role").Err()
	}
	blocked, err := u.repo.CountUsersByStatus(ctx, userModel.UserStatusBlocked)
	if err != nil {
		return userModel.UserStats{}, model.ErrPlatform.WithError(err).WithMessage("Failed to count blocked users").Err()
	}
	newCount, err := u.repo.CountUsersCreatedSince(ctx, since)
	if err != nil {
		return userModel.UserStats{}, model.ErrPlatform.WithError(err).WithMessage("Failed to count new users").Err()
	}
	active, err := u.repo.CountUsersActiveSince(ctx, since)
	if err != nil {
		return userModel.UserStats{}, model.ErrPlatform.WithError(err).WithMessage("Failed to count active users").Err()
	}
	avgDAU, err := u.repo.AvgDailyActiveSince(ctx, since)
	if err != nil {
		return userModel.UserStats{}, model.ErrPlatform.WithError(err).WithMessage("Failed to average daily active").Err()
	}
	regByDay, err := u.repo.RegistrationsByDaySince(ctx, since)
	if err != nil {
		return userModel.UserStats{}, model.ErrPlatform.WithError(err).WithMessage("Failed to load registrations by day").Err()
	}

	stats := userModel.UserStats{
		Total:            total,
		Blocked:          blocked,
		NewLast7d:        newCount,
		ActiveLast7d:     active,
		AvgDailyActive7d: avgDAU,
		ByRole:           make([]userModel.RoleCount, 0, len(byRole)),
		RegistrationsByDay: make([]userModel.DayCount, 0, len(regByDay)),
	}
	for _, r := range byRole {
		stats.ByRole = append(stats.ByRole, userModel.RoleCount{Role: r.Role, Count: r.Count})
	}
	for _, d := range regByDay {
		stats.RegistrationsByDay = append(stats.RegistrationsByDay, userModel.DayCount{Day: d.Day, Count: d.Count})
	}
	return stats, nil
}
```

- [ ] **Step 5: Run the tests, expect PASS**

Run: `cd "AP Backend" && go test ./internal/useCase/auth/ -run 'TestAdminListUsers|TestGetUserStats'`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
cd "AP Backend"
git add internal/model/user/user.go internal/useCase/auth/admin.go internal/useCase/auth/admin_test.go
git commit -m "feat(users): cursor ListUsers + GetUserStats use-case

Keyset pagination (opaque base64 cursor, limit+1 HasMore, role-array filter)
and aggregate user stats (total/by-role/blocked).

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 3: Backend — handler (cursor list + stats endpoint)

**Files:**
- Modify: `AP Backend/internal/delivery/controller/http/handler/user/handler.go`
- Modify: `AP Backend/internal/delivery/controller/http/handler/user/handler_test.go`

**Interfaces:**
- Consumes: `(*AuthUseCase).ListUsers(ctx, userModel.UsersFilter)` + `GetUserStats(ctx)` from Task 2.
- Produces: `GET /api/users` (cursor) → `{Users, NextCursor, HasMore}`; `GET /api/users/stats` → `{Total, ByRole:[{Role,Count}], Blocked}`.

- [ ] **Step 1: Update the handler interface + DTOs**

In `internal/delivery/controller/http/handler/user/handler.go`:

(a) Change the `IUseCase` `ListUsers` line and add `GetUserStats`:
```go
		ListUsers(ctx context.Context, f userModel.UsersFilter) (userModel.UsersListResult, error)
		GetUserStats(ctx context.Context) (userModel.UserStats, error)
```

(b) Replace the `listUsersResponse` struct and add stats DTOs (in the `type (...)` block):
```go
	listUsersResponse struct {
		Users      []userResponse `json:"Users"`
		NextCursor string         `json:"NextCursor"`
		HasMore    bool           `json:"HasMore"`
	}

	roleCountResponse struct {
		Role  string `json:"Role"`
		Count int64  `json:"Count"`
	}
	dayCountResponse struct {
		Day   time.Time `json:"Day"`
		Count int64     `json:"Count"`
	}
	userStatsResponse struct {
		Total              int64               `json:"Total"`
		Blocked            int64               `json:"Blocked"`
		NewLast7d          int64               `json:"NewLast7d"`
		ActiveLast7d       int64               `json:"ActiveLast7d"`
		AvgDailyActive7d   float64             `json:"AvgDailyActive7d"`
		ByRole             []roleCountResponse `json:"ByRole"`
		RegistrationsByDay []dayCountResponse  `json:"RegistrationsByDay"`
	}
```
(`handler.go` already imports `"time"` from the earlier user-detail work.)

- [ ] **Step 2: Rewrite `listUsers` + add `getUserStats` + route**

(a) Replace the `listUsers` handler body with:
```go
func (h *Handler) listUsers(ctx *gin.Context) {
	if _, ok := rbac.UserIDFromContext(ctx.Request.Context()); !ok {
		response.AbortWithUnauthenticated(ctx)
		return
	}
	res, err := h.useCase.ListUsers(ctx.Request.Context(), userModel.UsersFilter{
		Search: ctx.Query("search"),
		Roles:  ctx.QueryArray("role"),
		Cursor: ctx.Query("cursor"),
		Limit:  parseInt32(ctx.Query("limit"), 50),
	})
	if err != nil {
		response.AbortWithError(ctx, err)
		return
	}
	out := listUsersResponse{Users: make([]userResponse, 0, len(res.Users)), NextCursor: res.NextCursor, HasMore: res.HasMore}
	for _, x := range res.Users {
		out.Users = append(out.Users, userResponse{
			ID: x.ID, FirstName: x.FirstName, LastName: x.LastName, Email: x.Email, Role: x.Role, Status: x.Status, CreatedAt: x.CreatedAt,
		})
	}
	response.AbortWithData(ctx, out)
}
```
(b) Add the stats handler (after `listUsers`):
```go
// getUserStats godoc
// @Summary  Aggregate user counts
// @Tags     users
// @Produce  json
// @Success  200  {object}  response.Response{data=userStatsResponse}
// @Router   /users/stats [get]
func (h *Handler) getUserStats(ctx *gin.Context) {
	s, err := h.useCase.GetUserStats(ctx.Request.Context())
	if err != nil {
		response.AbortWithError(ctx, err)
		return
	}
	out := userStatsResponse{
		Total: s.Total, Blocked: s.Blocked, NewLast7d: s.NewLast7d,
		ActiveLast7d: s.ActiveLast7d, AvgDailyActive7d: s.AvgDailyActive7d,
		ByRole:             make([]roleCountResponse, 0, len(s.ByRole)),
		RegistrationsByDay: make([]dayCountResponse, 0, len(s.RegistrationsByDay)),
	}
	for _, r := range s.ByRole {
		out.ByRole = append(out.ByRole, roleCountResponse{Role: r.Role, Count: r.Count})
	}
	for _, d := range s.RegistrationsByDay {
		out.RegistrationsByDay = append(out.RegistrationsByDay, dayCountResponse{Day: d.Day, Count: d.Count})
	}
	response.AbortWithData(ctx, out)
}
```
(c) In `Init`, register the stats route immediately AFTER the `users.GET("", ...)` line and BEFORE `users.GET(":userID", ...)`:
```go
	users.GET("stats", h.prot.RequirePermission(rbac.PermUsersRead), h.getUserStats)
```
(gin v1.12 resolves the static `stats` ahead of the `:userID` param. If `go test` panics with a route conflict, instead mount it as a sibling: in the aggregator `handler.go` add `secured.GET("user-stats", ...)` — but try the nested form first.)

- [ ] **Step 3: Update the handler test fake + list test; add a stats test**

In `internal/delivery/controller/http/handler/user/handler_test.go`:

(a) Update `fakeUC`: add fields `hasMore bool`, `nextCursor string`, `stats userModel.UserStats`; change `ListUsers` + add `GetUserStats`:
```go
func (f *fakeUC) ListUsers(_ context.Context, _ userModel.UsersFilter) (userModel.UsersListResult, error) {
	return userModel.UsersListResult{Users: f.users, NextCursor: f.nextCursor, HasMore: f.hasMore}, nil
}
func (f *fakeUC) GetUserStats(_ context.Context) (userModel.UserStats, error) {
	return f.stats, nil
}
```

(b) Replace `TestListUsers_Returns200`'s response decode + assertion. The decoded `Data` shape is now `{Users, NextCursor, HasMore}` (no `Total`):
```go
	var env struct {
		Data struct {
			Users []struct {
				Email string
			}
			NextCursor string
			HasMore    bool
		}
	}
	// ... unmarshal as before ...
	if len(env.Data.Users) != 1 || env.Data.Users[0].Email != "alice@test.test" {
		t.Fatalf("unexpected users: %+v", env.Data.Users)
	}
```
(Keep the rest of the test — the `fakeUC{users: [...], total: 1}` setup can drop `total`; set `hasMore: false`.)

(c) Add a stats route test:
```go
func TestUserStats_Returns200(t *testing.T) {
	uid := uuid.Must(uuid.NewV7())
	uc := &fakeUC{stats: userModel.UserStats{Total: 7, Blocked: 2, ByRole: []userModel.RoleCount{{Role: "admin", Count: 1}}}}
	r := newEngine(uc, uid)
	req := httptest.NewRequest(http.MethodGet, "/api/users/stats", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d body=%s", w.Code, w.Body.String())
	}
}
```
(`newEngine(uc, uid)` is the existing helper used by `TestListUsers_Returns200` — it mounts the user handler with an allow-all `fakeProt` and injects a super_admin identity, so `GetUserStats`'s `users.read` check passes.)

- [ ] **Step 4: Build + full suite**

Run: `cd "AP Backend" && go build ./... && go test ./...`
Expected: all `ok`. If the `users.GET("stats")` + `:userID` registration panics at route setup, apply the sibling-route fallback from Step 2c and re-run.

- [ ] **Step 5: Commit**

```bash
cd "AP Backend"
git add internal/delivery/controller/http/handler/user/
git commit -m "feat(users): cursor list endpoint + GET /users/stats

GET /api/users now returns {Users,NextCursor,HasMore} with search+role+cursor
params; GET /api/users/stats returns total/by-role/blocked counts.

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 4: Frontend — Users list (debounced search + role filter + infinite scroll)

**Files:**
- Modify: `admin-frontend/src/app/users/page.tsx`
- Modify: `admin-frontend/messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `apiGet`, `RoleBadge`/`StatusBadge`, `t`; the cursor list endpoint.
- Produces: the reworked `/users` page. `UserRow` type re-exported (dashboard no longer imports it after Task 5, but keep the export).

- [ ] **Step 1: Add i18n keys (en.json)**

```json
"admin.users.filterRoles": "Roles",
"admin.users.endOfList": "End of list",
"admin.users.loadingMore": "Loading more…"
```

- [ ] **Step 2: Add the same keys (uk.json)**

```json
"admin.users.filterRoles": "Ролі",
"admin.users.endOfList": "Кінець списку",
"admin.users.loadingMore": "Завантаження…"
```

- [ ] **Step 3: Rewrite `users/page.tsx`**

Replace the entire contents of `admin-frontend/src/app/users/page.tsx` with:

```tsx
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
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
  }, [buildQuery])

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
      <h1 className="mb-4 text-lg font-semibold text-foreground">{t("admin.users.title")}</h1>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("admin.users.search")}
        className="mb-3 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.users.filterRoles")}</span>
        {ROLES.map((r) => (
          <label key={r} className="flex items-center gap-1.5 text-sm text-foreground">
            <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} className="accent-primary" />
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
```

- [ ] **Step 4: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd admin-frontend
git add src/app/users/page.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): users list — debounced search, role filter, infinite scroll

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 5: Frontend — Dashboard from /users/stats

**Files:**
- Modify: `admin-frontend/src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `apiGet`, DS `Card*`, `t`; `GET /api/users/stats` (`{Total,Blocked,NewLast7d,ActiveLast7d,AvgDailyActive7d,ByRole,RegistrationsByDay}`).
- Produces: dashboard number cards + a basic 7-day registrations bar chart (no chart library), from the stats endpoint (no bulk user fetch).

- [ ] **Step 1: Add i18n keys (en.json)**

```json
"admin.dashboard.new7d": "New (7d)",
"admin.dashboard.active7d": "Active (7d)",
"admin.dashboard.avgDau": "Avg daily active",
"admin.dashboard.regChart": "Registrations (last 7 days)"
```

- [ ] **Step 2: Add the same keys (uk.json)**

```json
"admin.dashboard.new7d": "Нові (7д)",
"admin.dashboard.active7d": "Активні (7д)",
"admin.dashboard.avgDau": "Сер. активних/день",
"admin.dashboard.regChart": "Реєстрації (останні 7 днів)"
```

- [ ] **Step 3: Rewrite `dashboard/page.tsx`**

Replace the entire contents of `admin-frontend/src/app/dashboard/page.tsx` with:

```tsx
"use client"
import { useEffect, useState } from "react"
import { apiGet } from "@/api/client"
import { t } from "@/i18n/t"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

type RoleCount = { Role: string; Count: number }
type DayCount = { Day: string; Count: number }
type UserStats = {
  Total: number
  Blocked: number
  NewLast7d: number
  ActiveLast7d: number
  AvgDailyActive7d: number
  ByRole: RoleCount[]
  RegistrationsByDay: DayCount[]
}

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

// last7DayKeys returns [today-6 … today] as YYYY-MM-DD strings.
function last7DayKeys(): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export default function Page() {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiGet<UserStats>("/api/users/stats")
      .then((d) => { if (!cancelled) setStats(d) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Lay the (zero-or-more) registration days onto a fixed 7-day axis.
  const byDay = new Map<string, number>()
  ;(stats?.RegistrationsByDay ?? []).forEach((d) => byDay.set(d.Day.slice(0, 10), d.Count))
  const dayKeys = last7DayKeys()
  const counts = dayKeys.map((k) => byDay.get(k) ?? 0)
  const max = Math.max(1, ...counts)

  return (
    <div className="frost-in space-y-6">
      <h1 className="text-lg font-semibold text-foreground">{t("admin.dashboard.title")}</h1>
      {error ? (
        <p className="text-sm text-destructive">{t("admin.dashboard.loadError")}</p>
      ) : loading || !stats ? (
        <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t("admin.dashboard.totalUsers")} value={stats.Total} />
            <StatCard label={t("admin.dashboard.new7d")} value={stats.NewLast7d} />
            <StatCard label={t("admin.dashboard.active7d")} value={stats.ActiveLast7d} />
            <StatCard label={t("admin.dashboard.avgDau")} value={stats.AvgDailyActive7d.toFixed(1)} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("admin.dashboard.regChart")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-end gap-2">
                {dayKeys.map((k, i) => (
                  <div key={k} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-primary/70"
                        style={{ height: `${(counts[i] / max) * 100}%` }}
                        title={`${k}: ${counts[i]}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{k.slice(5)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0. (The `UserRow` import from `@/app/users/page` is gone — dashboard no longer depends on the users page.)

- [ ] **Step 5: Commit**

```bash
cd admin-frontend
git add src/app/dashboard/page.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): dashboard stats — total/new/active/avg-DAU + 7d reg chart

Reads /api/users/stats (cursor-list compatible); adds new/active/avg-daily
cards and a basic 7-day registrations bar chart.

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Self-Review

**Spec coverage:**
- Cursor keyset list (order, opaque cursor, sentinel first page, limit+1 HasMore) → Task 1 (query) + Task 2 (use-case encode/decode).
- Multi-role filter (`role = ANY`) + search → Task 1 query + Task 2/3 plumbing; UI checkboxes → Task 4.
- Debounced search → Task 4 (300ms). Infinite scroll (IntersectionObserver, append, reset on filter change) → Task 4.
- `GET /api/users/stats` (total/blocked/by-role + 7-day new/active/avg-DAU + registrations-by-day) → Task 1 (4 window queries: created-since, active-since, avg-daily-active from sessions, registrations-by-day) + Task 2 (`GetUserStats` computes `since = now-7d`) + Task 3 (DTO). Dashboard number cards + 7-day bar chart → Task 5.
- Offset removed for users → Task 1 (drops `ListUsers`), Task 2/3 (new signature). Logs offset untouched (out of scope) — not modified by any task.

**Placeholder scan:** No TBD/TODO. The two conditional notes (Docker-less sqlc → BLOCKED; gin route-conflict fallback) are concrete. The handler-test note (reuse the existing router/protector helper) names exactly what to mirror.

**Type consistency:** `UsersFilter{Search,Roles,Cursor,Limit}` / `UsersListResult{Users,NextCursor,HasMore}` / `UserStats{Total,Blocked,ByRole []RoleCount}` / `RoleCount{Role,Count}` are defined in Task 2 Step 1 and used identically in Tasks 2–3. The generated `ListUsersCursorParams` field names (`Search,Roles,CursorCreatedAt,CursorID,LimitVal`) in Task 1 match the use-case construction in Task 2. Frontend `ListResp{Users,NextCursor,HasMore}` (Task 4) and `UserStats{Total,Blocked,ByRole}` (Task 5) match the Task-3 JSON DTOs (PascalCase). `UserRow` fields match `userResponse`.
