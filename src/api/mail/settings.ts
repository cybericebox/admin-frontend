/**
 * settings.ts — platform SMTP settings (W7 Mail).
 *
 * Routes (backend spec 2026-09-29-mail-w7-design §6 "Platform"):
 *   GET    /api/mail/settings        (platform.settings.read)
 *   PUT    /api/mail/settings        (platform.settings.write)
 *   DELETE /api/mail/settings        → back to the env SMTP_* fallback
 *   POST   /api/mail/settings/test   → synchronous test mail to the current user
 *
 * The password is write-only: responses carry PasswordSet only. A PUT with an
 * empty Password keeps the stored one; ClearPassword removes it.
 */
import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client"

const BASE = "/api/mail/settings"

export type MailSource = "database" | "env" | "none"
export type MailTLSMode = "starttls" | "tls"
export type MailTransport = "event" | "platform" | "env" | ""

export type MailEnvSummary = {
  Host: string
  Port: number
  FromName: string
  FromAddress: string
  ReplyTo: string
}

export type MailSettings = {
  Source: MailSource
  Configured: boolean
  Host: string
  Port: number
  TLSMode: MailTLSMode | ""
  Username: string
  PasswordSet: boolean
  FromName: string
  FromAddress: string
  ReplyTo: string
  SendingDomain: string
  Env: MailEnvSummary | null
  UpdatedAt: string | null
}

export type MailSettingsInput = {
  Host: string
  Port: number
  TLSMode: MailTLSMode
  Username: string
  Password: string
  ClearPassword: boolean
  FromName: string
  FromAddress: string
  ReplyTo: string
}

export type MailTestResult = {
  Sent: boolean
  Recipient: string
  Transport: MailTransport
  Error: string
}

export function getMailSettings(): Promise<MailSettings> {
  return apiGet<MailSettings>(BASE)
}

export function saveMailSettings(input: MailSettingsInput): Promise<MailSettings> {
  return apiPut<MailSettings>(BASE, input)
}

/** Removes the platform row: sending falls back to env SMTP_* (or none). */
export function resetMailSettings(): Promise<MailSettings> {
  return apiDelete<MailSettings>(BASE)
}

/** Tests the given (unsaved) settings, or the stored ones when input is omitted. */
export function testMailSettings(input?: MailSettingsInput): Promise<MailTestResult> {
  return apiPost<MailTestResult>(`${BASE}/test`, input ?? {})
}

/** Domain part of an address ("" when absent) — mirrors the backend's SendingDomain. */
export function domainOf(address: string): string {
  const at = address.lastIndexOf("@")
  return at < 0 ? "" : address.slice(at + 1).trim().toLowerCase()
}
