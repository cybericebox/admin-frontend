/**
 * analytics.ts — read-only client for one event's analytics, the same reports the event
 * site's /manage/analytics shows. Platform admins are allowed on them: `admin` sees the
 * sections and the sensitive integrity evidence, `admin_viewer` the sections only (403 on
 * integrity). JSON PascalCase; envelope {Status,Data} unwrapped by client.ts.
 * Nothing here changes data: no review, no dismissal, no thresholds.
 */
import { apiGet, ApiError } from "@/api/client"

const base = (eventID: string) => `/api/events/${encodeURIComponent(eventID)}/manage/analytics`

export type EventAnalyticsAccess = { Sections: boolean; Sensitive: boolean }

export type EventAnalyticsOverview = {
  Participants: { Registered: number; Approved: number; Pending: number; Invited: number; Active: number }
  Teams: { Total: number; Admitted: number; Incomplete: number }
  Attempts: number
  Correct: number
  Solves: number
  HintsOpened: number
  HintPoints: number
  Stands: { Creating: number; Ready: number; Failed: number }
}

export const integrityKinds = ["cross_flag", "no_access", "no_lab", "too_fast", "first_try_hard", "shared_wrong", "burst", "brute_force", "follows_solve"] as const
export type IntegrityKind = (typeof integrityKinds)[number]
export const integrityLevels = ["elementary", "trivial", "easy", "medium", "hard", "insane"] as const
export type IntegrityLevel = (typeof integrityLevels)[number]

export type IntegrityTeamRef = { ID: string; Name: string }
export type IntegrityAnswer = { Value: string; Order: { TeamID: string; TeamName: string; At: string }[] }
export type IntegritySignal = {
  Kind: IntegrityKind
  Count: number
  Extra: number
  Seconds: number
  Baseline: number
  Teams: IntegrityTeamRef[]
  /** Low weight: shared_wrong on a task with a static flag. */
  Info: boolean
  Answers: IntegrityAnswer[]
  Owner: { TeamID: string; TeamName: string; ChallengeID: string; ChallengeName: string; SameTask: boolean } | null
  At: string | null
}
export type IntegrityItem = {
  TeamChallengeID: string
  TeamID: string
  TeamName: string
  ChallengeID: string
  ChallengeName: string
  Level: IntegrityLevel
  /** false: flagged before any solve (cross_flag); At is then the last suspicious submission. */
  Solved: boolean
  At: string
  Signals: IntegritySignal[]
  Review: { Note: string; ReviewedBy: string; ReviewedAt: string } | null
}
export type IntegrityCounts = Record<IntegrityKind, number>
export type EventIntegrity = { Items: IntegrityItem[]; Total: number; Counts: IntegrityCounts }
export type IntegrityReviewedFilter = "no" | "yes" | "all"
export type IntegrityFilters = { signal: IntegrityKind | null; reviewed: IntegrityReviewedFilter }
export const defaultIntegrityFilters: IntegrityFilters = { signal: null, reviewed: "no" }

export const getEventAnalyticsAccess = (eventID: string) => apiGet<EventAnalyticsAccess>(`${base(eventID)}/access`)
export const getEventAnalyticsOverview = (eventID: string) => apiGet<EventAnalyticsOverview>(`${base(eventID)}/overview`)

function normalizeSignal(signal: IntegritySignal): IntegritySignal {
  return {
    ...signal,
    Count: signal.Count ?? 0, Extra: signal.Extra ?? 0, Seconds: signal.Seconds ?? 0, Baseline: signal.Baseline ?? 0,
    Teams: signal.Teams ?? [], Info: signal.Info ?? false, Owner: signal.Owner ?? null, At: signal.At ?? null,
    Answers: (signal.Answers ?? []).map((answer) => ({ ...answer, Order: answer.Order ?? [] })),
  }
}

export async function getEventIntegrity(eventID: string, filters: IntegrityFilters = defaultIntegrityFilters): Promise<EventIntegrity> {
  const params = new URLSearchParams()
  if (filters.signal) params.set("signal", filters.signal)
  if (filters.reviewed !== "all") params.set("reviewed", filters.reviewed)
  const query = params.toString()
  const data = await apiGet<EventIntegrity>(`${base(eventID)}/integrity${query ? `?${query}` : ""}`)
  const counts = Object.fromEntries(integrityKinds.map((kind) => [kind, data.Counts?.[kind] ?? 0])) as IntegrityCounts
  return {
    Total: data.Total ?? 0,
    Counts: counts,
    Items: (data.Items ?? []).map((item) => ({
      ...item,
      Level: integrityLevels.includes(item.Level) ? item.Level : "medium",
      Solved: item.Solved ?? true,
      Signals: (item.Signals ?? []).map(normalizeSignal),
      Review: item.Review ?? null,
    })),
  }
}

/** The attempts journal on the event site, narrowed to the solve's team and task. */
export function integrityJournalPath(solve: { TeamID: string; ChallengeID: string }): string {
  return `/manage/submissions?${new URLSearchParams({ tab: "attempts", challengeId: solve.ChallengeID, teamId: solve.TeamID }).toString()}`
}

export const isForbidden = (error: unknown) => error instanceof ApiError && error.status === 403
