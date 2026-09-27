import type { Version } from "@/api/exercises/versions"
import type { DraftFormValues } from "@/lib/exerciseSchemas"

export type IdUpdate = {
  path: `Variants.${number}.ID` | `Variants.${number}.Tasks.${number}.ID`
  value: string
}

/**
 * IDs the backend assigned to variants/tasks the form still holds as "".
 * Adopted only while the saved structure matches the form (same variant and
 * task counts); otherwise the next autosave sends the items again and the IDs
 * are adopted from that response. Existing IDs are never touched.
 */
export function serverIdUpdates(form: DraftFormValues, saved: Version): IdUpdate[] {
  if (form.Variants.length !== saved.Variants.length) return []
  if (form.Variants.some((variant, i) => variant.Tasks.length !== saved.Variants[i].Tasks.length)) return []
  const updates: IdUpdate[] = []
  form.Variants.forEach((variant, vi) => {
    const savedVariant = saved.Variants[vi]
    if (!variant.ID && savedVariant.ID) updates.push({ path: `Variants.${vi}.ID`, value: savedVariant.ID })
    variant.Tasks.forEach((task, ti) => {
      const id = savedVariant.Tasks[ti].ID
      if (!task.ID && id) updates.push({ path: `Variants.${vi}.Tasks.${ti}.ID`, value: id })
    })
  })
  return updates
}
