// One-shot, hidden-iframe silent auth (prompt=none). The iframe always ends on
// THIS origin's /auth/silent page, which postMessages the result. We accept only
// same-origin messages.
const ID_ORIGIN = process.env.NEXT_PUBLIC_ID_ORIGIN ?? ""

let bootstrap: Promise<void> | null = null

// Registered by the QueryClient provider; called once when the silent iframe
// plants a token, so queries that already resolved as anon refetch. Kept as a
// handler (not a direct QueryClient import) so this lib stays UI-framework-free.
let onAuthPlanted: (() => void) | null = null
export function setAuthChangedHandler(fn: () => void): void { onAuthPlanted = fn }

// Reactive "the one-shot silent check has finished" store, consumed by
// useAuthReady() so potentially-private queries gate on `enabled: useAuthReady()`.
let ready = false
const readyListeners = new Set<() => void>()
export function getAuthReady(): boolean { return ready }
export function subscribeAuthReady(cb: () => void): () => void {
  readyListeners.add(cb)
  return () => readyListeners.delete(cb)
}
function markReady(): void {
  if (ready) return
  ready = true
  readyListeners.forEach((cb) => cb())
}

// api/client awaits this before every (non-internal) request. It triggers the
// one-shot bootstrap itself, so a direct (non-React-Query) request still waits for
// the silent check instead of racing ahead unauthenticated.
export function awaitAuthBootstrap(): Promise<void> {
  return runSilentAuthOnce()
}

export function runSilentAuthOnce(): Promise<void> {
  if (bootstrap) return bootstrap
  bootstrap = (async () => {
    if (typeof window === "undefined") return
    // The local-token cookie is httpOnly — JS can't read it — so "do we already
    // have a valid token?" is answered by a probe, not a cookie check. If fetchMe
    // succeeds the token is valid → NO iframe (the expensive silent check only
    // runs when there is no valid token). If the token is present but fetchMe
    // still 401s, that's a real invalid-token problem, handled as anon downstream.
    const { fetchMe } = await import("@/lib/auth")
    const me = await fetchMe() // skipBootstrap + required:false internally
    if (me) return
    // id is the AS (reads the master cookie directly); nothing to plant via iframe.
    if (window.location.hostname.startsWith("id.")) return
    await runSilentIframe()
  })().finally(markReady) // flip useAuthReady() true once, however the check ended
  return bootstrap
}

// runSilentIframe loads id/authorize?prompt=none in a hidden iframe. The AS uses
// only the return_to HOST for routing; the path must be THIS origin's /auth/silent
// terminal page, which postMessages the result back. We accept only same-origin
// messages. Resolves when the result arrives or on a safety timeout.
function runSilentIframe(): Promise<void> {
  return new Promise<void>((resolve) => {
    const here = `${window.location.origin}/auth/silent`
    const url = new URL("/api/auth/authorize", ID_ORIGIN || `https://${window.location.hostname}`)
    url.searchParams.set("prompt", "none")
    url.searchParams.set("return_to", here)
    const iframe = document.createElement("iframe")
    iframe.style.display = "none"
    let done = false
    const finish = (authed: boolean) => {
      if (done) return
      done = true
      window.removeEventListener("message", onMsg)
      iframe.remove()
      // Token planted → tell React Query to refetch the queries that resolved anon.
      if (authed && onAuthPlanted) onAuthPlanted()
      resolve()
    }
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === "cyberice-sso") finish(e.data.authed === true)
    }
    window.addEventListener("message", onMsg)
    iframe.src = url.toString()
    document.body.appendChild(iframe)
    setTimeout(() => finish(false), 5000) // never wedge the app on a blocked iframe
  })
}
