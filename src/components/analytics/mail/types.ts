// GET /api/analytics/mail (PascalCase JSON). Aggregates only, no recipient addresses.
export type MailDay = { Day: string; Sent: number; Failed: number; Fallbacks: number; Tracked?: number; Opened?: number; Clicked?: number }
export type MailKeyRow = { Key: string; Sent: number; Failed: number; Fallbacks: number; Total: number; FailureRate: number; Tracked?: number; Opened?: number; Clicked?: number; OpenRate?: number; ClickRate?: number }
export type MailErrorRow = { Code: string; Message: string; Total: number; LastAt: string }
export type MailOptions = { Transports: string[]; Types: string[] }

export type MailData = {
  Period: { From: string; To: string; All: boolean }
  Transport: string
  Type: string
  IncludeTests: boolean
  Sent: number
  Failed: number
  Total: number
  /** failed / (sent + failed), 0..1. */
  FailureRate: number
  Fallbacks: number
  /** Emails sent with tracking; the base of the open and click rates (0 rate when 0). */
  Tracked?: number
  Opened?: number
  Clicked?: number
  /** 0..1 over Tracked. Opens are approximate. */
  OpenRate?: number
  ClickRate?: number
  Daily: MailDay[]
  ByTransport: MailKeyRow[]
  ByType: MailKeyRow[]
  Errors: MailErrorRow[]
  Options: MailOptions
}

export type MailFilters = { transport: string; type: string; includeTests: boolean }

/** What every block of the page receives from the single resource. */
export type MailResource = {
  data: MailData | undefined
  loading: boolean
  error: unknown
  reload: () => void
}
