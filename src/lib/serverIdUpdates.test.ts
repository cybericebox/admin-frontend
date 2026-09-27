import { describe, expect, it } from "vitest"
import type { Version } from "@/api/exercises/versions"
import { emptyDraft, emptyTask, toDraftFormValues } from "@/lib/exerciseSchemas"
import { serverIdUpdates } from "./serverIdUpdates"

function savedFrom(form: ReturnType<typeof emptyDraft>, ids: { variant: string; tasks: string[] }): Version {
  const values = structuredClone(form)
  values.Variants[0].ID = ids.variant
  values.Variants[0].Tasks.forEach((task, i) => { task.ID = ids.tasks[i] })
  return {
    ID: "draft-1", ExerciseID: "e1", Status: "draft", AdminNote: "", Label: "", CreatedAt: "", CreatedBy: null, PublishedAt: null,
    Variants: values.Variants.map((variant) => ({ ...variant, Topology: { ...variant.Topology, Devices: [] } })),
  }
}

describe("serverIdUpdates", () => {
  it("adopts IDs for new variants and tasks only", () => {
    const form = emptyDraft()
    form.Variants[0].Tasks.push({ ...emptyTask(), ID: "t-existing" })
    const saved = savedFrom(form, { variant: "v1", tasks: ["t1", "t-existing"] })
    expect(serverIdUpdates(form, saved)).toEqual([
      { path: "Variants.0.ID", value: "v1" },
      { path: "Variants.0.Tasks.0.ID", value: "t1" },
    ])
  })

  it("adopts nothing when the form structure changed while saving", () => {
    const form = emptyDraft()
    const saved = savedFrom(form, { variant: "v1", tasks: ["t1"] })
    form.Variants[0].Tasks.push(emptyTask())
    expect(serverIdUpdates(form, saved)).toEqual([])
  })

  it("returns nothing when every ID is already known", () => {
    const saved = savedFrom(emptyDraft(), { variant: "v1", tasks: ["t1"] })
    expect(serverIdUpdates(toDraftFormValues(saved), saved)).toEqual([])
  })
})
