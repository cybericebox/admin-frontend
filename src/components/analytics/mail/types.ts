// GET /api/analytics/mail (PascalCase JSON). Aggregates only, no recipient addresses.
export type MailDay = { Day: string; Sent: number; Failed: number; Fallbacks: number }
export type MailKeyRow = { Key: string; Sent: number; Failed: number; Fallbacks: number; Total: number; FailureRate: number }
export type MailErrorRow = { Code: string; Message: string; Total: number; LastAt: string }
export type MailOptions = { Transports: string[]; Types: string[] }

/** Conversion funnels; transport / type filters do not apply. Rates are 0..1 or null. */
export type MailFunnels = {
  Invitations: { Sent: number; Accepted: number; AcceptRate: number | null; MedianAcceptSeconds: number | null }
  Registration: { Started: number; Completed: number; CompletionRate: number | null }
  Applications: { Submitted: number; Decided: number; Approved: number; Rejected: number; DecidedRate: number | null; ApprovedRate: number | null; RejectedRate: number | null; MedianDecisionSeconds: number | null }
}

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
  Daily: MailDay[]
  ByTransport: MailKeyRow[]
  ByType: MailKeyRow[]
  Errors: MailErrorRow[]
  Options: MailOptions
  /** Absent on an older backend. */
  Funnels?: MailFunnels
}

export type MailFilters = { transport: string; type: string; includeTests: boolean }

/** What every block of the page receives from the single resource. */
export type MailResource = {
  data: MailData | undefined
  loading: boolean
  error: unknown
  reload: () => void
}
