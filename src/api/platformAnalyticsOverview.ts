// Response types of the platform analytics sections «Огляд» (overview) and
// «Користувачі» (users). JSON is PascalCase like the rest of the API.
export type OverviewPeriod = {
  From: string
  To: string
  All: boolean
  /** The window of the same length before this one; null for all time. */
  Previous: { From: string; To: string } | null
}

/** A value of the period and the previous period's one (null for all time). */
export type Metric = { Value: number; Previous: number | null }

export type OverviewReport = {
  Period: OverviewPeriod
  Users: { Total: number; New: Metric; Active: Metric }
  /** Events by lifecycle status now; Finished also holds withdrawn events. */
  Events: { Draft: number; Published: number; Running: number; Finished: number; Archived: number; Total: number; New: Metric }
  Participants: { Registered: Metric; Approved: Metric }
  Activity: { Attempts: Metric; Solves: Metric }
  Mail: { Sent: Metric; Failed: Metric }
  Stands: { Ready: number; Creating: number; Failed: number; Failures: Metric }
  Series: {
    NewUsers: { Day: string; New: number }[]
    Activity: { Day: string; Attempts: number; Solves: number }[]
    Mail: { Day: string; Sent: number; Failed: number }[]
  }
}

/** Exclusive sign-in method groups: they sum to the accounts. */
export type SignInMethod = "password" | "google" | "both" | "none"

export type UsersReport = {
  Period: OverviewPeriod
  Total: number
  Blocked: number
  ByRole: { Role: string; Count: number }[]
  New: Metric
  Active: Metric
  /** Mean daily active accounts over the period. */
  AvgDailyActive: number
  Registrations: { Day: string; New: number }[]
  /** Daily (DAU) and weekly (WAU, trailing 7 days) active accounts per UTC day. */
  ActiveByDay: { Day: string; DAU: number; WAU: number }[]
  /** Total: all current accounts of the group; New: registered in the period. */
  Methods: { Method: SignInMethod; Total: number; New: number }[]
  Retention: { One: number; Two: number; ThreePlus: number; Never: number }
}

/** One row of the most active accounts (super_admin only). */
export type UsersPerson = { ID: string; Name: string; Email: string; Role: string; EventsJoined: number; Solves: number }
