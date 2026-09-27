/**
 * exercisePendingBuffer.ts — browser safety net for edits the server has not
 * acknowledged yet. One entry per user and exercise ("new" before creation).
 * Flag values and environment-variable values (device secrets included) are
 * never written; on restore flags come back from the server copy and empty
 * env values mean "keep the stored value" on save.
 */
import type { DraftFormValues, IdentityFormValues } from "@/lib/exerciseSchemas"

const PREFIX = "cybericebox.admin.exercise-pending.v1:"

export type PendingChanges = {
  version: 1
  identity: IdentityFormValues
  draft: DraftFormValues
  updatedAt: number
}

export function pendingBufferKey(userId: string, exerciseId: string | null): string {
  return `${PREFIX}${userId}:${exerciseId ?? "new"}`
}

export function sanitizePendingDraft(draft: DraftFormValues): DraftFormValues {
  return {
    ...draft,
    Variants: draft.Variants.map((variant) => ({
      ...variant,
      Tasks: variant.Tasks.map((task) => ({ ...task, Flag: [] })),
      Topology: {
        ...variant.Topology,
        Devices: variant.Topology.Devices.map((device) => ({
          ...device,
          EnvVars: device.EnvVars.map((env) => ({ ...env, Value: "" })),
        })),
      },
    })),
  }
}

export function writePendingChanges(key: string, identity: IdentityFormValues, draft: DraftFormValues): boolean {
  const entry: PendingChanges = {
    version: 1,
    identity: { Name: identity.Name, Description: identity.Description, Tags: [...identity.Tags] },
    draft: sanitizePendingDraft(draft),
    updatedAt: Date.now(),
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(entry))
    return true
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isIdentity(value: unknown): value is IdentityFormValues {
  return isRecord(value) && typeof value.Name === "string" && typeof value.Description === "string" &&
    Array.isArray(value.Tags) && value.Tags.every((tag: unknown) => typeof tag === "string")
}

function isDraft(value: unknown): value is DraftFormValues {
  if (!isRecord(value) || typeof value.AdminNote !== "string" || !Array.isArray(value.Variants) || value.Variants.length === 0) return false
  return value.Variants.every((variant: unknown) =>
    isRecord(variant) && typeof variant.ID === "string" && Array.isArray(variant.Tasks) &&
    variant.Tasks.every((task: unknown) => isRecord(task) && typeof task.ID === "string" && Array.isArray(task.Flag)) &&
    isRecord(variant.Topology) && Array.isArray(variant.Topology.Devices) && Array.isArray(variant.Topology.Connections) &&
    variant.Topology.Devices.every((device: unknown) => isRecord(device) && Array.isArray(device.Interfaces) && Array.isArray(device.EnvVars)))
}

export function readPendingChanges(key: string): PendingChanges | null {
  let raw: string | null
  try { raw = window.localStorage.getItem(key) } catch { return null }
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.version !== 1 || !isIdentity(value.identity) || !isDraft(value.draft) ||
      typeof value.updatedAt !== "number") return null
    return { version: 1, identity: value.identity, draft: value.draft, updatedAt: value.updatedAt }
  } catch {
    return null
  }
}

export function clearPendingChanges(key: string): void {
  try { window.localStorage.removeItem(key) } catch { /* storage unavailable */ }
}

/** Buffered edits on top of the server copy; flag values of known tasks come from the server. */
export function mergePendingDraft(server: DraftFormValues, pending: DraftFormValues): DraftFormValues {
  const serverFlags = new Map<string, string[]>()
  for (const variant of server.Variants) {
    for (const task of variant.Tasks) {
      if (variant.ID && task.ID) serverFlags.set(`${variant.ID}/${task.ID}`, task.Flag)
    }
  }
  return {
    ...pending,
    Variants: pending.Variants.map((variant) => ({
      ...variant,
      Tasks: variant.Tasks.map((task) => ({ ...task, Flag: serverFlags.get(`${variant.ID}/${task.ID}`) ?? [] })),
    })),
  }
}
