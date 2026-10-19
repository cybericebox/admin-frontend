// Localize an API error by its stable numeric code (Status.Code), NOT by the
// backend's English Status.Message. The backend is the source of truth for codes
// and English text (messages/errors.en.json is generated from it); uk overrides
// per code. Resolution: uk → en → generic. A non-API error (network/parse) or an
// error without a code falls back to the generic UI-language message.
//
// errors.uk.json is intentionally partial: codes without a uk entry fall through
// to the English catalog until translated.
import errorsUk from "../../messages/errors.uk.json"
import errorsEn from "../../messages/errors.en.json"
import { ApiError } from "@/api/client"
import { isOverloadCode, isOverloadError } from "@/api/retry"
import { t } from "./t"

const uk = errorsUk as Record<string, string>
const en = errorsEn as Record<string, string>

/** "45 с", "3 хв", "2 год": the wait from a Retry-After value, rounded up. */
export function formatWait(seconds: number): string {
  if (seconds < 60) return t("error.wait.seconds", { count: Math.max(1, Math.ceil(seconds)) })
  if (seconds < 3600) return t("error.wait.minutes", { count: Math.ceil(seconds / 60) })
  return t("error.wait.hours", { count: Math.ceil(seconds / 3600) })
}

export function localizedError(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    // A bucket-limiter 429 has an empty body (no code); Retry-After is the only hint.
    if (err.retryAfter) return t("error.rateLimited", { wait: formatWait(err.retryAfter) })
    if (err.code == null) return t("error.rateLimitedNoWait")
  }
  // The overload codes always read as the one overloaded line (with its retry), not as their catalog texts.
  if (err instanceof ApiError && isOverloadCode(err.code)) return t("error.overloaded")
  if (err instanceof ApiError && err.code != null) {
    const key = String(err.code)
    const msg = uk[key] ?? en[key]
    if (msg) return msg
  }
  // The server's overload signal (a 503 with Retry-After, an overload code) without a catalog message; reads were already retried.
  if (isOverloadError(err)) return t("error.overloaded")
  return t("error.generic")
}

/** The catalog message when the error carries a known code, else `fallback`. */
export function errorOr(err: unknown, fallback: string): string {
  if (err instanceof ApiError && (err.code != null || err.status === 429 || isOverloadError(err))) {
    const message = localizedError(err)
    if (message !== t("error.generic")) return message
  }
  return fallback
}

/**
 * The overloaded text for the server's overload signal, the rate-limit message (with its wait) for a
 * personal 429, else `fallback` (for fixed-message failure toasts).
 */
export function overloadOr(err: unknown, fallback: string): string {
  if (isOverloadError(err)) return t("error.overloaded")
  if (err instanceof Error && (err as { status?: unknown }).status === 429) return localizedError(err)
  return fallback
}
