"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createExercise, getExercise, updateExercise, updateExerciseKeepalive, type Exercise } from "@/api/exercises/catalog"
import { getDraft, getVersion, isStoredVersionId, saveDraft, saveDraftKeepalive, type Version } from "@/api/exercises/versions"
import { toast } from "@/components/ui/toast"
import { t } from "@/i18n/t"
import {
  draftSchema, emptyDraft, identitySchema, toDraftFormValues, toSaveDraftInput,
  type DraftFormValues, type IdentityFormValues,
} from "@/lib/exerciseSchemas"
import {
  clearPendingChanges, mergePendingDraft, pendingBufferKey, readPendingChanges, writePendingChanges,
} from "@/lib/exercisePendingBuffer"
import { capturedDraftIds, serverIdUpdates } from "@/lib/serverIdUpdates"
import { useExerciseAutosave, type ExerciseAutosave } from "./useExerciseAutosave"

export type ExerciseLoadState = "loading" | "ready" | "notFound"

export type UseExerciseEditorOptions = {
  exerciseId: string | null
  versionId: string | null
  editable: boolean
  canWrite: boolean
  userId: string | null
  onCreated: (exercise: Exercise) => void
  onPendingRestored: () => void
}

export type ExerciseEditor = {
  loadState: ExerciseLoadState
  exercise: Exercise | null
  setExercise: (exercise: Exercise) => void
  version: Version | null
  identityForm: UseFormReturn<IdentityFormValues>
  draftForm: UseFormReturn<DraftFormValues>
  autosave: ExerciseAutosave
  getDraftVersionId: () => string
  reloadWorkingCopy: () => Promise<void>
}

function identityOf(exercise: Exercise): IdentityFormValues {
  return { Name: exercise.Name, Description: exercise.Description, Tags: exercise.Tags }
}

/** The empty working copy (Variants: []) opens like a new exercise: one empty variant. */
function workingCopyValues(version: Version): DraftFormValues {
  const values = toDraftFormValues(version)
  return values.Variants.length > 0 ? values : { ...emptyDraft(), AdminNote: values.AdminNote }
}

export function useExerciseEditor(options: UseExerciseEditorOptions): ExerciseEditor {
  const { exerciseId, versionId, editable, canWrite, userId } = options
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [loadState, setLoadState] = useState<ExerciseLoadState>(exerciseId ? "loading" : "ready")
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [version, setVersion] = useState<Version | null>(null)
  const exerciseIdRef = useRef<string | null>(exerciseId)
  const draftVersionIdRef = useRef("")
  const savedIdentityRef = useRef("")
  const suppressRef = useRef(false)
  const lastSignatureRef = useRef("")

  const identityForm = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { Name: "", Description: "", Tags: [] },
    mode: "onTouched",
  })
  const draftForm = useForm<DraftFormValues>({ resolver: zodResolver(draftSchema), defaultValues: emptyDraft(), mode: "onBlur" })

  const signature = useCallback(() => JSON.stringify([identityForm.getValues(), draftForm.getValues()]), [identityForm, draftForm])

  const rememberDraftVersion = useCallback((id: string) => { draftVersionIdRef.current = isStoredVersionId(id) ? id : "" }, [])

  const applyValues = useCallback((identity: IdentityFormValues, draft: DraftFormValues) => {
    suppressRef.current = true
    identityForm.reset(identity)
    draftForm.reset(draft)
    suppressRef.current = false
    lastSignatureRef.current = signature()
  }, [identityForm, draftForm, signature])

  const bufferKey = useCallback(() => userId ? pendingBufferKey(userId, exerciseIdRef.current) : null, [userId])

  const save = useCallback(async (): Promise<boolean> => {
    const identity = identityForm.getValues()
    const fullIdentity = identitySchema.safeParse(identity)
    let id = exerciseIdRef.current
    if (!id) {
      const name = identitySchema.shape.Name.safeParse(identity.Name)
      if (!name.success) return false
      const input = fullIdentity.success ? fullIdentity.data : { Name: name.data, Description: "", Tags: [] }
      const createdExercise = await createExercise(input)
      id = createdExercise.ID
      exerciseIdRef.current = id
      savedIdentityRef.current = JSON.stringify(input)
      if (userId) {
        writePendingChanges(pendingBufferKey(userId, id), identity, draftForm.getValues())
        clearPendingChanges(pendingBufferKey(userId, null))
      }
      setExercise(createdExercise)
      optionsRef.current.onCreated(createdExercise)
    } else if (fullIdentity.success) {
      const next = JSON.stringify(fullIdentity.data)
      if (next !== savedIdentityRef.current) {
        const updated = await updateExercise(id, fullIdentity.data)
        savedIdentityRef.current = next
        setExercise(updated)
      }
    }
    const payload = draftForm.getValues()
    const sent = capturedDraftIds(payload)
    const saved = await saveDraft(id, toSaveDraftInput(payload))
    rememberDraftVersion(saved.ID)
    const updates = serverIdUpdates(sent, saved, draftForm.getValues())
    if (updates.length > 0) {
      suppressRef.current = true
      for (const update of updates) draftForm.setValue(update.path, update.value)
      suppressRef.current = false
      lastSignatureRef.current = signature()
    }
    return true
  }, [identityForm, draftForm, signature, userId, rememberDraftVersion])

  const autosave = useExerciseAutosave({
    save,
    onSaved: () => {
      const id = exerciseIdRef.current
      if (id) void getExercise(id).then(setExercise).catch(() => undefined)
    },
    writeBuffer: () => {
      const key = bufferKey()
      if (key) writePendingChanges(key, identityForm.getValues(), draftForm.getValues())
    },
    clearBuffer: () => {
      const key = bufferKey()
      if (key) clearPendingChanges(key)
    },
    sendKeepalive: () => {
      const id = exerciseIdRef.current
      if (!id) return
      const identity = identitySchema.safeParse(identityForm.getValues())
      if (identity.success && JSON.stringify(identity.data) !== savedIdentityRef.current) updateExerciseKeepalive(id, identity.data)
      saveDraftKeepalive(id, toSaveDraftInput(draftForm.getValues()))
    },
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!exerciseId) {
        const pending = userId ? readPendingChanges(pendingBufferKey(userId, null)) : null
        if (!pending || cancelled) return
        applyValues(pending.identity, pending.draft)
        toast.success(t("admin.exPage.toast.pendingRestored"))
        optionsRef.current.onPendingRestored()
        autosave.markChanged()
        return
      }
      try {
        const [loaded, loadedVersion] = await Promise.all([
          getExercise(exerciseId),
          versionId ? getVersion(exerciseId, versionId) : getDraft(exerciseId),
        ])
        if (cancelled) return
        const key = !versionId && userId ? pendingBufferKey(userId, exerciseId) : null
        const pending = key ? readPendingChanges(key) : null
        const apply = pending !== null && canWrite && !loaded.ArchivedAt
        if (key && pending && !apply) clearPendingChanges(key)
        setExercise(loaded)
        setVersion(loadedVersion)
        if (!versionId) rememberDraftVersion(loadedVersion.ID)
        savedIdentityRef.current = JSON.stringify(identityOf(loaded))
        const serverDraft = workingCopyValues(loadedVersion)
        applyValues(apply ? pending.identity : identityOf(loaded), apply ? mergePendingDraft(serverDraft, pending.draft) : serverDraft)
        setLoadState("ready")
        if (apply) {
          toast.success(t("admin.exPage.toast.pendingRestored"))
          optionsRef.current.onPendingRestored()
          autosave.markChanged()
        }
      } catch {
        if (!cancelled) setLoadState("notFound")
      }
    }
    void load()
    return () => { cancelled = true }
    // Load once per route (the detail page remounts on id/version change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, versionId, userId])

  useEffect(() => {
    if (!editable || loadState !== "ready") return
    lastSignatureRef.current = signature()
    const onChange = () => {
      if (suppressRef.current) return
      const next = signature()
      if (next === lastSignatureRef.current) return
      lastSignatureRef.current = next
      autosave.markChanged()
    }
    // eslint-disable-next-line react-hooks/incompatible-library -- Imperative form subscription; React Compiler must not memoize this effect.
    const identityWatch = identityForm.watch(onChange)
    const draftWatch = draftForm.watch(onChange)
    return () => { identityWatch.unsubscribe(); draftWatch.unsubscribe() }
    // autosave.markChanged is a useCallback with a fixed dependency chain (stable across
    // renders) even though the `autosave` object it hangs off is re-memoized on every
    // status change; depending on the whole object would resubscribe watch on every
    // "pending"/"saving"/"saved" transition for no behavioral benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, loadState, identityForm, draftForm, signature, autosave.markChanged])

  const reloadWorkingCopy = useCallback(async () => {
    const id = exerciseIdRef.current
    if (!id) return
    const [loaded, draft] = await Promise.all([getExercise(id), getDraft(id)])
    setExercise(loaded)
    setVersion(draft)
    rememberDraftVersion(draft.ID)
    savedIdentityRef.current = JSON.stringify(identityOf(loaded))
    applyValues(identityOf(loaded), workingCopyValues(draft))
  }, [applyValues, rememberDraftVersion])

  const getDraftVersionId = useCallback(() => draftVersionIdRef.current, [])

  return {
    loadState, exercise, setExercise, version, identityForm, draftForm, autosave, getDraftVersionId, reloadWorkingCopy,
  }
}
