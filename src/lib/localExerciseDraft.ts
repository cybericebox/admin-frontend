import type { DraftFormValues, IdentityFormValues } from "@/lib/exerciseSchemas"
import { normalizeEditorPosition, type EditorPosition } from "@/lib/editorPosition"
export { DEFAULT_EDITOR_POSITION, editorPositionStorageKey, parseEditorPosition, type EditorPosition } from "@/lib/editorPosition"

export type LocalExerciseDraft = {
  version: 1
  identity: IdentityFormValues
  draft: DraftFormValues
  position: EditorPosition
  createdId: string | null
  omitted: { flags: number; secrets: number }
  pendingTag: string
  serverSynced: boolean
  updatedAt: number
}

const STORAGE_PREFIX = "cybericebox.admin.exercise-draft.v1:"

export function localDraftStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

export function existingDraftStorageKey(userId: string, exerciseId: string): string {
  return `cybericebox.admin.exercise-working.v1:${userId}:${exerciseId}`
}

export function parseExistingDraft(raw: string | null): { draft: DraftFormValues; updatedAt: number } | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.version !== 1 || !isStoredDraft(value.draft) ||
      typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) return null
    return { draft: withResourceDefaults(value.draft), updatedAt: value.updatedAt }
  } catch { return null }
}

/** Persist the complete new-exercise form for recovery after a browser reload. */
export function makeLocalDraft(
  identity: IdentityFormValues,
  draft: DraftFormValues,
  position: EditorPosition,
  createdId: string | null,
  pendingTag = "",
  serverSynced = false,
): LocalExerciseDraft {
  return {
    version: 1,
    identity: { Name: identity.Name, Description: identity.Description, Tags: [...identity.Tags] },
    draft: structuredClone(draft),
    position: { ...position },
    createdId,
    omitted: { flags: 0, secrets: 0 },
    pendingTag,
    serverSynced,
    updatedAt: Date.now(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isStoredDraft(value: unknown): value is DraftFormValues {
  if (!isRecord(value) || typeof value.AdminNote !== "string" || !Array.isArray(value.Variants)) return false
  return value.Variants.length > 0 && value.Variants.every((variant: unknown) =>
    isRecord(variant) && Array.isArray(variant.Tasks) && variant.Tasks.every((task: unknown) => isRecord(task) && Array.isArray(task.Flag)) &&
    isRecord(variant.Topology) && Array.isArray(variant.Topology.Devices) && Array.isArray(variant.Topology.Connections) &&
    variant.Topology.Devices.every((device: unknown) => isRecord(device) && Array.isArray(device.Interfaces) && Array.isArray(device.EnvVars)),
  )
}

function withResourceDefaults(draft: DraftFormValues): DraftFormValues {
  return {
    ...draft,
    Variants: draft.Variants.map((variant) => ({
      ...variant,
      Topology: {
        ...variant.Topology,
        Devices: variant.Topology.Devices.map((device) => {
          const resources: Record<string, unknown> = isRecord(device.Resources) ? device.Resources : {}
          const quantity = (key: "CPURequest" | "CPULimit" | "MemoryRequest" | "MemoryLimit") =>
            typeof resources[key] === "string" ? resources[key] : ""
          return {
            ...device,
            Resources: {
              CPURequest: quantity("CPURequest"), CPULimit: quantity("CPULimit"),
              MemoryRequest: quantity("MemoryRequest"), MemoryLimit: quantity("MemoryLimit"),
            },
          }
        }),
      },
    })),
  }
}

/** A corrupt or older local copy must never break the editor. */
export function parseLocalDraft(raw: string | null): LocalExerciseDraft | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.identity) ||
      typeof parsed.identity.Name !== "string" || typeof parsed.identity.Description !== "string" ||
      !Array.isArray(parsed.identity.Tags) || !parsed.identity.Tags.every((tag: unknown) => typeof tag === "string") ||
      !isStoredDraft(parsed.draft) || !isRecord(parsed.position)) return null
    const restoredPosition = normalizeEditorPosition(parsed.position)
    if (!restoredPosition) return null
    const draft = makeLocalDraft(parsed.identity as IdentityFormValues, withResourceDefaults(parsed.draft), restoredPosition,
      typeof parsed.createdId === "string" ? parsed.createdId : null,
      typeof parsed.pendingTag === "string" ? parsed.pendingTag : "",
      parsed.serverSynced === true)
    const legacyOmitted = isRecord(parsed.omitted) ? parsed.omitted : null
    return {
      ...draft,
      omitted: {
        flags: Number.isSafeInteger(legacyOmitted?.flags) && Number(legacyOmitted?.flags) >= 0 ? Number(legacyOmitted?.flags) : 0,
        secrets: Number.isSafeInteger(legacyOmitted?.secrets) && Number(legacyOmitted?.secrets) >= 0 ? Number(legacyOmitted?.secrets) : 0,
      },
      updatedAt: typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt) && parsed.updatedAt >= 0 && parsed.updatedAt <= 8.64e15 ? parsed.updatedAt : draft.updatedAt,
    }
  } catch {
    return null
  }
}
