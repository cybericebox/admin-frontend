// Minimal fetch-based API client.
// Base URL is same-origin by default; the daemon proxies /api/* paths.
// Override via NEXT_PUBLIC_API_BASE_URL env var for local development.

import { awaitAuthBootstrap } from "@/lib/silentAuth"

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
    // Sign-in URL advertised by the backend via the X-Sign-In-URL header on 401,
    // so callers can redirect without computing the address.
    public readonly signInUrl?: string
  ) {
    super(message ?? `API error ${status}`)
    this.name = "ApiError"
  }
}

// ApiOptions controls cross-cutting request behavior.
//   required (default true) — a 401 writes the return_to cookie and redirects
//       the browser to the backend-advertised sign-in page (X-Sign-In-URL).
//       The promise never resolves (navigation is underway), so no catch/finally
//       runs on the caller.
//   required: false — opt out (e.g. fetchMe, which treats 401 as "anonymous").
//       The 401 is thrown as ApiError so the caller can handle it.
//   skipBootstrap — skip awaiting the silent-auth bootstrap. Used only by the
//       probe (fetchMe) that IS the bootstrap, to avoid a deadlock.
export type ApiOptions = { required?: boolean; skipBootstrap?: boolean }

// portless strips the port from a URL and forces https:, matching the backend's
// expectations for return_to (port-free, https-only). Returns the input unchanged
// in non-browser contexts (SSR/static export safety).
function portless(href: string): string {
  if (typeof window === "undefined") return href
  try {
    const u = new URL(href)
    u.port = ""
    u.protocol = "https:"
    return u.toString()
  } catch {
    console.warn("[client] portless: unexpected unparseable URL:", href)
    return href
  }
}

// writeReturnToCookie writes the current page URL (portless, https) as the
// return_to cookie the backend consumes at session creation. The backend rejects
// URLs with a port and requires https, so the value must be portless https.
function writeReturnToCookie(): void {
  if (typeof window === "undefined") return
  document.cookie = `return_to=${encodeURIComponent(portless(window.location.href))}; path=/; SameSite=Lax; Secure`
}

// redirectToSignInPage is inlined here (no import of lib/auth) to avoid a
// circular dependency, since lib/auth imports ApiError from this module.
// The return_to is carried by the cookie written before calling this function;
// we navigate directly to signInUrl without appending query params.
// replace() is used so the 401'd page is NOT left in browser history, preventing
// a back-button re-triggering the 401 redirect loop.
function redirectToSignInPage(signInUrl: string | null): void {
  if (typeof window === "undefined") return
  window.location.replace(signInUrl || portless(window.location.origin) + "/sign-in")
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: ApiOptions = {}
): Promise<T> {
  if (!opts.skipBootstrap) await awaitAuthBootstrap()

  const url = `${BASE_URL}${path}`

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })

  // Centralized auth handling: required (default true) → write return_to cookie
  // and redirect to sign-in. Returning a never-resolving promise stops the
  // caller's success/catch paths from running while the browser navigates away.
  // required:false → fall through to throw ApiError so callers treat it as anon.
  if (res.status === 401 && (opts.required ?? true)) {
    writeReturnToCookie()
    redirectToSignInPage(res.headers.get("X-Sign-In-URL"))
    return new Promise<never>(() => {})
  }

  const contentType = res.headers.get("content-type") ?? ""
  const raw = await res.text()
  let parsed: unknown = raw
  if (raw && contentType.includes("application/json")) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Malformed JSON body — keep the raw text rather than throwing.
      parsed = raw
    }
  }
  // (empty body → parsed stays "" → envelope undefined → handled below)

  // The backend wraps every JSON response in an envelope: { Status: { Code,
  // Message }, Data }. Unwrap it here so callers receive the payload directly.
  const envelope =
    parsed && typeof parsed === "object"
      ? (parsed as { Status?: { Message?: string }; Data?: unknown })
      : undefined

  if (!res.ok) {
    throw new ApiError(
      res.status,
      parsed,
      envelope?.Status?.Message,
      res.headers.get("X-Sign-In-URL") ?? undefined
    )
  }

  // Data is absent for empty 200s (e.g. DELETE) — return undefined in that case.
  return (envelope ? envelope.Data : parsed) as T
}

export function apiGet<T>(path: string, init?: RequestInit, opts?: ApiOptions): Promise<T> {
  return request<T>(path, { ...init, method: "GET" }, opts)
}

export function apiPost<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
  opts?: ApiOptions
): Promise<T> {
  return request<T>(path, { ...init, method: "POST", body: JSON.stringify(body) }, opts)
}

export function apiPut<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
  opts?: ApiOptions
): Promise<T> {
  return request<T>(path, { ...init, method: "PUT", body: JSON.stringify(body) }, opts)
}

export function apiPatch<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
  opts?: ApiOptions
): Promise<T> {
  return request<T>(path, { ...init, method: "PATCH", body: JSON.stringify(body) }, opts)
}

export function apiDelete<T>(path: string, init?: RequestInit, opts?: ApiOptions): Promise<T> {
  return request<T>(path, { ...init, method: "DELETE" }, opts)
}
