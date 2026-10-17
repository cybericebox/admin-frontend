// Retry for reads the server turned away because it is overloaded (429 / 503).
// Framework-free and dependency-free: the same file is copied verbatim into
// every frontend; only the call site in each client differs.

/** Statuses that can mean "busy, ask again shortly" (a 503 only with Retry-After). */
export const OVERLOAD_STATUSES = [429, 503]

/** A Retry-After longer than this is not worth waiting for in a pending request. */
const MAX_RETRY_AFTER_MS = 10_000
const BASE_DELAY_MS = 500
const MAX_BACKOFF_MS = 4_000
const DEFAULT_MAX_ATTEMPTS = 4

/**
 * Delay before retry number `attempt` (0 = the first retry). Retry-After as
 * delta-seconds or an HTTP-date wins; above 10 s it returns null (do not retry).
 * Without it: exponential backoff capped at 4 s, with jitter in [50%, 100%].
 */
export function retryDelayMs(attempt: number, retryAfterHeader: string | null, random: () => number = Math.random): number | null {
  const header = retryAfterHeader?.trim()
  if (header) {
    let ms: number | null = null
    if (/^\d+(\.\d+)?$/.test(header)) ms = Number(header) * 1000
    else {
      const at = Date.parse(header)
      if (Number.isFinite(at)) ms = Math.max(0, at - Date.now())
    }
    if (ms !== null) return ms > MAX_RETRY_AFTER_MS ? null : ms
  }
  return Math.min(MAX_BACKOFF_MS, BASE_DELAY_MS * 2 ** attempt) * (0.5 + random() / 2)
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted.", "AbortError")
}

/** setTimeout as a promise; an abort rejects at once with the signal's reason. */
function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortReason(signal)); return }
    const onAbort = () => { clearTimeout(timer); reject(abortReason(signal as AbortSignal)) }
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve() }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

/**
 * The server shed the request: a 429, or a 503 with Retry-After (the daemon's
 * overload answer). A 503 without it is a domain or edge "unavailable" error.
 */
export function isOverloadResponse(res: Response): boolean {
  return res.status === 429 || (res.status === 503 && res.headers.has("Retry-After"))
}

export type OverloadRetryOptions = {
  method: string
  signal?: AbortSignal | null
  /** Total tries including the first one (default 4). */
  maxAttempts?: number
  sleep?: (ms: number, signal?: AbortSignal | null) => Promise<void>
}

/**
 * Runs `doFetch` and, for a GET or HEAD with an overload answer, tries again after
 * retryDelayMs. Mutations are never repeated. Returns the last Response (the
 * caller handles it as before); an abort during the wait rejects with the
 * AbortError and no further request is sent.
 */
export async function fetchWithOverloadRetry(doFetch: () => Promise<Response>, opts: OverloadRetryOptions): Promise<Response> {
  const method = opts.method.toUpperCase()
  const retryable = method === "GET" || method === "HEAD"
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const wait = opts.sleep ?? sleep
  for (let attempt = 0; ; attempt++) {
    const res = await doFetch()
    if (!retryable || attempt + 1 >= maxAttempts || !isOverloadResponse(res)) return res
    const delay = retryDelayMs(attempt, res.headers.get("Retry-After"))
    if (delay === null) return res
    // Release the connection held by the unread body of the discarded answer.
    res.body?.cancel().catch(() => undefined)
    await wait(delay, opts.signal)
  }
}

/**
 * An API error the user can simply repeat in a moment: a 429, or a 503 that
 * carried Retry-After (the clients store it as retryAfter or retryAfterSeconds).
 */
export function isOverloadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const { status, retryAfter, retryAfterSeconds } = err as { status?: unknown; retryAfter?: unknown; retryAfterSeconds?: unknown }
  return status === 429 || (status === 503 && (retryAfter != null || retryAfterSeconds != null))
}
