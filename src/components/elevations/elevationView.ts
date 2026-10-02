import type { ElevationDevice, ElevationStatus } from "@/api/elevations"

/** The frame a task may use without an approval, and the platform ceiling for an approval. */
export const FRAME = { cpu: 250, memory: 1024 }
export const CEILING = { cpu: 1000, memory: 4096 }

const SCALE: Record<string, number> = { n: 1e-9, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, T: 1e12, Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4 }

function quantity(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)(n|u|m|k|M|G|T|Ki|Mi|Gi|Ti)?$/.exec(value.trim())
  return match ? Number(match[1]) * (match[2] ? SCALE[match[2]] : 1) : null
}

/** CPU quantity → millicores (null when unreadable). */
export function cpuMillis(value: string): number | null {
  const parsed = quantity(value)
  return parsed === null ? null : Math.round(parsed * 1000)
}

/** Memory quantity → MiB (null when unreadable). */
export function memoryMiB(value: string): number | null {
  const parsed = quantity(value)
  return parsed === null ? null : parsed / 1024 ** 2
}

export type DeviceLevel = "elevated" | "ceiling"

/** Above the platform ceiling an approval is not possible; above the frame it is the point of the request. */
export function deviceLevel(device: ElevationDevice): DeviceLevel {
  const cpu = cpuMillis(device.CPU)
  const memory = memoryMiB(device.Memory)
  if ((cpu !== null && cpu > CEILING.cpu) || (memory !== null && memory > CEILING.memory)) return "ceiling"
  return "elevated"
}

export function hasCeilingDevice(devices: ElevationDevice[]): boolean {
  return devices.some((device) => deviceLevel(device) === "ceiling")
}

export const STATUS_STYLE: Record<ElevationStatus, string> = {
  pending: "bg-primary/10 text-primary",
  approved: "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]",
  rejected: "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]",
}
