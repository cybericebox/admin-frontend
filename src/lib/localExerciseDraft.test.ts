import { describe, expect, it } from "vitest"
import { emptyDevice, emptyDraft } from "@/lib/exerciseSchemas"
import { DEFAULT_EDITOR_POSITION, localDraftStorageKey, makeLocalDraft, parseLocalDraft } from "./localExerciseDraft"

describe("local exercise draft", () => {
  it("keeps a complete independent copy of the form, including flags and secrets", () => {
    const draft = emptyDraft()
    draft.Variants[0].Tasks[0].Name = "Find the flag"
    draft.Variants[0].Tasks[0].Flag = ["ICE{never-store-this}"]
    const device = emptyDevice()
    device.Name = "web"
    device.EnvVars = [
      { Name: "PASSWORD", Value: "never-store-this-secret", Secret: true, HasValue: false },
      { Name: "MODE", Value: "training", Secret: false, HasValue: false },
    ]
    draft.Variants[0].Topology.Devices = [device]

    const snapshot = makeLocalDraft(
      { Name: "Exercise", Description: "Description", Tags: ["web"] }, draft,
      { ...DEFAULT_EDITOR_POSITION, tab: "variants", section: "topology", topologySection: `device:${device.ID}` },
      "created-1",
    )
    const serialized = JSON.stringify(snapshot)

    expect(serialized).toContain("ICE{never-store-this}")
    expect(snapshot.draft.Variants[0].Tasks[0].Flag).toEqual(["ICE{never-store-this}"])
    expect(snapshot.draft.Variants[0].Topology.Devices[0].EnvVars).toEqual([
      { Name: "PASSWORD", Value: "never-store-this-secret", Secret: true, HasValue: false },
      { Name: "MODE", Value: "training", Secret: false, HasValue: false },
    ])
    expect(snapshot.omitted).toEqual({ flags: 0, secrets: 0 })
    expect(snapshot.createdId).toBe("created-1")
    expect(snapshot.position.topologySection).toBe(`device:${device.ID}`)
    expect(parseLocalDraft(serialized)?.updatedAt).toBe(snapshot.updatedAt)
    expect(draft.Variants[0].Tasks[0].Flag).toEqual(["ICE{never-store-this}"])
    draft.Variants[0].Tasks[0].Flag[0] = "changed later"
    expect(snapshot.draft.Variants[0].Tasks[0].Flag).toEqual(["ICE{never-store-this}"])
  })

  it("keeps the omitted-value warning for an older sanitized browser draft", () => {
    const snapshot = makeLocalDraft({ Name: "Old", Description: "", Tags: [] }, emptyDraft(), DEFAULT_EDITOR_POSITION, null)
    snapshot.omitted = { flags: 2, secrets: 1 }
    expect(parseLocalDraft(JSON.stringify(snapshot))?.omitted).toEqual({ flags: 2, secrets: 1 })
  })

  it("ignores malformed or unknown snapshots", () => {
    expect(parseLocalDraft("not json")).toBeNull()
    expect(parseLocalDraft('{"version":999}')).toBeNull()
    expect(parseLocalDraft('{"version":1,"identity":{},"draft":{}}')).toBeNull()
    expect(localDraftStorageKey("editor-1")).toBe("cybericebox.admin.exercise-draft.v1:editor-1")
  })
})
