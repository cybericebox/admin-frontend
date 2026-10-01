/**
 * settings.ts — platform SMTP settings (W7 Mail).
 *
 * Routes (platform, backend spec 2026-09-29-mail-w7-design §6):
 *   GET    /api/mail/settings              (platform.settings.read)
 *   PUT    /api/mail/settings/identity     sender + Reply-To + sending domain
 *   POST   /api/mail/settings/providers                    add an SMTP provider (last in the order)
 *   PUT    /api/mail/settings/providers/{id}               save a provider
 *   PATCH  /api/mail/settings/providers/{id}/enabled       switch a provider on / off
 *   DELETE /api/mail/settings/providers/{id}               delete a provider
 *   PUT    /api/mail/settings/providers/order              set the priority order
 *   POST   /api/mail/settings/providers/{id}/test          → test mail through a stored provider
 *   POST   /api/mail/settings/providers/test               → test mail through unsaved form values,
 *                                                            or (empty body) the transport in use
 *   PUT    /api/mail/settings/footer       the platform email footer (a Lexical document)
 *   POST   /api/mail/settings/footer/preview → the document rendered as it would be sent
 *
 * The password is write-only: responses carry PasswordSet only. A PUT with an
 * empty Password keeps the stored one; ClearPassword removes it.
 */
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/api/client"

const BASE = "/api/mail/settings"

export type MailSource = "database" | "env" | "none"
export type MailTLSMode = "starttls" | "tls"
export type MailTransport = "event" | "platform" | "env" | ""

export type MailParty = { Name: string; Address: string }
export type MailIdentity = { Sender: MailParty; ReplyTo: MailParty }

export type MailEnvSummary = {
  Host: string
  Port: number
  FromName: string
  FromAddress: string
  ReplyTo: string
}

/**
 * One platform SMTP provider with its usage today (UTC day). The password is
 * never returned. Empty Sender / ReplyTo fields use the platform sender.
 */
export type MailProvider = {
  ID: string
  Name: string
  Host: string
  Port: number
  TLSMode: MailTLSMode | ""
  Username: string
  PasswordSet: boolean
  /** Position in the try order, lower first. */
  Priority: number
  Enabled: boolean
  Sender: MailParty
  ReplyTo: MailParty
  /** Limits; null = not set (no limit). */
  MaxPerSecond: number | null
  DailyLimit: number | null
  SentToday: number
  /** The daily limit is used up until ResetsAt. */
  Exhausted: boolean
  ResetsAt: string
  LastUsedAt: string | null
  LastError: string
  LastErrorAt: string | null
  UpdatedAt: string
}

/** A Lexical editor state: the format of the email body rich_text blocks. */
export type LexicalState = Record<string, unknown>

/** The platform email footer; null Content = DefaultContent is sent. */
export type MailFooter = {
  Content: LexicalState | null
  DefaultContent: LexicalState
  Variables: string[]
}

/** Where a sender value in effect comes from. */
export type MailFieldSource = "saved" | "env" | "derived" | "default" | "none"

export type MailFieldSources = {
  SenderName: MailFieldSource
  SenderAddress: MailFieldSource
  ReplyToName: MailFieldSource
  ReplyToAddress: MailFieldSource
  SendingDomain: MailFieldSource
}

export type MailFooterPreview = { HTML: string; Text: string }

export type MailSettings = {
  /** Stored platform values (empty = default / env). */
  Identity: MailIdentity
  /** What is actually used, env and defaults included: the placeholders. */
  Effective: MailIdentity
  Footer: MailFooter
  /** The sending domain in effect: Events send from <tag>@SendingDomain. */
  SendingDomain: string
  /** What was saved (empty: the server config sender's domain applies). */
  SavedSendingDomain: string
  /** The server config (SMTP_SENDER_EMAIL) domain: the placeholder. */
  EnvSendingDomain: string
  Sources: MailFieldSources
  /** The SMTP transport in use: the saved providers, else the env one (SMTP_*), else none. */
  Source: MailSource
  Configured: boolean
  /** No provider is saved and SMTP_* is set: the env transport is the one in use. */
  EnvActive: boolean
  Env: MailEnvSummary | null
  /** By priority. */
  Providers: MailProvider[]
}

export type MailProviderInput = {
  Name: string
  Host: string
  Port: number
  TLSMode: MailTLSMode
  Username: string
  /** Empty keeps the stored password unless ClearPassword is set. */
  Password: string
  ClearPassword: boolean
  Sender: MailParty
  ReplyTo: MailParty
  /** null = no limit. */
  MaxPerSecond: number | null
  DailyQuota: number | null
  /** Omitted keeps the stored state (a new provider is enabled). */
  Enabled?: boolean
}

export type MailTestResult = {
  Sent: boolean
  Recipient: string
  Transport: MailTransport
  Error: string
}

export const MAIL_NAME_MAX = 64

export function getMailSettings(): Promise<MailSettings> {
  return apiGet<MailSettings>(BASE)
}

export type MailIdentityInput = MailIdentity & { SendingDomain: string }

export function saveMailIdentity(input: MailIdentityInput): Promise<MailSettings> {
  return apiPut<MailSettings>(`${BASE}/identity`, input)
}

/** The stored footer document is bounded in bytes (backend MaxFooterBytes). */
export const MAIL_FOOTER_MAX_BYTES = 20000

/** null (or an empty/default document) restores the built-in footer. */
export function saveMailFooter(content: LexicalState | null): Promise<MailSettings> {
  return apiPut<MailSettings>(`${BASE}/footer`, { Content: content })
}

export function previewMailFooter(content: LexicalState | null): Promise<MailFooterPreview> {
  return apiPost<MailFooterPreview>(`${BASE}/footer/preview`, { Content: content })
}

export function createMailProvider(input: MailProviderInput): Promise<MailSettings> {
  return apiPost<MailSettings>(`${BASE}/providers`, input)
}

export function saveMailProvider(id: string, input: MailProviderInput): Promise<MailSettings> {
  return apiPut<MailSettings>(`${BASE}/providers/${id}`, input)
}

export function setMailProviderEnabled(id: string, enabled: boolean): Promise<MailSettings> {
  return apiPatch<MailSettings>(`${BASE}/providers/${id}/enabled`, { Enabled: enabled })
}

export function deleteMailProvider(id: string): Promise<MailSettings> {
  return apiDelete<MailSettings>(`${BASE}/providers/${id}`)
}

/** The ids in the wanted priority order. */
export function reorderMailProviders(ids: string[]): Promise<MailSettings> {
  return apiPut<MailSettings>(`${BASE}/providers/order`, { IDs: ids })
}

/** Tests a stored provider as saved. */
export function testMailProvider(id: string): Promise<MailTestResult> {
  return apiPost<MailTestResult>(`${BASE}/providers/${id}/test`, {})
}

/** Tests unsaved form values; with id, an empty password uses that provider's stored one. */
export function testMailProviderForm(input: MailProviderInput, id?: string): Promise<MailTestResult> {
  return apiPost<MailTestResult>(`${BASE}/providers/test`, { ...input, ID: id ?? "" })
}

/** Tests the transport platform mail goes out through now (SMTP_*, or the first available provider). */
export function testMailTransportInUse(): Promise<MailTestResult> {
  return apiPost<MailTestResult>(`${BASE}/providers/test`, {})
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

/** An empty address is valid here: empty means "inherit". */
export function isValidEmail(address: string): boolean {
  return address === "" || EMAIL_RE.test(address)
}

const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i

/** A hostname of at least two labels, not an IP address. Empty is valid: the fallback applies. */
export function isValidSendingDomain(domain: string): boolean {
  if (domain === "") return true
  if (domain.length > 253) return false
  const labels = domain.split(".")
  if (labels.length < 2 || !labels.every((label) => DOMAIN_LABEL.test(label))) return false
  return !/^\d+$/.test(labels[labels.length - 1])
}
