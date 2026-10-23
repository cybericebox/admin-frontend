/**
 * broadcastTemplates.ts — platform custom templates: saved broadcast messages an admin loads into the composer
 * before sending by hand. Not bound to any platform action; listed beside the triggered templates on the templates
 * pages. Needs notifications.broadcast. Keys are PascalCase, as emitted by the Go backend.
 *   GET    /api/notifications/templates/custom
 *   POST   /api/notifications/templates/custom
 *   GET    /api/notifications/templates/custom/:id
 *   PUT    /api/notifications/templates/custom/:id
 *   DELETE /api/notifications/templates/custom/:id
 */
import type { EmailBodyBlock } from '@/components/notifications/editor/emailBlocks'
import { apiDelete, apiGet, apiPost, apiPut } from '@/api/client'
import type { BroadcastChannel } from '@/api/notifications/broadcasts'

const BASE = '/api/notifications/templates/custom'

/** 70228: the platform already has a template with this name. */
export const TEMPLATE_NAME_TAKEN = 70228
export const TEMPLATE_NAME_MAX = 200

export type BroadcastTemplate = {
  /** Always "custom": tells it apart from the triggered (action-bound) templates. */
  Kind?: 'custom'
  ID: string
  ScopeEventID: string | null
  Name: string
  Channels: BroadcastChannel[] | null
  Subject: string
  Preheader: string
  EmailBody: EmailBodyBlock[] | null
  EmailStyling: Record<string, unknown> | null
  InAppTitle: string
  InAppBody: string
  InAppLink: string
  UpdatedBy: string | null
  UpdatedByName: string
  CreatedAt: string
  UpdatedAt: string
}

export type BroadcastTemplateInput = {
  Name: string
  Channels: BroadcastChannel[]
  Subject: string
  Preheader: string
  EmailBody: EmailBodyBlock[]
  EmailStyling: Record<string, unknown>
  InAppTitle: string
  InAppBody: string
  InAppLink: string
}

export function listBroadcastTemplates(): Promise<BroadcastTemplate[]> {
  return apiGet<BroadcastTemplate[] | null>(BASE).then((rows) => rows ?? [])
}

export function getBroadcastTemplate(id: string): Promise<BroadcastTemplate> {
  return apiGet<BroadcastTemplate>(`${BASE}/${encodeURIComponent(id)}`)
}

export function createBroadcastTemplate(input: BroadcastTemplateInput): Promise<BroadcastTemplate> {
  return apiPost<BroadcastTemplate>(BASE, input)
}

export function updateBroadcastTemplate(id: string, input: BroadcastTemplateInput): Promise<BroadcastTemplate> {
  return apiPut<BroadcastTemplate>(`${BASE}/${encodeURIComponent(id)}`, input)
}

export function deleteBroadcastTemplate(id: string): Promise<unknown> {
  return apiDelete<unknown>(`${BASE}/${encodeURIComponent(id)}`)
}
