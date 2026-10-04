import type { Agent } from "@/api/agents"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { t } from "@/i18n/t"
import { tPlural } from "@/i18n/plural"

export const AGENT_NAME_MAX = 64
export const AGENT_PRIORITY_MAX = 10000
// The certificate is renewed automatically 10 days before its end: closer than that means the renewal failed.
export const CERT_WARN_DAYS = 10

export type AgentState = "archived" | "disabled" | "offline" | "unreachable" | "online"

export function agentState(agent: Agent): AgentState {
  if (agent.ArchivedAt) return "archived"
  if (!agent.Connected) return "offline"
  return agent.Healthy ? "online" : "unreachable"
}

export function parsePriority(text: string): number | null {
  const value = text.trim()
  if (!/^\d+$/.test(value)) return null
  const number = Number(value)
  return number <= AGENT_PRIORITY_MAX ? number : null
}

/** «4 vCPU · 8 ГіБ»; a null limit of a seen agent means no limit, an unseen agent has no capacity yet. */
export function capacityText(agent: Agent): string {
  const { CPUMillicores, MemoryBytes, SeenAt } = agent.Capacity
  if (!SeenAt) return "—"
  const unlimited = t("admin.agents.capacity.unlimited")
  return t("admin.agents.capacity.value", { cpu: CPUMillicores === null ? unlimited : formatCpu(CPUMillicores), memory: MemoryBytes === null ? unlimited : formatBytes(MemoryBytes) })
}

export function certDaysLeft(agent: Agent, now = Date.now()): number | null {
  if (!agent.CertExpiresAt) return null
  return Math.floor((new Date(agent.CertExpiresAt).getTime() - now) / 86_400_000)
}

/** The short feature chips of the row; null until the agent has reported its features. */
export function featureChips(agent: Agent): string[] | null {
  const f = agent.Features
  if (!f) return null
  const chips = [t(f.PersistenceAvailable ? "admin.agents.feature.persistenceOn" : "admin.agents.feature.persistenceOff"), t(f.ImageCacheEnabled ? "admin.agents.feature.cacheOn" : "admin.agents.feature.cacheOff")]
  if (f.SchedulerEnabled) chips.push(f.SchedulerMaxPods > 0 ? tPlural("admin.agents.feature.limits", f.SchedulerMaxPods) : t("admin.agents.feature.scheduler"))
  return chips
}

/** Agents by priority (smaller first), ties by name, archived last. */
export function sortAgents(items: Agent[]): Agent[] {
  return [...items].sort((a, b) => Number(!!a.ArchivedAt) - Number(!!b.ArchivedAt) || a.Priority - b.Priority || a.Name.localeCompare(b.Name))
}

/** «CPU на пристрій: потрібно 250m, є 100m» for each maximum below the platform frame. */
export function unmetLines(agent: Agent): string[] {
  const format = (resource: string, value: number) => resource === "deviceCpu" ? formatCpu(value) : resource === "deviceMemory" ? formatBytes(value) : String(value)
  return (agent.Unmet ?? []).map((item) => t(`admin.agents.requirements.${item.Resource}`, { required: format(item.Resource, item.Required), max: format(item.Resource, item.Max) }))
}
