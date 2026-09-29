/**
 * settings.ts — platform SMTP settings (W7 Mail).
 *
 * Routes (platform, backend spec 2026-09-29-mail-w7-design §6):
 *   GET    /api/mail/settings              (platform.settings.read)
 *   PUT    /api/mail/settings/identity     sender + Reply-To
 *   PUT    /api/mail/settings/smtp         the one custom SMTP server
 *   DELETE /api/mail/settings/smtp         → back to the env SMTP_* fallback
 *   POST   /api/mail/settings/smtp/test    → synchronous test mail to the current user
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
}

export type MailSettings = {
  /** Stored platform values (empty = default / env). */
  Identity: MailIdentity
  /** What is actually used, env and defaults included: the placeholders. */
  Effective: MailIdentity
  SendingDomain: string
  /** Source of the SMTP server. */
  Source: MailSource
  Configured: boolean
  SMTP: MailSmtp | null
  Env: MailEnvSummary | null
}

export type MailSmtpInput = {
  Host: string
  Port: number
  TLSMode: MailTLSMode
  Username: string
  Password: string
  ClearPassword: boolean
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

export function saveMailIdentity(input: MailIdentity): Promise<MailSettings> {
  return apiPut<MailSettings>(`${BASE}/identity`, input)
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
