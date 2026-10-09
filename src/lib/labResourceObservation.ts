import type { ManagedGroupView, ManagedLabView } from "@/api/labLifecycle"
import { t } from "@/i18n/t"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { UI_LOCALE } from "@/lib/locale"

/** Currency is producer-owned; an old revision cannot confirm current lifecycle. */
export function currentObservation(lab: ManagedLabView | ManagedGroupView): boolean {
  return lab.Revision === lab.ObservedRevision && lab.AgentUID !== "" && lab.ObservedAt !== null
}

function safeDecimal(value: string): number | null {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}

export function decimalCpu(value: string): string {
  const number = safeDecimal(value)
  // The familiar vCPU formatter shows two decimals. Keep exact mCPU if it would round.
  if (number !== null && (number < 1000 || number % 10 === 0)) return formatCpu(number)
  return t("admin.labs.resources.exactMcpu", { value: BigInt(value).toLocaleString(UI_LOCALE) })
}

export function decimalMemory(value: string): string {
  const number = safeDecimal(value)
  const scale = number === null ? null : number >= 1024 ** 3 ? 1024 ** 3 : number >= 1024 ** 2 ? 1024 ** 2 : number >= 1024 ? 1024 : 1
  // Test unit precision with integers, without overflowing Number on large safe values.
  if (number !== null && scale !== null && BigInt(value) * BigInt(10) % BigInt(scale) === BigInt(0)) return formatBytes(number)
  return t("admin.labs.unit.b", { value: BigInt(value).toLocaleString(UI_LOCALE) })
}
