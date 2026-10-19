import { t } from "@/i18n/t"
import { tPlural } from "@/i18n/plural"
import { formatNumber } from "@/lib/locale"

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null
}

export function monitoringCount(value: unknown): number | null {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/.test(value))) return null
  const count = Number(value)
  return Number.isSafeInteger(count) && count >= 0 ? count : null
}

/** The capacity an agent reports for the platform (protojson of its CapacityResponse). capacity* is the maximum the resource
 * calendar plans with: the lab nodes that exist plus the ones the cluster may still add (null: no limit). current* is what the
 * nodes that exist give now (null: the agent does not say). reserved* is what the platform's labs request. */
export type CapacityMetrics = {
  capacityCpuMillicores: number | null
  capacityMemoryBytes: number | null
  reservedCpuMillicores: number
  reservedMemoryBytes: number
  currentCpuMillicores: number | null
  currentMemoryBytes: number | null
}

const CAPACITY_FIELDS = ["tenant", "hasCpuQuota", "hasMemoryQuota", "cpuReservedMillicores", "memoryReservedBytes", "hasCurrent"]

export function capacityMetrics(payload: unknown): CapacityMetrics | null {
  const source = record(payload)
  if (!source || !CAPACITY_FIELDS.some((field) => Object.hasOwn(source, field))) return null
  // protojson leaves out zero values and false flags.
  const count = (field: string) => monitoringCount(source[field]) ?? 0
  const current = source.hasCurrent === true
  return {
    capacityCpuMillicores: source.hasCpuQuota === true ? count("cpuQuotaMillicores") : null,
    capacityMemoryBytes: source.hasMemoryQuota === true ? count("memoryQuotaBytes") : null,
    reservedCpuMillicores: count("cpuReservedMillicores"),
    reservedMemoryBytes: count("memoryReservedBytes"),
    currentCpuMillicores: current ? count("currentCpuMillicores") : null,
    currentMemoryBytes: current ? count("currentMemoryBytes") : null,
  }
}

export function formatCpu(millicores: number | null): string {
  if (millicores === null) return "—"
  // Never round a real, small value to «0»: below one vCPU it reads in millicores.
  if (millicores > 0 && millicores < 1000) return tPlural("admin.labs.unit.mcpu", Math.round(millicores), { value: formatNumber(millicores, { maximumFractionDigits: 0 }) })
  return t("admin.labs.unit.vcpu", { value: formatNumber(millicores / 1000, { maximumFractionDigits: 2 }) })
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—"
  const [unit, scale] = bytes >= 1024 ** 3 ? ["admin.labs.unit.gib", 1024 ** 3] as const
    : bytes >= 1024 ** 2 ? ["admin.labs.unit.mib", 1024 ** 2] as const
    : bytes >= 1024 ? ["admin.labs.unit.kib", 1024] as const
    : ["admin.labs.unit.b", 1] as const
  return t(unit, { value: formatNumber(bytes / scale, { maximumFractionDigits: 1 }) })
}

type ObservationDetails = {
  groups: Array<{ name: string; phase: string; vpnRegistered: boolean | null }>
  labs: Array<{ name: string; phase: string; devices: Array<{ name: string; cpu: number | null; memory: number | null; restarts: number | null }> }>
  clients: Array<{ name: string; ip: string; received: number | null; sent: number | null }>
  rules: Array<{ client: string; lab: string; action: string; packets: number | null; bytes: number | null }>
  deleted: Array<{ kind: string; name: string }>
}

function stringField(source: RecordValue, key: string): string {
  return typeof source[key] === "string" ? source[key] : ""
}

function entries(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.flatMap((item) => { const row = record(item); return row ? [row] : [] }) : []
}

/** Only explicitly approved monitoring fields may reach the admin UI. */
export function monitoringUpdateDetails(payload: unknown): ObservationDetails {
  const source = record(payload) ?? {}
  return {
    groups: entries(source.groups).map((group) => {
      const status = record(group.status) ?? {}
      return { name: stringField(group, "name"), phase: stringField(status, "phase"), vpnRegistered: typeof status.vpnRegistered === "boolean" ? status.vpnRegistered : null }
    }),
    labs: entries(source.labs).map((lab) => {
      const status = record(lab.status) ?? {}
      return {
        name: stringField(lab, "name"), phase: stringField(status, "phase"),
        devices: entries(status.devices).map((device) => ({
          name: stringField(device, "name"),
          cpu: device.usageAvailable === true ? monitoringCount(device.cpuMillicores ?? 0) : null,
          memory: device.usageAvailable === true ? monitoringCount(device.memoryBytes ?? 0) : null,
          restarts: monitoringCount(device.restartCount ?? 0),
        })),
      }
    }),
    clients: entries(source.clients).map((client) => {
      const status = record(client.status) ?? {}
      const statistics = record(status.statistics)
      return {
        name: stringField(client, "name"), ip: stringField(status, "assignedIp"),
        received: statistics ? monitoringCount(statistics.rxBytes ?? 0) : null,
        sent: statistics ? monitoringCount(statistics.txBytes ?? 0) : null,
      }
    }),
    rules: entries(source.policies).flatMap((policy) => {
      const status = record(policy.status) ?? {}
      return entries(status.rules).map((rule) => ({
        client: stringField(rule, "clientName"), lab: stringField(rule, "labName"),
        action: stringField(rule, "action"), packets: monitoringCount(rule.packets ?? 0), bytes: monitoringCount(rule.bytes ?? 0),
      }))
    }),
    deleted: entries(source.deletedKeys).map((item) => ({ kind: stringField(item, "kind"), name: stringField(item, "name") })),
  }
}

// Key of the agent wired from deployment config; the backend stores it without a name.
export const CONFIGURED_PRIMARY_AGENT_KEY = "configured-primary"

export function agentDisplayName(agent: { Key: string; Name?: string }): string {
  return agent.Key === CONFIGURED_PRIMARY_AGENT_KEY ? t("admin.labs.agent.primary") : agent.Name || agent.Key
}
