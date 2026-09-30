/**
 * broadcasts.ts — platform custom broadcasts («Розсилка»).
 * Contract: docs/BROADCASTS.md. Keys are PascalCase, as emitted by the Go backend.
 *   POST /api/notifications/broadcasts/audience-count
 *   POST /api/notifications/broadcasts
 *   GET  /api/notifications/broadcasts?limit&cursor
 *   GET  /api/notifications/broadcasts/:id[/deliveries?limit&offset]
 */
import type { EmailBodyBlock } from '@/components/notifications/editor/emailBlocks'
import type { CursorPage } from '@/api/pagination'
import { apiGet, apiPost } from '@/api/client'

const BASE = '/api/notifications/broadcasts'

export type BroadcastChannel = 'email' | 'in_app'
export type BroadcastStatus = 'sending' | 'done' | 'failed'
export type PlatformAudienceKind = 'all' | 'roles' | 'users'

export type BroadcastAudience = {
  Kind: PlatformAudienceKind | string
  Roles?: string[]
  UserIDs?: string[]
  TeamIDs?: string[]
}

export type Broadcast = {
  ID: string
  ScopeEventID: string | null
  EventName: string
  CreatedBy: string
  CreatedByName: string
  Channels: BroadcastChannel[]
  Subject: string
  Preheader: string
  EmailBody: EmailBodyBlock[] | null
  EmailStyling: Record<string, unknown> | null
  InAppTitle: string
  InAppBody: string
  InAppLink: string
  Audience: BroadcastAudience
  RecipientCount: number
  SentCount: number
  FailedCount: number
  Status: BroadcastStatus
  CreatedAt: string
  FinishedAt: string | null
}

export type SendBroadcastInput = {
  Channels: BroadcastChannel[]
  Subject: string
  Preheader: string
  EmailBody: EmailBodyBlock[]
  EmailStyling: Record<string, unknown>
  InAppTitle: string
  InAppBody: string
  InAppLink: string
  Audience: BroadcastAudience
}

export type BroadcastDelivery = {
  DispatchID: string
  RecipientUserID: string
  RecipientEmail: string
  DispatchStatus: string
  Channel: string
  TargetStatus: string
  Error: string
}

/** Variables available in a platform broadcast (event_* are empty on the platform). */
export const BROADCAST_VARIABLES = ['user_name', 'user_first_name', 'user_last_name', 'user_email', 'event_name', 'event_url'] as const

export function broadcastAudienceCount(audience: BroadcastAudience, signal?: AbortSignal): Promise<{ Count: number }> {
  return apiPost<{ Count: number }>(`${BASE}/audience-count`, { Audience: audience }, signal ? { signal } : undefined)
}

export function sendBroadcast(input: SendBroadcastInput): Promise<Broadcast> {
  return apiPost<Broadcast>(BASE, input)
}

export function listBroadcasts(params: { limit: number; cursor?: string | null }): Promise<CursorPage<Broadcast>> {
  const query = new URLSearchParams({ limit: String(params.limit) })
  if (params.cursor) query.set('cursor', params.cursor)
  return apiGet<CursorPage<Broadcast>>(`${BASE}?${query.toString()}`)
}

export function getBroadcast(id: string): Promise<Broadcast> {
  return apiGet<Broadcast>(`${BASE}/${encodeURIComponent(id)}`)
}

export function listBroadcastDeliveries(id: string, params: { limit: number; offset: number }): Promise<BroadcastDelivery[]> {
  return apiGet<BroadcastDelivery[] | null>(`${BASE}/${encodeURIComponent(id)}/deliveries?limit=${params.limit}&offset=${params.offset}`).then((rows) => rows ?? [])
}
