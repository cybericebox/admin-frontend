/**
 * settings.ts — platform SMTP settings (W7 Mail).
 *
 * Routes (platform, backend spec 2026-09-29-mail-w7-design §6):
 *   GET    /api/mail/settings              (platform.settings.read)
 *   PUT    /api/mail/settings/identity     sender + Reply-To + sending domain
 *   PUT    /api/mail/settings/smtp         the one custom SMTP server
 *   DELETE /api/mail/settings/smtp         → back to the env SMTP_* fallback
 *   POST   /api/mail/settings/smtp/test    → synchronous test mail to the current user
 *   PUT    /api/mail/settings/footer       the platform email footer (a Lexical document)
 *   POST   /api/mail/settings/footer/preview → the document rendered as it would be sent
 *
 * The password is write-only: responses carry PasswordSet only. A PUT with an
 * empty Password keeps the stored one; ClearPassword removes it.
 */
import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client"

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

export type MailSmtp = {
  Host: string
  Port: number
  TLSMode: MailTLSMode | ""
  Username: string
  PasswordSet: boolean
  UpdatedAt: string | null
  /** Saved send limits; null = not set here. */
  MaxPerSecond: number | null
  DailyQuota: number | null
}

/** Where a send limit in effect comes from. */
export type MailLimitSource = "saved" | "env" | "none"

/** The send limits in effect (saved, else env, else none) with their sources. */
export type MailLimits = {
  /** 0 = no limit. */
  PerSecond: number
  DailyQuota: number
  PerSecondSource: MailLimitSource
  DailyQuotaSource: MailLimitSource
  /** The server config (SMTP_MAX_PER_SECOND / SMTP_DAILY_QUOTA) values: the placeholders. */
  EnvPerSecond: number
  EnvDailyQuota: number
  /** Messages delivered through this server in the last 24 hours. */
  Used24h: number
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
  /** Source of the SMTP server. */
  Source: MailSource
  Configured: boolean
  SMTP: MailSmtp | null
  Env: MailEnvSummary | null
  Limits: MailLimits
}

export type MailSmtpInput = {
  Host: string
  Port: number
  TLSMode: MailTLSMode
  Username: string
  Password: string
  ClearPassword: boolean
  /** null = no limit set here (the env value, then none). */
  MaxPerSecond: number | null
  DailyQuota: number | null
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

export function saveMailSmtp(input: MailSmtpInput): Promise<MailSettings> {
  return apiPut<MailSettings>(`${BASE}/smtp`, input)
}

/** Removes the platform SMTP row: sending falls back to env SMTP_* (or none). */
export function resetMailSmtp(): Promise<MailSettings> {
  return apiDelete<MailSettings>(`${BASE}/smtp`)
}

/** Tests the given (unsaved) SMTP, or the stored one when input is omitted. */
export function testMailSmtp(input?: MailSmtpInput): Promise<MailTestResult> {
  return apiPost<MailTestResult>(`${BASE}/smtp/test`, input ?? {})
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
