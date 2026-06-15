/**
 * src/lib/auth.ts — Shared Design-System auth-state client helpers.
 *
 * COPY-TO-RP-APPS: This module is app-agnostic and static-export-safe.
 * Copy it verbatim into any Relying-Party (RP) frontend (e.g. main-frontend)
 * as part of the DS sync procedure (see README).
 *
 * Usage on id-frontend (the Authorization Server):
 *   - Only `fetchMe` / `Me` are used here (against /api/account — see profile/page.tsx).
 *   - The silent-authn helpers (attemptSilentAuthn, anon-marker, consumeNoSessionParam)
 *     are NOT called from id's own pages — id is the AS; 401 → /sign-in directly.
 *   - These helpers are authored here so main-frontend (task F3.2/F3.3) can copy them.
 *
 * No JSX — plain TypeScript; safe to import without 'use client' propagation issues.
 */

import { apiGet, ApiError } from "@/api/client"

// ---------------------------------------------------------------------------
// /me — identity object returned by the RP's /api/me endpoint.
// On id itself the equivalent is /api/account (different shape), but RP apps
// expose /api/me as a lightweight signed-in check.
// ---------------------------------------------------------------------------

export interface Me {
  FirstName: string
  LastName: string
  Email: string
  Role: string
  Avatar?: string
}

/**
 * fetchMe — GET /api/me with credentials included.
 *
 * Returns the `Me` object on 200 (signed in), or `null` on 401 (no session).
 * Throws only on unexpected errors (5xx, network failures, etc.).
 *
 * DS NOTE: RP apps call this on every page load to determine auth state.
 * Pair with `attemptSilentAuthn` / `consumeNoSessionParam` for seamless SSO.
 */
export async function fetchMe(): Promise<Me | null> {
  try {
    return await apiGet<Me>("/api/me")
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return null
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Anon-marker cookie helpers
//
// After a silent-authn bounce back with ?no_session=1, RP apps set a short-lived
// cookie ("anon") to suppress an infinite redirect/blink storm.  The cookie is
// non-HttpOnly (JS-readable) and expires in ~5 minutes by default.
// ---------------------------------------------------------------------------

const ANON_COOKIE = "anon"

/**
 * hasAnonMarker — returns true if the "anon" marker cookie is present.
 *
 * Guards `typeof document` so this module can be imported in SSR/static contexts
 * without throwing (Next.js static export safety).
 */
export function hasAnonMarker(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${ANON_COOKIE}=`))
}

/**
 * setAnonMarker — writes the "anon" cookie with a short max-age (default 300 s).
 *
 * SameSite=Lax is intentional: the cookie must survive the top-level redirect
 * back from id.<domain> to the RP origin.
 */
export function setAnonMarker(maxAgeSeconds = 300): void {
  if (typeof document === "undefined") return
  document.cookie = `${ANON_COOKIE}=1; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`
}

/**
 * clearAnonMarker — removes the "anon" cookie immediately (max-age=0).
 */
export function clearAnonMarker(): void {
  if (typeof document === "undefined") return
  document.cookie = `${ANON_COOKIE}=; max-age=0; path=/; SameSite=Lax`
}

// ---------------------------------------------------------------------------
// Silent authentication (prompt=none)
// ---------------------------------------------------------------------------

/**
 * attemptSilentAuthn — initiates a prompt=none top-level redirect to the AS.
 *
 * Call this from an RP app when:
 *   - fetchMe() returned null  (no local session), AND
 *   - hasAnonMarker() is false (no recent "definitely anon" signal)
 *
 * The AS (id.<domain>) will either:
 *   a) find an existing master session → issue the RP local token and redirect
 *      back to `returnTo` (or current URL) — the user arrives signed in silently.
 *   b) have no master session → redirect back to `returnTo` with ?no_session=1.
 *      The RP should then call consumeNoSessionParam() and render signed-out UI.
 *
 * DS NOTE: Do NOT call this from id's own pages — id is the AS.
 *
 * @param opts.idOrigin   Base URL of the identity server, e.g. "https://id.example.com".
 *                        Defaults to NEXT_PUBLIC_ID_ORIGIN env var, then "".
 * @param opts.returnTo   URL the AS should redirect back to. Defaults to current page URL.
 */
export function attemptSilentAuthn(opts: {
  idOrigin?: string
  returnTo?: string
}): void {
  if (typeof window === "undefined") return

  const idOrigin =
    opts.idOrigin ??
    process.env.NEXT_PUBLIC_ID_ORIGIN ??
    ""

  const returnTo = opts.returnTo ?? window.location.href

  const url = new URL("/api/auth/authorize", idOrigin || window.location.origin)
  url.searchParams.set("prompt", "none")
  url.searchParams.set("return_to", returnTo)

  window.location.href = url.toString()
}

// ---------------------------------------------------------------------------
// no_session param consumer
// ---------------------------------------------------------------------------

/**
 * consumeNoSessionParam — checks for ?no_session=1 in the current URL.
 *
 * If found: sets the anon marker (suppresses future silent-authn for ~5 min)
 * and strips the param from the browser URL via history.replaceState.
 *
 * Returns true when the param was present (caller should render signed-out UI).
 * Returns false otherwise.
 *
 * DS NOTE: Call on every RP page-load, before rendering auth-gated content.
 */
export function consumeNoSessionParam(): boolean {
  if (typeof window === "undefined") return false

  const params = new URLSearchParams(window.location.search)
  if (params.get("no_session") !== "1") return false

  // Set the anon marker to suppress redirect loops for ~5 min.
  setAnonMarker(300)

  // Strip ?no_session=1 from the visible URL (clean UX, no reload).
  params.delete("no_session")
  const cleanSearch = params.toString()
  const cleanUrl =
    window.location.pathname +
    (cleanSearch ? `?${cleanSearch}` : "") +
    window.location.hash
  window.history.replaceState(null, "", cleanUrl)

  return true
}
