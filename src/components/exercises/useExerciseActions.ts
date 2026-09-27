"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { useRouter } from "next/navigation"
import {
  archiveExercise, deleteExercise, getExerciseUsage, unarchiveExercise, type ExerciseUsageEvent,
} from "@/api/exercises/catalog"
import { createCheckpoint, isStoredVersionId, publishDraft, restoreVersion, type TaskDTO } from "@/api/exercises/versions"
import { toast } from "@/components/ui/toast"
import { t } from "@/i18n/t"
import type { EditorPosition } from "@/lib/editorPosition"
import { ERR_EXERCISE_IN_USE, exerciseErrorCode, exerciseErrorMessage } from "@/lib/exerciseErrors"
import { positionForDraftIssue } from "@/lib/exerciseErrorNavigation"
import { exerciseHref } from "@/lib/exerciseRoutes"
import { draftSchema, identitySchema } from "@/lib/exerciseSchemas"
import type { ExerciseEditor } from "./useExerciseEditor"

export type DeployTarget = { exerciseId: string; versionId: string; variantId: string; tasks: TaskDTO[] }

export type UseExerciseActionsOptions = {
  editor: ExerciseEditor
  canWrite: boolean
  canDelete: boolean
  setMode: (mode: "view" | "edit") => void
  setPosition: Dispatch<SetStateAction<EditorPosition>>
  focusField: (path: PropertyKey[]) => void
}

export function useExerciseActions({ editor, canWrite, canDelete, setMode, setPosition, focusField }: UseExerciseActionsOptions) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [usage, setUsage] = useState<{ exerciseId: string; events: ExerciseUsageEvent[] } | null>(null)
  const exerciseId = editor.exercise?.ID ?? null

  useEffect(() => {
    if (!exerciseId || !canDelete) return
    let cancelled = false
    getExerciseUsage(exerciseId)
      .then((result) => { if (!cancelled) setUsage({ exerciseId, events: result.Events }) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [exerciseId, canDelete])

  async function run(action: () => Promise<void>): Promise<boolean> {
    setBusy(true)
    try {
      await action()
      return true
    } catch (cause) {
      toast.error(exerciseErrorMessage(cause))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function flushOrWarn(): Promise<boolean> {
    // An invalid identity is never sent, so flush() would report "not saved";
    // point the user at the field instead of a misleading save-failed toast.
    const identity = identitySchema.safeParse(editor.identityForm.getValues())
    if (!identity.success) {
      if (canWrite) setMode("edit")
      await editor.identityForm.trigger()
      setPosition((current) => ({ ...current, tab: "general" }))
      focusField(identity.error.issues[0]?.path ?? [])
      toast.error(t("admin.exPage.toast.invalidName"))
      return false
    }
    const ok = await editor.autosave.flush()
    if (!ok) toast.error(t("admin.exPage.toast.saveFailed"))
    return ok
  }

  async function publish(): Promise<void> {
    if (!exerciseId || !(await flushOrWarn())) return
    if (!(await editor.draftForm.trigger())) {
      const values = editor.draftForm.getValues()
      const parsed = draftSchema.safeParse(values)
      const issue = parsed.success ? null : parsed.error.issues[0]
      if (canWrite) setMode("edit")
      setPosition((current) => issue ? positionForDraftIssue(current, values, issue.path) : { ...current, tab: "variants" })
      if (issue) focusField(issue.path)
      toast.error(t("admin.exPage.toast.invalid"))
      return
    }
    await run(async () => {
      await publishDraft(exerciseId)
      await editor.reloadWorkingCopy()
      toast.success(t("admin.exPage.toast.published"))
    })
  }

  async function snapshot(note: string): Promise<boolean> {
    if (!exerciseId || !(await flushOrWarn())) return false
    return run(async () => {
      await createCheckpoint(exerciseId, note)
      toast.success(t("admin.exPage.toast.snapshot"))
    })
  }

  async function revert(): Promise<boolean> {
    const publishedId = editor.exercise?.PublishedVersionID
    if (!exerciseId || !publishedId || !(await flushOrWarn())) return false
    return run(async () => {
      await restoreVersion(exerciseId, publishedId)
      await editor.reloadWorkingCopy()
      toast.success(t("admin.exPage.toast.reverted"))
    })
  }

  async function restore(versionId: string): Promise<void> {
    if (!exerciseId || !isStoredVersionId(versionId)) return
    await run(async () => {
      await restoreVersion(exerciseId, versionId)
      toast.success(t("admin.exPage.toast.restored"))
      router.push(exerciseHref(exerciseId))
    })
  }

  async function archive(): Promise<boolean> {
    if (!exerciseId || !(await flushOrWarn())) return false
    return run(async () => {
      editor.setExercise(await archiveExercise(exerciseId))
      setMode("view")
      toast.success(t("admin.exPage.toast.archived"))
    })
  }

  async function unarchive(): Promise<void> {
    if (!exerciseId) return
    await run(async () => {
      editor.setExercise(await unarchiveExercise(exerciseId))
      toast.success(t("admin.exPage.toast.unarchived"))
    })
  }

  async function remove(): Promise<boolean> {
    if (!exerciseId) return false
    await editor.autosave.flush()
    setBusy(true)
    try {
      await deleteExercise(exerciseId)
      toast.success(t("admin.exPage.toast.deleted"))
      router.push("/exercises")
      return true
    } catch (cause) {
      toast.error(exerciseErrorMessage(cause))
      // 409 without an event list: someone attached the exercise meanwhile — refresh the usage.
      if (exerciseErrorCode(cause) === ERR_EXERCISE_IN_USE) {
        const result = await getExerciseUsage(exerciseId).catch(() => null)
        if (result) setUsage({ exerciseId, events: result.Events })
      }
      return false
    } finally {
      setBusy(false)
    }
  }

  async function test(variantIndex: number): Promise<DeployTarget | null> {
    if (!exerciseId || !(await flushOrWarn())) return null
    const variant = editor.draftForm.getValues(`Variants.${variantIndex}`)
    const versionId = editor.getDraftVersionId()
    if (!variant?.ID || !versionId) {
      toast.error(t("admin.exPage.toast.saveFailed"))
      return null
    }
    return { exerciseId, versionId, variantId: variant.ID, tasks: variant.Tasks }
  }

  async function done(): Promise<void> {
    if (await flushOrWarn()) setMode("view")
  }

  async function openVersion(versionId: string | null): Promise<void> {
    if (!exerciseId) return
    await editor.autosave.flush()
    router.push(exerciseHref(exerciseId, versionId))
  }

  return {
    busy,
    usageEvents: usage && usage.exerciseId === exerciseId ? usage.events : [],
    publish, snapshot, revert, restore, archive, unarchive, remove, test, done, openVersion,
  }
}
