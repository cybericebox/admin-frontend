# Handler-Layer Refactor (AP Backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the HTTP handler layer with no behavior change — relocate misplaced helpers (+ dedup the protection middleware), split the 1001-line auth handler into concern files, and give the notification package a single hierarchical aggregator.

**Architecture:** Pure refactor. Part C extracts `rbac.PermissionStrings` + a `pkg/tools/url.go` URL util used by both the auth handler and `protection.ValidateRequestDomain` (one source of truth). Part B splits `auth/handler.go` into files within `package auth`. Part A replaces per-child notification wiring in the top handler with one `notification.Handler` that aggregates its sub-handlers.

**Tech Stack:** Go 1.26, gin.

## Global Constraints

- Repo & branch (no new branch): `AP Backend@feature/backend-frontend-proxy`. All commands from inside `/Users/volodymyrporokhniak/Projects/My/CyberICEBox/AP Backend`.
- Commit footer on every commit: `Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7`
- **No route, response, or status-code change anywhere.** This is a pure refactor; `go build ./... && go test ./...` (353 tests) must stay green after every task.
- After moving code between files, resolve imports per file with `goimports -w <file>` (or fix the `go build` unused/missing-import errors); Go rejects unused imports.
- Sequence: Task 1 (Part C) → Task 2 (Part B) → Task 3 (Part A).

---

## Task 1: Part C — relocate helpers + dedup protection

**Files:**
- Modify: `internal/model/rbac/permission.go`, `internal/model/rbac/permission_test.go`
- Create: `pkg/tools/url.go`, `pkg/tools/url_test.go`
- Modify: `internal/delivery/controller/http/handler/auth/handler.go`
- Modify: `internal/delivery/controller/http/handler/auth/authorize.go`
- Modify: `internal/delivery/controller/http/protection/protection.go`

**Interfaces:**
- Produces: `rbac.PermissionStrings(role rbac.Role) []string`; `tools.PathOf(rawURL string) string`, `tools.HostFromURL(rawURL string) string`, `tools.SubdomainOfHost(host, apex string) (string, bool)`.
- The auth handler's local `permissionsForRole`/`pathOf` are deleted; `subdomainFromURL` becomes a thin wrapper. `protection.ValidateRequestDomain` uses `tools.SubdomainOfHost`.

- [ ] **Step 1: Write the failing tests**

Append to `internal/model/rbac/permission_test.go`:
```go
func TestPermissionStrings(t *testing.T) {
	contains := func(xs []string, want string) bool {
		for _, x := range xs {
			if x == want {
				return true
			}
		}
		return false
	}
	if s := PermissionStrings(RoleSuperAdmin); len(s) != 1 || s[0] != "*" {
		t.Fatalf("super_admin want [*], got %v", s)
	}
	a := PermissionStrings(RoleAdmin)
	if !contains(a, "users") || !contains(a, "notifications.self") || contains(a, "platform.settings") {
		t.Fatalf("admin perms wrong: %v", a)
	}
	if s := PermissionStrings(RoleUser); len(s) != 1 || s[0] != "notifications.self" {
		t.Fatalf("user want [notifications.self], got %v", s)
	}
	if len(PermissionStrings("nonsense")) != 0 {
		t.Fatalf("unknown role should hold nothing")
	}
}
```

Create `pkg/tools/url_test.go`:
```go
package tools

import "testing"

func TestPathOf(t *testing.T) {
	cases := map[string]string{
		"https://id.example.test/sign-in?x=1": "/sign-in",
		"https://example.test":                "/",
		"::bad::":                             "/",
		"":                                    "/",
	}
	for in, want := range cases {
		if got := PathOf(in); got != want {
			t.Errorf("PathOf(%q)=%q want %q", in, got, want)
		}
	}
}

func TestHostFromURL(t *testing.T) {
	cases := map[string]string{
		"https://ID.Example.test/x": "id.example.test",
		"https://example.test.:443": "example.test",
		"https://a.b.example.test":  "a.b.example.test",
		"no-scheme/x":               "",
	}
	for in, want := range cases {
		if got := HostFromURL(in); got != want {
			t.Errorf("HostFromURL(%q)=%q want %q", in, got, want)
		}
	}
}

func TestSubdomainOfHost(t *testing.T) {
	apex := "example.test"
	type R struct {
		sub string
		ok  bool
	}
	cases := map[string]R{
		"example.test":        {"", true},        // apex itself
		"id.example.test":     {"id", true},      // single label
		"a.b.example.test":    {"a.b", true},     // multi-label
		"evilexample.test":    {"", false},       // sibling, not a subdomain
		"other.test":          {"", false},       // off-platform
	}
	for host, want := range cases {
		sub, ok := SubdomainOfHost(host, apex)
		if sub != want.sub || ok != want.ok {
			t.Errorf("SubdomainOfHost(%q)=(%q,%v) want (%q,%v)", host, sub, ok, want.sub, want.ok)
		}
	}
}
```

- [ ] **Step 2: Run the tests, expect FAIL (functions undefined)**

Run: `go test ./internal/model/rbac/ ./pkg/tools/`
Expected: FAIL — `PermissionStrings`/`PathOf`/`HostFromURL`/`SubdomainOfHost` undefined.

- [ ] **Step 3: Add `rbac.PermissionStrings`**

In `internal/model/rbac/permission.go`, add (after the existing `Permissions` function):
```go
// PermissionStrings returns the held permission set for a role as plain strings,
// for the API to expose to clients. Mirrors Permissions.
func PermissionStrings(role Role) []string {
	held := Permissions(role)
	out := make([]string, 0, len(held))
	for _, p := range held {
		out = append(out, string(p))
	}
	return out
}
```

- [ ] **Step 4: Create `pkg/tools/url.go`**

```go
package tools

import (
	"net/url"
	"strings"
)

// PathOf returns rawURL's path component, or "/" when unparseable or empty.
func PathOf(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Path == "" {
		return "/"
	}
	return parsed.Path
}

// HostFromURL returns the lowercased host of a scheme://host/... URL with any
// trailing dot and port stripped. Returns "" when rawURL has no scheme.
func HostFromURL(rawURL string) string {
	idx := strings.Index(rawURL, "://")
	if idx < 0 {
		return ""
	}
	host := strings.ToLower(rawURL[idx+3:])
	if i := strings.Index(host, "/"); i >= 0 {
		host = host[:i]
	}
	host = strings.TrimSuffix(host, ".")
	if i := strings.LastIndex(host, ":"); i >= 0 {
		host = host[:i]
	}
	return host
}

// SubdomainOfHost returns the subdomain label(s) of host under apex. ok is false
// when host is neither the apex nor under it (off-platform). The apex itself
// returns ("", true); a host under the apex returns (label(s), true). Anchored on
// the dot before the apex so a sibling like "evilexample.test" is NOT read as a
// subdomain of "example.test".
func SubdomainOfHost(host, apex string) (string, bool) {
	if host == apex {
		return "", true
	}
	suffix := "." + apex
	if !strings.HasSuffix(host, suffix) {
		return "", false
	}
	return strings.TrimSuffix(host, suffix), true
}
```

- [ ] **Step 5: Run the tests, expect PASS**

Run: `go test ./internal/model/rbac/ ./pkg/tools/`
Expected: PASS.

- [ ] **Step 6: Rewire the auth handler + delete the local helpers**

In `internal/delivery/controller/http/handler/auth/handler.go`:
(a) Add the import `tools "github.com/cybericebox/daemon/pkg/tools"`.
(b) Delete the `permissionsForRole` function. Change its caller (in `getSelfProfile`, the `meResponse{...}` literal) from `Permissions: permissionsForRole(p.Role),` to `Permissions: rbac.PermissionStrings(rbac.Role(p.Role)),`.
(c) Delete the `pathOf` function. Change its callers: the `CreateSSOExchange(..., pathOf(redirect))` call → `tools.PathOf(redirect)`.
(d) Replace the `subdomainFromURL` method body with a thin wrapper (keep the method — it is called via `h.subdomainFromURL(...)` in several places):
```go
// subdomainFromURL extracts the target subdomain from a full URL using the apex
// domain. Off-platform/apex URLs yield "" (the routing callers treat "" as root).
func (h *Handler) subdomainFromURL(rawURL string) string {
	sub, _ := tools.SubdomainOfHost(tools.HostFromURL(rawURL), h.domain)
	return sub
}
```
(e) In `internal/delivery/controller/http/handler/auth/authorize.go`, change `pathOf(returnTo)` → `tools.PathOf(returnTo)` and add the `tools` import (if `authorize.go` doesn't already import it).
(f) Run `goimports -w internal/delivery/controller/http/handler/auth/handler.go internal/delivery/controller/http/handler/auth/authorize.go` to drop now-unused imports (`net/url` if `pathOf` was its only user; `strings` if `subdomainFromURL` was its only user). If `goimports` isn't installed, `go build ./...` will name the unused imports — remove them by hand.

- [ ] **Step 7: Dedup `protection.ValidateRequestDomain`**

In `internal/delivery/controller/http/protection/protection.go`, replace the body of `ValidateRequestDomain` with:
```go
func (p *Protection) ValidateRequestDomain(ctx *gin.Context) {
	host := hostWithoutPort(ctx.Request.Host)
	subdomain, ok := tools.SubdomainOfHost(host, p.domain)
	if !ok {
		response.AbortWithNotFound(ctx)
		return
	}
	ctx.Set(config.SubdomainCtxKey, subdomain)
	ctx.Next()
}
```
Add the import `tools "github.com/cybericebox/daemon/pkg/tools"`. Run `goimports -w` on the file (the inline `strings.HasSuffix`/`TrimSuffix` removal may make `strings` unused here — but `strings` is used elsewhere in the file, so it stays; goimports settles it).

- [ ] **Step 8: Build + full suite**

Run: `go build ./... && go test ./...`
Expected: all `ok`. (rbac, pkg/tools, protection, and auth-handler tests all pass; behavior unchanged.)

- [ ] **Step 9: Commit**

```bash
git add internal/model/rbac/ pkg/tools/ internal/delivery/controller/http/handler/auth/handler.go internal/delivery/controller/http/handler/auth/authorize.go internal/delivery/controller/http/protection/protection.go
git commit -m "refactor: relocate auth helpers (rbac.PermissionStrings, pkg/tools/url) + dedup ValidateRequestDomain

permissionsForRole -> rbac.PermissionStrings; pathOf/host/subdomain -> pkg/tools/url;
protection.ValidateRequestDomain and the auth handler share one SubdomainOfHost.

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 2: Part B — split `auth/handler.go` into concern files

**Files:**
- Modify: `internal/delivery/controller/http/handler/auth/handler.go`
- Create: `internal/delivery/controller/http/handler/auth/{signin,signup,password,account,avatar,google}.go`

**Interfaces:**
- Consumes: the Task-1 state of `handler.go` (with `rbac.PermissionStrings`/`tools.*` already wired). No signature changes — this is a pure file move; `Handler`, `Init`, `IUseCase`, `IProtection`, `NewAuthAPIHandler` all stay in `handler.go`.

This task moves methods + their exclusively-used DTO types out of `handler.go` into new files in the same `package auth`. Each new file starts with `package auth` and its own imports (resolved by `goimports`). NOTHING about routing or behavior changes; `Init` in `handler.go` keeps referencing the same method names (now defined in sibling files).

- [ ] **Step 1: Create `signin.go`**

Move from `handler.go` into a new `internal/delivery/controller/http/handler/auth/signin.go` (`package auth`):
- Methods: `signIn`, `refresh`, `listSessions`, `revokeSession`, `revokeOtherSessions`.
- Helper: `toSessionResponse`.
- DTO types: `signInRequest`, `sessionResponse`.

- [ ] **Step 2: Create `signup.go`**

Move into `auth/signup.go`:
- Methods: `signUp`, `getSetup`, `completeSetup`.
- DTO types: `signUpRequest`, `completeRegistrationRequest`, `setupContextResponse`.

- [ ] **Step 3: Create `password.go`**

Move into `auth/password.go`:
- Methods: `forgotPassword`, `resetPassword`, `changePassword`.
- DTO types: `forgotPasswordRequest`, `resetPasswordRequest`, `changePasswordRequest`.

- [ ] **Step 4: Create `account.go`**

Move into `auth/account.go`:
- Methods: `getAccount`, `getSelfProfile`, `updateProfile`, `requestEmailChange`, `confirmEmailChange`, `deleteAccount`.
- DTO types: `accountResponse`, `updateProfileRequest`, `requestEmailChangeRequest`, `confirmEmailChangeRequest`, `meResponse`.

- [ ] **Step 5: Create `avatar.go`**

Move into `auth/avatar.go`:
- Methods: `uploadAvatar`, `removeAvatar`, `getAvatar`. (No DTO types — raw multipart / id param.)

- [ ] **Step 6: Create `google.go`**

Move into `auth/google.go`:
- Methods: `googleRedirect`, `googleRegisterRedirect`, `googleSetupRedirect`, `googleCallback`, `googleLinkRedirect`, `unlinkGoogle`, `googleErrorRedirect`.
- Constants: the oauth cookie consts (`oauthIntentCookie`, `oauthSetupTokenCookie`, `oauthStateCookie`, `oauthLinkSessionCookie`, `oauthCookieMaxAge`).

After Steps 1–6, `handler.go` retains ONLY: the `oauth*`-unrelated imports it still needs, the `Handler` struct, `IUseCase`, `IProtection`, `NewAuthAPIHandler`, `Init`, and the `subdomainFromURL` wrapper method (shared by `Init`-mounted handlers across files).

- [ ] **Step 7: Resolve imports for every file**

Run: `goimports -w internal/delivery/controller/http/handler/auth/*.go`
(If `goimports` is unavailable, run `go build ./internal/delivery/controller/http/handler/auth/` and add/remove imports per the compiler errors until it builds.)

- [ ] **Step 8: Build + full suite**

Run: `go build ./... && go test ./...`
Expected: all `ok`. The auth handler tests pass unchanged — the routes and methods are identical, only their file location moved.

- [ ] **Step 9: Commit**

```bash
git add internal/delivery/controller/http/handler/auth/
git commit -m "refactor(auth): split handler.go into concern files (signin/signup/password/account/avatar/google)

Pure move — package auth methods + their DTOs distributed across files; handler.go
keeps the struct, Init, interfaces, and shared wrapper. No route/behavior change.

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 3: Part A — notification hierarchical aggregator

**Files:**
- Overwrite: `internal/delivery/controller/http/handler/notification/handler.go` (the uncommitted draft)
- Modify: `internal/delivery/controller/http/handler/handler.go`

**Interfaces:**
- Produces: `notification.Handler` with `notification.IUseCase` (union of inbox/template/settings/test/stats use-cases), `NewNotificationsAPIHandler(useCase IUseCase, prot IProtection)`, `Init(secured *gin.RouterGroup)`.
- Consumes: the existing child handlers' `New…APIHandler` + `Init(router *gin.RouterGroup)` (unchanged): `inbox.NewInboxAPIHandler(useCase, prot)`, `template.NewTemplateAPIHandler(useCase, prot)`, `settings.NewSettingsAPIHandler(useCase, prot)`, `catalog.NewCatalogAPIHandler(prot)`, `test.NewTestAPIHandler(useCase, prot)`, `stats.NewStatsAPIHandler(useCase, prot)`.

- [ ] **Step 1: Write the real notification aggregator**

Replace the entire contents of `internal/delivery/controller/http/handler/notification/handler.go` with:
```go
package notification

import (
	"github.com/gin-gonic/gin"

	"github.com/cybericebox/daemon/internal/delivery/controller/http/handler/notification/catalog"
	"github.com/cybericebox/daemon/internal/delivery/controller/http/handler/notification/inbox"
	notificationSettings "github.com/cybericebox/daemon/internal/delivery/controller/http/handler/notification/settings"
	statsHandler "github.com/cybericebox/daemon/internal/delivery/controller/http/handler/notification/stats"
	"github.com/cybericebox/daemon/internal/delivery/controller/http/handler/notification/template"
	testHandler "github.com/cybericebox/daemon/internal/delivery/controller/http/handler/notification/test"
	"github.com/cybericebox/daemon/internal/model/rbac"
)

type (
	// Handler aggregates the notification sub-handlers (inbox, templates, global
	// settings, catalog, test, stats) behind one Init + one use-case interface.
	Handler struct {
		useCase IUseCase
		prot    IProtection
	}

	// IUseCase is the union of the notification children that need a use-case
	// (catalog needs none).
	IUseCase interface {
		inbox.IUseCase
		template.IUseCase
		notificationSettings.IUseCase
		testHandler.IUseCase
		statsHandler.IUseCase
	}

	// IProtection is the subset of the protection middleware this handler needs.
	IProtection interface {
		RequirePermission(required rbac.Permission) gin.HandlerFunc
	}
)

func NewNotificationsAPIHandler(useCase IUseCase, prot IProtection) *Handler {
	return &Handler{useCase: useCase, prot: prot}
}

// Init mounts the notifications API under <secured>/notifications.
func (h *Handler) Init(secured *gin.RouterGroup) {
	notifications := secured.Group("notifications")
	inbox.NewInboxAPIHandler(h.useCase, h.prot).Init(notifications)
	template.NewTemplateAPIHandler(h.useCase, h.prot).Init(notifications)
	notificationSettings.NewSettingsAPIHandler(h.useCase, h.prot).Init(notifications)
	catalog.NewCatalogAPIHandler(h.prot).Init(notifications)
	testHandler.NewTestAPIHandler(h.useCase, h.prot).Init(notifications)
	statsHandler.NewStatsAPIHandler(h.useCase, h.prot).Init(notifications)
}
```

- [ ] **Step 2: Rewire the top-level handler**

In `internal/delivery/controller/http/handler/handler.go`:
(a) Imports: remove the six notification-child imports (`catalog`, `inbox`, `notificationSettings`/settings, `statsHandler`/stats, `template`, `testHandler`/test); add `"github.com/cybericebox/daemon/internal/delivery/controller/http/handler/notification"`.
(b) In the `IUseCase` interface, replace the five notification-child entries
```go
		inbox.IUseCase
		template.IUseCase
		notificationSettings.IUseCase
		testHandler.IUseCase
		statsHandler.IUseCase
```
with a single:
```go
		notification.IUseCase
```
(keep `authHandler.IUseCase`, `platformSettings.IUseCase`, `user.IUseCase`).
(c) In `Init`, replace the block:
```go
		notifications := secured.Group("notifications")
		inbox.NewInboxAPIHandler(h.useCase, h.prot).Init(notifications)
		template.NewTemplateAPIHandler(h.useCase, h.prot).Init(notifications)
		notificationSettings.NewSettingsAPIHandler(h.useCase, h.prot).Init(notifications)
		catalog.NewCatalogAPIHandler(h.prot).Init(notifications)
		testHandler.NewTestAPIHandler(h.useCase, h.prot).Init(notifications)
		statsHandler.NewStatsAPIHandler(h.useCase, h.prot).Init(notifications)
```
with a single call:
```go
		notification.NewNotificationsAPIHandler(h.useCase, h.prot).Init(secured)
```

- [ ] **Step 3: Build + full suite**

Run: `go build ./... && go test ./...`
Expected: all `ok`. The aggregate use-case (`internal/useCase/useCase.go`) already satisfies `notification.IUseCase` (it embeds the inbox/settings/template/test/stats use-cases that the top handler's union already required). The `notifications` routes are mounted identically (same group, same children, same order), so the proxy/handler tests pass unchanged.

- [ ] **Step 4: Commit**

```bash
git add internal/delivery/controller/http/handler/notification/handler.go internal/delivery/controller/http/handler/handler.go
git commit -m "refactor(notifications): single hierarchical aggregator handler

The notification package now owns a Handler that aggregates its sub-handlers and
exposes one Init + one IUseCase; the top handler delegates with a single call
instead of wiring each child. Routes unchanged.

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Self-Review

**Spec coverage:**
- Part A (notification aggregator: single Handler, union IUseCase, Init owning the `notifications` group; top handler delegates) → Task 3.
- Part B (auth split into signin/signup/password/account/avatar/google within `package auth`; handler.go keeps struct/Init/interfaces/shared wrapper) → Task 2, with the exact method+DTO mapping.
- Part C (`permissionsForRole`→`rbac.PermissionStrings`; `pathOf`/`HostFromURL`/`SubdomainOfHost`→`pkg/tools/url.go`; `subdomainFromURL` thin wrapper; `protection.ValidateRequestDomain` dedup via `SubdomainOfHost` with `(string,bool)`) → Task 1.
- Testing (focused unit tests for the new pure funcs; full suite green; no behavior change) → Task 1 Steps 1/2/5/8, Task 2 Step 8, Task 3 Step 3.
- Build order (C → B → A) → task order.

**Placeholder scan:** No TBD/TODO. Task 2 is a move specified by exact symbol→file mapping; its "complete code" is the existing handler bodies (verbatim, unchanged) — the plan names every symbol's destination, and `goimports`+`go build`+the full suite verify correctness. The contingency notes (goimports absent → fix via `go build` errors) are concrete.

**Type consistency:** `SubdomainOfHost(host, apex) (string, bool)` is defined in Task 1 Step 4 and consumed in Task 1 Steps 6/7 (handler wrapper ignores `ok`; protection rejects on `!ok`). `rbac.PermissionStrings(role Role) []string` defined Task 1 Step 3, consumed Step 6. `notification.IUseCase`/`NewNotificationsAPIHandler`/`Init(secured *gin.RouterGroup)` defined Task 3 Step 1, consumed Task 3 Step 2. The child `New…APIHandler(useCase, prot)` + `Init(router *gin.RouterGroup)` signatures match the verified current code; `prot` typed `notification.IProtection` (method set `RequirePermission`) satisfies each child's `IProtection` (same method).
