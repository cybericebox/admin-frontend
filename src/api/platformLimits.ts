/**
 * platformLimits.ts — typed platform settings edited as cards of integer fields.
 *
 * Routes (card = retention | archive-limits | test-runs):
 *   GET    /api/settings/<card>   the view            (platform.settings.read)
 *   PUT    /api/settings/<card>   save, all keys       (platform.settings.write)
 *   DELETE /api/settings/<card>   back to the defaults (platform.settings.write)
 *
 * Durations are seconds, sizes bytes, counts plain integers. Fields come in display order.
 */
import { apiDelete, apiGet, apiPut } from "@/api/client"

export type LimitKind = "duration" | "size" | "count"

export type LimitField = {
  Key: string
  Kind: LimitKind
  Value: number
  Default: number
  Min: number
  Max: number
  /** The period is published in the Privacy Policy. */
  InPrivacyPolicy: boolean
}

/** Ignored: a saved row exists but does not apply, the defaults are in force. */
export type LimitSettings = { Custom: boolean; Ignored?: boolean; UpdatedAt: string | null; Fields: LimitField[] }

export type LimitCard = "retention" | "archive-limits" | "test-runs"

const path = (card: LimitCard) => `/api/settings/${card}`

export function getLimitSettings(card: LimitCard): Promise<LimitSettings> {
  return apiGet<LimitSettings>(path(card))
}

/** Saves every field of the card at once; a partial set is refused by the server. */
export function saveLimitSettings(card: LimitCard, values: Record<string, number>): Promise<LimitSettings> {
  return apiPut<LimitSettings>(path(card), { Values: values })
}

export function resetLimitSettings(card: LimitCard): Promise<LimitSettings> {
  return apiDelete<LimitSettings>(path(card))
}
