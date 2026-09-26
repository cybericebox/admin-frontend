/**
 * emailTemplates.ts — Typed email-template + block-preset API client.
 *
 * All paths match the SP1 handler's Init routes:
 *   /api/notifications/templates/email[/:id[/publish|/rollback]]
 *   /api/notifications/templates/email/block-presets[/:id]
 *
 * JSON keys are PascalCase (as emitted by the Go backend).
 * Body/Styling arrive as json.RawMessage (parsed JSON) → null-normalised to []/{}
 * on read so callers always get well-typed values.
 *
 * Block union imported from emailBlocks — single source of truth, never redefined.
 */

import type { EmailBodyBlock } from '@/components/notifications/editor/emailBlocks'
import { apiGet, apiPost, apiPut, apiDelete, apiPostMultipart } from '@/api/client'

// ── Path constants ─────────────────────────────────────────────────────────────

const BASE    = '/api/notifications/templates/email'
const PRESETS = `${BASE}/block-presets`

// ── Types ──────────────────────────────────────────────────────────────────────

export type TemplateStatus = 'draft' | 'published' | 'unpublished'

/** Normalised email template (Body/Styling guaranteed non-null). */
export type EmailTemplate = {
  ID:               string
  NotificationType: string
  Status:           TemplateStatus
  Subject:          string
  Preheader:        string
  Body:             EmailBodyBlock[]
  Styling:          Record<string, unknown>
  PublishedAt:      string | null
  UpdatedByUserID:  string | null
  CreatedAt:        string
  UpdatedAt:        string
}

/** List response wrapper (mirrors Go emailListResponse). */
export type EmailListResponse = {
  Templates:        EmailTemplate[]
  MissingActiveFor: string[]
}

/** One entry in the latest-versions array (key is NotificationType, per handler). */
export type LatestEntry = {
  NotificationType: string
  Draft:            EmailTemplate | null
  Published:        EmailTemplate | null
  Unpublished:      EmailTemplate | null
}

/** Normalised block preset. */
export type BlockPreset = {
  ID:          string
  Name:        string
  Description: string
  Blocks:      EmailBodyBlock[]
  CreatedAt:   string
  UpdatedAt:   string
}

// ── Input types (match createEmailRequest / updateEmailRequest) ────────────────

export type CreateEmailTemplateInput = {
  NotificationType: string
  Subject:          string
  Preheader:        string
  Body:             EmailBodyBlock[]
  Styling:          Record<string, unknown>
}

export type UpdateEmailTemplateInput = {
  Subject:   string
  Preheader: string
  Body:      EmailBodyBlock[]
  Styling:   Record<string, unknown>
}

export type PresetInput = {
  Name:        string
  Description: string
  Blocks:      EmailBodyBlock[]
}

// ── Raw response types (backend may emit null for json.RawMessage fields) ──────

type RawTemplate = Omit<EmailTemplate, 'Body' | 'Styling'> & {
  Body:    EmailBodyBlock[] | null
  Styling: Record<string, unknown> | null
}

type RawListResponse = {
  Templates:        RawTemplate[]
  MissingActiveFor: string[]
}

type RawLatestEntry = {
  NotificationType: string
  Draft:            RawTemplate | null
  Published:        RawTemplate | null
  Unpublished:      RawTemplate | null
}

type RawPreset = Omit<BlockPreset, 'Blocks'> & {
  Blocks: EmailBodyBlock[] | null
}

// ── Normalisation helpers ──────────────────────────────────────────────────────

function normalizeTemplate(raw: RawTemplate): EmailTemplate {
  return {
    ...raw,
    Body:    raw.Body    ?? [],
    Styling: raw.Styling ?? {},
  }
}

function normalizePreset(raw: RawPreset): BlockPreset {
  return {
    ...raw,
    Blocks: raw.Blocks ?? [],
  }
}

// ── Email template functions ───────────────────────────────────────────────────

/** GET /api/notifications/templates/email[?type=&status=] */
export async function listEmailTemplates(
  filter?: { type?: string; status?: string },
): Promise<EmailListResponse> {
  const params = new URLSearchParams()
  if (filter?.type)   params.set('type', filter.type)
  if (filter?.status) params.set('status', filter.status)
  const qs   = params.toString()
  const path = qs ? `${BASE}?${qs}` : BASE
  const raw  = await apiGet<RawListResponse>(path)
  return {
    Templates:        raw.Templates.map(normalizeTemplate),
    MissingActiveFor: raw.MissingActiveFor,
  }
}

/** GET /api/notifications/templates/email/latest */
export async function latestEmailTemplates(): Promise<LatestEntry[]> {
  const raw = await apiGet<RawLatestEntry[]>(`${BASE}/latest`)
  return raw.map((entry) => ({
    NotificationType: entry.NotificationType,
    Draft:            entry.Draft       ? normalizeTemplate(entry.Draft)       : null,
    Published:        entry.Published   ? normalizeTemplate(entry.Published)   : null,
    Unpublished:      entry.Unpublished ? normalizeTemplate(entry.Unpublished) : null,
  }))
}

/** GET /api/notifications/templates/email/:id */
export async function getEmailTemplate(id: string): Promise<EmailTemplate> {
  const raw = await apiGet<RawTemplate>(`${BASE}/${id}`)
  return normalizeTemplate(raw)
}

/** POST /api/notifications/templates/email */
export async function createEmailTemplate(input: CreateEmailTemplateInput): Promise<EmailTemplate> {
  const raw = await apiPost<RawTemplate>(BASE, input)
  return normalizeTemplate(raw)
}

/** PUT /api/notifications/templates/email/:id */
export async function updateEmailTemplate(
  id: string,
  input: UpdateEmailTemplateInput,
): Promise<EmailTemplate> {
  const raw = await apiPut<RawTemplate>(`${BASE}/${id}`, input)
  return normalizeTemplate(raw)
}

/** DELETE /api/notifications/templates/email/:id */
export function deleteEmailTemplate(id: string): Promise<void> {
  return apiDelete<void>(`${BASE}/${id}`)
}

/** POST /api/notifications/templates/email/:id/publish */
export async function publishEmailTemplate(id: string): Promise<EmailTemplate> {
  const raw = await apiPost<RawTemplate>(`${BASE}/${id}/publish`, {})
  return normalizeTemplate(raw)
}

/** POST /api/notifications/templates/email/:id/rollback */
export async function rollbackEmailTemplate(id: string): Promise<EmailTemplate> {
  const raw = await apiPost<RawTemplate>(`${BASE}/${id}/rollback`, {})
  return normalizeTemplate(raw)
}

// ── Block preset functions ─────────────────────────────────────────────────────

/** GET /api/notifications/templates/email/block-presets */
export async function listBlockPresets(): Promise<BlockPreset[]> {
  const raw = await apiGet<RawPreset[]>(PRESETS)
  return raw.map(normalizePreset)
}

/** GET /api/notifications/templates/email/block-presets/:id */
export async function getBlockPreset(id: string): Promise<BlockPreset> {
  const raw = await apiGet<RawPreset>(`${PRESETS}/${id}`)
  return normalizePreset(raw)
}

/** POST /api/notifications/templates/email/block-presets */
export async function createBlockPreset(input: PresetInput): Promise<BlockPreset> {
  const raw = await apiPost<RawPreset>(PRESETS, input)
  return normalizePreset(raw)
}

/** PUT /api/notifications/templates/email/block-presets/:id */
export async function updateBlockPreset(id: string, input: PresetInput): Promise<BlockPreset> {
  const raw = await apiPut<RawPreset>(`${PRESETS}/${id}`, input)
  return normalizePreset(raw)
}

/** DELETE /api/notifications/templates/email/block-presets/:id */
export function deleteBlockPreset(id: string): Promise<void> {
  return apiDelete<void>(`${PRESETS}/${id}`)
}

// ── Preview + image functions (Task 7/6 backend contract) ──────────────────────

export type PreviewEmailTemplateInput = {
  NotificationType: string
  Subject:          string
  Preheader:        string
  Body:             EmailBodyBlock[]
  Styling:          Record<string, unknown>
  Values?:          Record<string, string>
}

export type PreviewEmailTemplateResult = {
  Subject:   string
  Preheader: string
  HTML:      string
}

/**
 * POST /api/notifications/templates/email/preview — the backend renders the
 * draft exactly as it would dispatch it (see task-7-report.md). A draft that
 * cannot be rendered (bad syntax, unknown subject/preheader variable) comes
 * back as a 400 ApiError whose message is "Template cannot be rendered: …".
 * An optional `signal` cancels the request (the editor aborts superseded previews).
 */
export function previewEmailTemplate(
  input: PreviewEmailTemplateInput,
  signal?: AbortSignal,
): Promise<PreviewEmailTemplateResult> {
  return apiPost<PreviewEmailTemplateResult>(`${BASE}/preview`, input, signal ? { signal } : undefined)
}

export type UploadedEmailImage = { FileID: string; Url: string }

/** POST /api/notifications/templates/email/images (multipart, field "file"). */
export function uploadEmailImage(file: File): Promise<UploadedEmailImage> {
  const form = new FormData()
  form.append('file', file)
  return apiPostMultipart<UploadedEmailImage>(`${BASE}/images`, form)
}

/** GET /api/notifications/templates/email/images/:fileID (cookie-auth, suitable for <img src>). */
export function emailImageUrl(fileId: string): string {
  return `${BASE}/images/${fileId}`
}
