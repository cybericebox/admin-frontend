// What each analytics report is when the backend sends nothing for a part of it (an empty or older answer): zero
// counts and empty lists, so a block shows its EmptyState instead of failing on a missing field.
import type { OverviewReport, UsersReport } from "@/api/platformAnalyticsOverview"
import type { EventsAnalytics, TasksAnalytics } from "@/api/platformAnalyticsCatalog"
import type { InfrastructureData } from "./infrastructure/types"
import type { MailData } from "./notifications/types"

const period = { From: "", To: "", All: true }
const metric = { Value: 0, Previous: null }
const stands = { Active: 0, Creating: 0, Ready: 0, Failed: 0, Removed: 0, Total: 0 }

export const EMPTY_OVERVIEW = {
  Period: period, Users: { Total: 0, New: metric, Active: metric },
  Events: { Draft: 0, Published: 0, Running: 0, Finished: 0, Archived: 0, Total: 0, New: metric },
  Participants: { Registered: metric, Approved: metric }, Activity: { Attempts: metric, Solves: metric }, Mail: { Sent: metric, Failed: metric },
  Stands: { Ready: 0, Creating: 0, Failed: 0, Failures: metric }, Series: { NewUsers: [], Activity: [], Mail: [] },
} as unknown as OverviewReport

export const EMPTY_USERS = {
  Period: period, Total: 0, Blocked: 0, ByRole: [], New: metric, Active: metric, AvgDailyActive: 0, Registrations: [], ActiveByDay: [], Methods: [],
  Retention: { One: 0, Two: 0, ThreePlus: 0, Never: 0 },
} as unknown as UsersReport

export const EMPTY_EVENTS = {
  Period: period, Totals: { Events: 0, Created: 0, Started: 0, Registrations: 0 }, Series: [], Statuses: [], Events: [], EventsTotal: 0, EventsLimit: 0, Upcoming: [],
} as unknown as EventsAnalytics

export const EMPTY_TASKS = {
  Period: period, Totals: { TasksUsed: 0, Uses: 0, Attempts: 0, Solves: 0, NeverSolved: 0, SolveRate: 0 }, Categories: [], Levels: [],
  Tasks: [], TasksTotal: 0, TasksLimit: 0, Unsolved: [], UnsolvedTotal: 0, ByCategory: [], ByLevel: [],
} as unknown as TasksAnalytics

export const EMPTY_INFRASTRUCTURE = {
  Period: period, Bucket: "day", Stands: stands, StandHours: { TotalHours: 0, TotalEvents: 0, Events: [] }, Peaks: [], PeakMax: 0, Failures: [],
  FailedLabs: 0, FailedStands: 0, Capacity: [], CapacityStepSeconds: 0,
} as unknown as InfrastructureData

export const EMPTY_MAIL = {
  Period: period, Channel: "", Transport: "", Type: "", IncludeTests: false, Sent: 0, Failed: 0, Total: 0, FailureRate: 0, Fallbacks: 0,
  Daily: [], ByTransport: [], ByType: [], Errors: [], Options: { Transports: [], Types: [] },
} as unknown as MailData

/** The answer over `defaults`: a missing or null part takes the default, objects merge part by part, lists and numbers come as sent. */
export function withDefaults<T>(answer: unknown, defaults: T): T {
  const isPlain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
  if (!isPlain(answer)) return defaults
  const out: Record<string, unknown> = { ...answer }
  for (const [key, fallback] of Object.entries(defaults as Record<string, unknown>)) {
    const given = out[key]
    if (given === undefined || given === null) out[key] = fallback
    else if (isPlain(fallback) && isPlain(given)) out[key] = withDefaults(given, fallback)
  }
  return out as T
}
