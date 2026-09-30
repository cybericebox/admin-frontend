import { integrityKinds, type IntegrityLevel, type IntegritySignal } from "@/api/events/analytics"
import { t } from "@/i18n/t"

// Value formatting and the wording of the integrity signals. The wording is the event site's
// own (same terms, same sentences), so an organizer reads the same thing in both places.
const P = "admin.events.analytics"
const none = "—"
const wholeNumber = new Intl.NumberFormat("uk-UA")
const dateTime = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
const clock = new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

export const formatCount = (value: number) => wholeNumber.format(value)
export const formatDateTime = (iso: string | null | undefined) => iso ? dateTime.format(new Date(iso)) : none
export const formatClock = (iso: string) => clock.format(new Date(iso))

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return t(`${P}.time.seconds`, { s: total })
  const minutes = Math.floor(total / 60)
  if (total < 3600) {
    const rest = total % 60
    return rest === 0 ? t(`${P}.time.minutes`, { m: minutes }) : t(`${P}.time.minutesSeconds`, { m: minutes, s: rest })
  }
  if (total >= 86400) {
    const days = Math.floor(total / 86400)
    const restHours = Math.floor((total % 86400) / 3600)
    return restHours === 0 ? t(`${P}.time.days`, { d: days }) : t(`${P}.time.daysHours`, { d: days, h: restHours })
  }
  const hours = Math.floor(total / 3600)
  const restMinutes = Math.floor((total % 3600) / 60)
  return restMinutes === 0 ? t(`${P}.time.hours`, { h: hours }) : t(`${P}.time.hoursMinutes`, { h: hours, m: restMinutes })
}

export function formatBytes(bytes: number): string {
  const units = [["admin.labs.unit.gib", 1024 ** 3], ["admin.labs.unit.mib", 1024 ** 2], ["admin.labs.unit.kib", 1024]] as const
  for (const [key, scale] of units) if (bytes >= scale) return t(key, { value: new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(bytes / scale) })
  return t("admin.labs.unit.b", { value: wholeNumber.format(bytes) })
}

export const percent = (part: number, whole: number) => whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%"

export const kindLabel = (kind: string) => (integrityKinds as readonly string[]).includes(kind) ? t(`${P}.integrity.kind.${kind}`) : kind
export const kindReason = (kind: string) => (integrityKinds as readonly string[]).includes(kind) ? t(`${P}.integrity.reason.${kind}`) : kind
export const levelLabel = (level: IntegrityLevel) => t(`${P}.level.${level}`)

export const teamNames = (signal: IntegritySignal) => signal.Teams.map((team) => team.Name).join(", ") || none

/** One sentence per signal; too_fast carries the level floor as Baseline. */
export function signalEvidence(signal: IntegritySignal, level: IntegrityLevel): string {
  const key = (name: string) => `${P}.integrity.evidence.${name}`
  switch (signal.Kind) {
    case "no_access": return t(key("no_access"))
    case "no_lab": return signal.Extra === 1 ? t(key("no_lab_knock"), { time: formatDateTime(signal.At) }) : t(key("no_lab"))
    case "too_fast": return t(key("too_fast"), { time: formatDuration(signal.Seconds), level: levelLabel(level), floor: formatDuration(signal.Baseline) })
    case "first_try_hard": return t(key("first_try_hard"), { teams: signal.Count, attempts: signal.Baseline })
    case "shared_wrong": return t(key(signal.Answers.length > 0 ? "shared_wrong" : "shared_wrong_teams"), { count: signal.Count, teams: teamNames(signal) })
    case "cross_flag": return t(key(signal.Owner?.SameTask ? "cross_flag_same" : "cross_flag"), { team: signal.Owner?.TeamName ?? none, task: signal.Owner?.ChallengeName ?? none, count: signal.Count, time: formatDateTime(signal.At) })
    case "burst": return t(key("burst"), { count: signal.Count, window: formatDuration(signal.Seconds), gap: formatDuration(signal.Baseline) })
    case "brute_force": return t(key("brute_force"), { count: signal.Count, window: formatDuration(signal.Seconds), rejected: signal.Extra })
    case "follows_solve": return t(key("follows_solve"), { gap: formatDuration(signal.Seconds), team: teamNames(signal), attempts: signal.Count })
  }
}
