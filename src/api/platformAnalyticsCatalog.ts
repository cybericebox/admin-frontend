// Response types of the platform analytics sections «Заходи» (events) and
// «Каталог завдань» (tasks). JSON is PascalCase like the rest of the API.
export type AnalyticsPeriod = { From: string; To: string; All: boolean }

export type EventLifecycle = "not_published" | "published" | "started" | "finished" | "withdrawn"

export type EventsAnalytics = {
  Period: AnalyticsPeriod
  Totals: { Events: number; Created: number; Started: number; Registrations: number }
  /** One point per UTC day of the period. */
  Series: { Day: string; EventsCreated: number; EventsStarted: number; Registrations: number }[]
  /** Every lifecycle status, empty ones included. */
  Statuses: { Status: EventLifecycle; Events: number }[]
  /** The newest events of the period (at most EventsLimit); EventsTotal is the full count. */
  Events: EventAnalyticsRow[]
  EventsTotal: number
  EventsLimit: number
  Upcoming: UpcomingEvent[]
}

export type EventAnalyticsRow = {
  ID: string
  Tag: string
  Name: string
  Status: EventLifecycle
  /** Null for an event that was never scheduled. */
  StartAt: string | null
  FinishAt: string | null
  /** Seconds; null until the event has a finish. */
  DurationSeconds: number | null
  Participants: number
  Teams: number
  Solves: number
  TeamsSolved: number
  /** Teams with at least one solve / teams, 0..1. */
  CompletionRate: number
}

export type UpcomingEvent = {
  ID: string
  Tag: string
  Name: string
  StartAt: string
  Published: boolean
  Registrations: number
}

export type TaskCalibration = "ok" | "too_easy" | "too_hard" | "insufficient" | "unknown"

export type TaskUsageRow = {
  ExerciseID: string
  TaskID: string
  Exercise: string
  Task: string
  /** Difficulty: trivial, easy, medium, hard, insane (empty when unknown). */
  Level: string
  /** The exercise tags. */
  Categories: string[]
  EventsUsed: number
  Attempts: number
  TeamsTried: number
  TeamsEngaged: number
  Solves: number
  TeamsHinted: number
  /** Solves / teams that tried, 0..1. */
  SolveRate: number
  /** Teams that unlocked a hint / teams that opened or tried, 0..1. */
  HintRate: number
  /** Seconds; null while nobody solved the task. */
  MedianSolveSeconds: number | null
  Calibration: TaskCalibration
}

export type TasksAnalytics = {
  Period: AnalyticsPeriod
  Totals: { TasksUsed: number; Uses: number; Attempts: number; Solves: number; NeverSolved: number; SolveRate: number }
  /** Options of the filters (unfiltered by the current selection). */
  Categories: string[]
  Levels: string[]
  Tasks: TaskUsageRow[]
  TasksTotal: number
  TasksLimit: number
  Unsolved: TaskUsageRow[]
  UnsolvedTotal: number
  ByCategory: { Category: string; Tasks: number; Uses: number }[]
  ByLevel: { Level: string; Tasks: number; TeamsTried: number; Solves: number; SolveRate: number }[]
}
