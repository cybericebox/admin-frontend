/**
 * inAppTemplates.ts — Typed in-app template API client.
 *
 * All paths match the SP1 handler's Init routes:
 *   /api/notifications/templates/inapp[/:id[/publish|/rollback]]
 *
 * JSON keys are PascalCase (as emitted by the Go backend).
 * Actions arrives as json.RawMessage (parsed JSON) → null-normalised to []
 * on read so callers always get well-typed values.
 *
 * TemplateStatus imported from @/lib/templateStatus — single source of truth.
 */

import type { TemplateStatus } from '@/lib/templateStatus'
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client'

// ── Path constant ──────────────────────────────────────────────────────────────

const BASE = '/api/notifications/templates/inapp'

// ── Types ──────────────────────────────────────────────────────────────────────

export type { TemplateStatus }

/** A single CTA action attached to an in-app notification. */
export type InAppAction = {
  label: string
  href:  string
}

/** Normalised in-app template (Actions guaranteed non-null). */
export type InAppTemplate = {
  ID:               string
  NotificationType: string
  Status:           TemplateStatus
  Title:            string
  Body:             string
  Link:             string
  Icon:             string
  Tone:             string
  AccentColor:      string
  Surface:          string
  AutoDismissMs:    number | null
  Actions:          InAppAction[]
  PublishedAt:      string | null
  UpdatedByUserID:  string | null
  CreatedAt:        string
  UpdatedAt:        string
}

/** List response wrapper (mirrors Go inAppListResponse). */
export type InAppListResponse = {
  Templates:        InAppTemplate[]
  MissingActiveFor: string[]
}

/** One entry in the latest-versions array (keyed by NotificationType, per handler). */
export type InAppLatestEntry = {
  NotificationType: string
  Draft:            InAppTemplate | null
  Published:        InAppTemplate | null
  Unpublished:      InAppTemplate | null
}

// ── Input types (match createInAppRequest / updateInAppRequest) ────────────────

export type InAppCreateInput = {
  NotificationType: string
  Title:            string
  Body:             string
  Link:             string
  Icon:             string
  Tone:             string
  AccentColor:      string
  Surface:          string
  AutoDismissMs:    number | null
  Actions:          InAppAction[]
}

export type InAppUpdateInput = Omit<InAppCreateInput, 'NotificationType'>

// ── Raw response types (backend may emit null for json.RawMessage fields) ────────

type RawInAppTemplate = Omit<InAppTemplate, 'Actions'> & {
  Actions: InAppAction[] | null
}

type RawInAppListResponse = {
  Templates:        RawInAppTemplate[]
  MissingActiveFor: string[]
}

type RawInAppLatestEntry = {
  NotificationType: string
  Draft:            RawInAppTemplate | null
  Published:        RawInAppTemplate | null
  Unpublished:      RawInAppTemplate | null
}

// ── Normalisation helper ───────────────────────────────────────────────────────

function normalizeTemplate(raw: RawInAppTemplate): InAppTemplate {
  return {
    ...raw,
    Actions: raw.Actions ?? [],
  }
}

// ── In-app template functions ──────────────────────────────────────────────────

/** GET /api/notifications/templates/inapp[?type=&status=] */
export async function listInAppTemplates(
  filter?: { type?: string; status?: string },
): Promise<InAppListResponse> {
  const params = new URLSearchParams()
  if (filter?.type)   params.set('type', filter.type)
  if (filter?.status) params.set('status', filter.status)
  const qs   = params.toString()
  const path = qs ? `${BASE}?${qs}` : BASE
  const raw  = await apiGet<RawInAppListResponse>(path)
  return {
    Templates:        (raw.Templates ?? []).map(normalizeTemplate),
    MissingActiveFor: raw.MissingActiveFor ?? [],
  }
}

/** GET /api/notifications/templates/inapp/latest */
export async function latestInAppTemplates(): Promise<InAppLatestEntry[]> {
  const raw = await apiGet<RawInAppLatestEntry[]>(`${BASE}/latest`)
  return raw.map((entry) => ({
    NotificationType: entry.NotificationType,
    Draft:            entry.Draft       ? normalizeTemplate(entry.Draft)       : null,
    Published:        entry.Published   ? normalizeTemplate(entry.Published)   : null,
    Unpublished:      entry.Unpublished ? normalizeTemplate(entry.Unpublished) : null,
  }))
}

/** GET /api/notifications/templates/inapp/:id */
export async function getInAppTemplate(id: string): Promise<InAppTemplate> {
  const raw = await apiGet<RawInAppTemplate>(`${BASE}/${id}`)
  return normalizeTemplate(raw)
}

/** POST /api/notifications/templates/inapp */
export async function createInAppTemplate(input: InAppCreateInput): Promise<InAppTemplate> {
  const raw = await apiPost<RawInAppTemplate>(BASE, input)
  return normalizeTemplate(raw)
}

/** PUT /api/notifications/templates/inapp/:id */
export async function updateInAppTemplate(
  id: string,
  input: InAppUpdateInput,
): Promise<InAppTemplate> {
  const raw = await apiPut<RawInAppTemplate>(`${BASE}/${id}`, input)
  return normalizeTemplate(raw)
}

/** DELETE /api/notifications/templates/inapp/:id */
export function deleteInAppTemplate(id: string): Promise<void> {
  return apiDelete<void>(`${BASE}/${id}`)
}

/** POST /api/notifications/templates/inapp/:id/publish */
export async function publishInAppTemplate(id: string): Promise<InAppTemplate> {
  const raw = await apiPost<RawInAppTemplate>(`${BASE}/${id}/publish`, {})
  return normalizeTemplate(raw)
}

/** POST /api/notifications/templates/inapp/:id/rollback */
export async function rollbackInAppTemplate(id: string): Promise<InAppTemplate> {
  const raw = await apiPost<RawInAppTemplate>(`${BASE}/${id}/rollback`, {})
  return normalizeTemplate(raw)
}
