import type { DraftFormValues, IdentityFormValues } from "@/lib/exerciseSchemas"

export type EditorPosition = {
  tab: "general" | "variants"
  variant: number
  section: "tasks" | "topology"
  task: number
  topologySection: string
  devicePanel: "basic" | "resources" | "interfaces" | "env" | "external"
  interface: number
  env: number
  scrollTop: number
}

export const DEFAULT_EDITOR_POSITION: EditorPosition = {
  tab: "general",
  variant: 0,
  section: "tasks",
  task: 0,
  topologySection: "diagram",
  devicePanel: "basic",
  interface: 0,
  env: 0,
  scrollTop: 0,
}

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

export function editorPositionStorageKey(userId: string, exerciseId: string): string {
  return `cybericebox.admin.exercise-position.v1:${userId}:${exerciseId}`
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

function normalizeEditorPosition(position: unknown): EditorPosition | null {
  if (!isRecord(position)) return null
  return {
    tab: position.tab === "variants" ? "variants" : "general",
    variant: Number.isSafeInteger(position.variant) && Number(position.variant) >= 0 ? Number(position.variant) : 0,
    section: position.section === "topology" ? "topology" : "tasks",
    task: Number.isSafeInteger(position.task) && Number(position.task) >= 0 ? Number(position.task) : 0,
    topologySection: typeof position.topologySection === "string" ? position.topologySection : "diagram",
    devicePanel: position.devicePanel === "resources" || position.devicePanel === "interfaces" || position.devicePanel === "env" || position.devicePanel === "external" ? position.devicePanel : "basic",
    interface: Number.isSafeInteger(position.interface) && Number(position.interface) >= 0 ? Number(position.interface) : 0,
    env: Number.isSafeInteger(position.env) && Number(position.env) >= 0 ? Number(position.env) : 0,
    scrollTop: typeof position.scrollTop === "number" && Number.isFinite(position.scrollTop) && position.scrollTop >= 0 ? position.scrollTop : 0,
  }
}

export function parseEditorPosition(raw: string | null): EditorPosition | null {
  if (!raw) return null
  try { return normalizeEditorPosition(JSON.parse(raw) as unknown) } catch { return null }
}

function isStoredDraft(value: unknown): value is DraftFormValues {
  if (!isRecord(value) || typeof value.AdminNote !== "string" || typeof value.RegenerateFlagsOnPublish !== "boolean" || !Array.isArray(value.Variants)) return false
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
