# Handler-Layer Refactor (AP Backend) — Design

**Date:** 2026-06-28
**Repo:** `AP Backend`
**Status:** Approved — ready for implementation planning

## Goal

Refactor the HTTP delivery/handler layer for clarity and single-source-of-truth,
with no change to routes or behavior:

1. **Notification — hierarchical aggregator.** The `notification` package gets a
   single `Handler` that aggregates its sub-handlers and exposes one interface +
   one `Init`, instead of the top-level handler initializing each sub-handler
   individually.
2. **Auth — split the 1001-line `handler.go`** into concern files within
   `package auth` (mirroring the already-split use-case layer).
3. **Relocate misplaced helpers** out of the auth handler into their proper
   homes (`rbac`, a shared URL util), removing a duplicated host→subdomain
   computation shared with the protection middleware.

This is a pure structural refactor: every route, response, and status code stays
identical; the full test suite (currently 353 tests) must remain green.

## Part A — Notification: hierarchical aggregator

Today the top-level `handler.go` reaches into the notification sub-packages and
wires each one (`inbox`, `template`, `settings`, `catalog`, `test`, `stats`)
under a `notifications` group. A draft `notification/handler.go` exists but is a
non-compiling copy of the top handler.

**Target:** a real `notification.Handler` that owns its children.

- `internal/delivery/controller/http/handler/notification/handler.go`:
  - `Handler struct { useCase IUseCase; prot IProtection }`.
  - `IUseCase` = the union of ONLY the notification children that need a use-case:
    `inbox.IUseCase`, `template.IUseCase`, `settings.IUseCase` (notification
    settings), `test.IUseCase`, `stats.IUseCase`. (`catalog` has no use-case.)
    No `auth`/`user`/`platformSettings` (those are siblings, not children).
  - `IProtection interface { RequirePermission(rbac.Permission) gin.HandlerFunc }`.
  - `NewNotificationsAPIHandler(useCase IUseCase, prot IProtection) *Handler`.
  - `Init(secured *gin.RouterGroup)`: creates `notifications := secured.Group("notifications")`
    and calls each child's `Init(notifications)` — `inbox`, `template`,
    `settings`, `catalog`, `test`, `stats`. The notification module owns the
    `"notifications"` group name.
- Top-level `handler.go`:
  - The six child-init lines + the `notifications` group collapse to one call:
    `notification.NewNotificationsAPIHandler(h.useCase, h.prot).Init(secured)`.
  - The top `IUseCase` union replaces the five notification-child interfaces with
    `notification.IUseCase`.
  - Imports drop the six notification children; add `notification`.

The result: the notification module aggregates itself and exposes a single
interface outward; the top handler no longer knows the notification internals.

## Part B — Auth: split `handler.go` into concern files

`auth/handler.go` is 1001 lines holding ~30 handler methods. Split it across
files within `package auth` (Go allows a package's methods across files; this is
idiomatic and mirrors the use-case layer's existing `signin.go`/`account.go`/…).

- `handler.go` — `Handler` struct, `Init`, `NewAuthAPIHandler`, `IUseCase`,
  `IProtection`, and DTOs/helpers shared across files.
- `signin.go` — `signIn`, `refresh`, `listSessions`, `revokeSession`,
  `revokeOtherSessions`, `toSessionResponse` + their DTOs.
- `signup.go` — `signUp`, `getSetup`, `completeSetup`.
- `password.go` — `forgotPassword`, `resetPassword`, `changePassword`.
- `account.go` — `getAccount`, `getSelfProfile`, `updateProfile`,
  `requestEmailChange`, `confirmEmailChange`, `deleteAccount` + their DTOs.
- `avatar.go` — `uploadAvatar`, `removeAvatar`, `getAvatar`.
- `google.go` — `googleRedirect`, `googleRegisterRedirect`, `googleSetupRedirect`,
  `googleCallback`, `googleLinkRedirect`, `unlinkGoogle`, `googleErrorRedirect`.
- `authorize.go`, `silent.go` — already extracted; unchanged.

Each handler method moves together with the request/response DTO types it uses
exclusively; types used by more than one file stay in `handler.go`. Pure move —
no logic change.

## Part C — Relocate misplaced helpers

Three helpers currently live in `auth/handler.go` but belong elsewhere:

1. **`permissionsForRole(role string) []string`** is just
   `rbac.Permissions(rbac.Role(role))` stringified — pure RBAC logic. Move it to
   the `rbac` package as `PermissionStrings(role Role) []string`. The `/me`
   handler (`getSelfProfile`) calls `rbac.PermissionStrings(rbac.Role(p.Role))`.

2. **URL helpers + the duplicated host→subdomain logic.** `pathOf` is a stateless
   URL helper; `subdomainFromURL` (a `*Handler` method using `h.domain`)
   re-implements the same host-minus-apex extraction as
   `protection.ValidateRequestDomain` — the code comment explicitly notes both
   "must agree." Extract a single source of truth:
   - New `pkg/tools/url.go`:
     - `PathOf(rawURL string) string` — parse, return path or `"/"`.
     - `HostFromURL(rawURL string) string` — lowercased host from a `scheme://host/…`
       URL (strip trailing dot + port); `""` if no scheme.
     - `SubdomainOfHost(host, apex string) (sub string, ok bool)` — `ok=false`
       when host is neither the apex nor under it (off-platform); apex itself →
       `("", true)`; under the apex → `(label(s), true)`.
   - `auth` uses them: `pathOf` → `tools.PathOf`; the handler method
     `subdomainFromURL(rawURL)` becomes a thin wrapper returning
     `sub` from `tools.SubdomainOfHost(tools.HostFromURL(rawURL), h.domain)`
     (ignoring `ok`, preserving today's behavior: off-platform/apex → `""`).
   - `protection.ValidateRequestDomain` uses `SubdomainOfHost(host, p.domain)`:
     reject on `!ok`, otherwise store `sub` as the context subdomain. The
     duplicated extraction is deleted from the middleware.

`toSessionResponse` is a handler-specific DTO mapper and stays with the session
handlers (`signin.go`).

## Testing

Pure refactor → behavior unchanged. After each part, `go build ./...` and
`go test ./...` must be green. The `SubdomainOfHost` extraction gets focused unit
tests (apex, under-domain, multi-label subdomain, off-platform, port, trailing
dot). The notification aggregator and auth split are exercised by the existing
handler tests + the full suite (routes/responses identical).

## Scope

In: notification aggregator, auth file split, the three helper relocations +
protection dedup. Out: `user/handler.go` (359 lines) — fine as-is for now;
no route or use-case changes anywhere.

## Build order

1. Part C util + rbac (foundation the auth split will reference) →
2. Part B auth split (consumes the relocated helpers) →
3. Part A notification aggregator (independent; can be first or last).

Each part is independently buildable + testable; one implementation plan,
sequenced as above.
