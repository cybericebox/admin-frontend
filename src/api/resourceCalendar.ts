/**
 * resourceCalendar.ts — typed client for the resource calendar (reservations, change requests,
 * alarms, the test pool). Super-admin only: infrastructure.read for GET, infrastructure.write
 * for the rest. JSON PascalCase, times RFC3339 UTC, a slot is 15 minutes.
 */
import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client"

const BASE = "/api/infrastructure/calendar"

export type Amount = { CPUMillicores: number; MemoryBytes: number }

export type Share = { AgentID: string; AgentName: string; Units: number }

export type AlarmKind = "not_placed" | "agent_lost" | "agent_shrunk" | "not_connected"

export type Alarm = {
  ID: string
  Kind: AlarmKind
  ReservationID: string
  EventID: string
  EventName: string
  EventTag: string
  AgentID: string
  AgentName: string
  Units: number
  Stage: number
  Shortage: Amount
  RaisedAt: string
  UpdatedAt: string
  ResolvedAt: string | null
  AckedBy: string
  AckedAt: string | null
}

export type ReservationKind = "event" | "test_booking"

export type Reservation = {
  ID: string
  Kind: ReservationKind
  EventID: string
  EventName: string
  EventTag: string
  OwnerID: string
  From: string
  To: string
  Teams: number
  PerTeam: Amount
  LargestDevice: Amount
  BufferPercent: number
  Dynamic: Amount
  TailGapMinutes: number
  Size: Amount
  Placement: Share[] | null
  Unplaced: number
  Covered: boolean
  Used: Amount
  Alarms: Alarm[] | null
}

export type Conflict = { From: string; To: string; ReservationIDs: string[] | null; PoolShort: boolean; Unplaced: number; Short: Amount }
export type Segment = { From: string; To: string; Reserved: Amount }

export type CapacityAgent = {
  ID: string
  Name: string
  Priority: number
  Used: boolean
  Why: "" | "disabled" | "below_requirements" | "no_capacity"
  Connected: boolean
  Capacity: Amount
  CPUUnlimited: boolean
  MemoryUnlimited: boolean
  DeviceMax: Amount
}

export type Capacity = {
  Total: Amount
  CPUUnlimited: boolean
  MemoryUnlimited: boolean
  TestPool: Amount
  Agents: CapacityAgent[] | null
}

/** An agent maintenance window announced on the cluster side. To is null for a window without an end; Left is the capacity the agent still gives meanwhile. */
export type Maintenance = { AgentID: string; AgentName: string; Name: string; Reason: string; From: string; To: string | null; Left: Amount }

export type Timeline = {
  From: string
  To: string
  SlotMinutes: number
  Reservations: Reservation[] | null
  Reserved: Segment[] | null
  Conflicts: Conflict[] | null
  Capacity: Capacity
  Maintenance: Maintenance[] | null
  MaintenanceReported: boolean
}

export type AgentStat = { ID: string; Name: string; Priority: number; Used: boolean; Connected: boolean; Capacity: Amount; Allocated: Amount; InUse: Amount; Free: Amount }
export type EventStat = { ReservationID: string; EventID: string; EventName: string; EventTag: string; From: string; To: string; Allocated: Amount; InUse: Amount; Free: Amount; Covered: boolean }
export type Stats = { At: string; Agents: AgentStat[] | null; Events: EventStat[] | null; TestPool: Amount; TestLabsHeld: Amount; PendingChangeRequests: number; OpenAlarms: number }

export type Settings = { TestPool: Amount; UpdatedAt: string }
export type SettingsResult = { Settings: Settings; Conflicts: Conflict[] | null }

export type ReservationResult = { Reservation: Reservation; Conflicts: Conflict[] | null; Saved: boolean }

/** Every field is optional: what is left out keeps the plan's default (or the saved value). */
export type ReservationInput = {
  Teams?: number
  PerTeam?: Amount
  BufferPercent?: number
  Dynamic?: Amount
  TailGapMinutes?: number
  WindowStart?: string
  WindowEnd?: string
  AllowConflicts?: boolean
  DryRun?: boolean
}

export type ChangeStatus = "pending" | "approved" | "rejected"

export type ChangeRequest = {
  ID: string
  ReservationID: string
  EventID: string
  EventName: string
  EventTag: string
  RequestedBy: string
  RequestedAt: string
  Size: Amount | null
  Dynamic: Amount | null
  WindowStart: string | null
  WindowEnd: string | null
  Reason: string
  Status: ChangeStatus
  DecidedBy: string
  DecidedAt: string | null
  DecisionNote: string
  CurrentSize: Amount
  CurrentFrom: string
  CurrentTo: string
}

export const getTimeline = (from: string, to: string) => apiGet<Timeline>(`${BASE}/timeline?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
export const getCapacity = () => apiGet<Capacity>(`${BASE}/capacity`)
export const getStats = () => apiGet<Stats>(`${BASE}/stats`)
export const getSettings = () => apiGet<Settings>(`${BASE}/settings`)
export const putSettings = (body: { TestPool: Amount; AllowConflicts?: boolean }) => apiPut<SettingsResult>(`${BASE}/settings`, body)

export const getEventReservation = (eventID: string) => apiGet<ReservationResult>(`${BASE}/events/${encodeURIComponent(eventID)}/reservation`)
export const putEventReservation = (eventID: string, body: ReservationInput) => apiPut<ReservationResult>(`${BASE}/events/${encodeURIComponent(eventID)}/reservation`, body)
export const deleteEventReservation = (eventID: string) => apiDelete<void>(`${BASE}/events/${encodeURIComponent(eventID)}/reservation`)
export const replanReservation = (reservationID: string, allowConflicts: boolean) => apiPost<ReservationResult>(`${BASE}/reservations/${encodeURIComponent(reservationID)}/replan`, { AllowConflicts: allowConflicts })

export const listChangeRequests = (filter: { status?: ChangeStatus; eventID?: string } = {}) => {
  const query = new URLSearchParams()
  if (filter.status) query.set("status", filter.status)
  if (filter.eventID) query.set("eventID", filter.eventID)
  const text = query.toString()
  return apiGet<ChangeRequest[]>(`${BASE}/change-requests${text ? `?${text}` : ""}`)
}
export const decideChangeRequest = (requestID: string, body: { Approve: boolean; Note: string; AllowConflicts?: boolean }) => apiPost<ChangeRequest>(`${BASE}/change-requests/${encodeURIComponent(requestID)}/decision`, body)

export const listOpenAlarms = () => apiGet<Alarm[]>(`${BASE}/alarms?open=1`)
export const acknowledgeAlarm = (alarmID: string) => apiPost<Alarm>(`${BASE}/alarms/${encodeURIComponent(alarmID)}/acknowledge`, {})
export const recheckNow = () => apiPost<void>(`${BASE}/recheck`, {})
