/**
 * signalDefaults.ts — platform default subscription API for Event-scoped signals.
 *
 * Paths match the settings handler's Init routes:
 *   GET/PUT /api/notifications/signal-defaults
 *
 * One item per (SignalType, Channel) pair — the 10 participant signal types
 * (Task 2, 5b) times email/in_app. Every Event inherits this default until it
 * overrides the pair. Audience is an opaque object (e.g. {"kind":"signal_subject"})
 * — the admin UI shows it read-only, it is not editable here.
 */

import { apiGet, apiPut } from "@/api/client"

const BASE = "/api/notifications/signal-defaults"

export type SignalDefault = {
  SignalType: string
  Channel: string
  Enabled: boolean
  Audience: { kind: string; [key: string]: unknown }
}

export function listSignalDefaults(): Promise<SignalDefault[]> {
  return apiGet<SignalDefault[]>(BASE)
}

export function updateSignalDefault(d: SignalDefault): Promise<SignalDefault> {
  return apiPut<SignalDefault>(BASE, d)
}
