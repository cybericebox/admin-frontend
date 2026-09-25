"use client"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { getExercise } from "@/api/exercises/catalog"
import { getExerciseCapabilities } from "@/api/exercises/capabilities"
import { getVersion, saveDraft, type Version } from "@/api/exercises/versions"
import {
  draftSchema, toDraftFormValues, toSaveDraftInput, type DraftFormValues,
} from "@/lib/exerciseSchemas"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import { DraftSettings, DraftVariants } from "@/components/exercises/DraftFields"
import { DeployTestDialog } from "@/components/exercises/DeployTestDialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingArea } from "@/components/ui/spinner"
import { Form } from "@/components/ui/form"
import { EditorPositionProvider, useEditorValidationFocus } from "@/components/exercises/EditorPosition"
import { DEFAULT_EDITOR_POSITION, editorPositionStorageKey, parseEditorPosition, type EditorPosition } from "@/lib/localExerciseDraft"
import { positionForDraftIssue } from "@/lib/exerciseErrorNavigation"
import { existingDraftStorageKey, parseExistingDraft } from "@/lib/localExerciseDraft"
import { useExerciseLeaveGuard } from "@/lib/useExerciseLeaveGuard"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

function DraftEditor() {
  const params = useSearchParams()
  const exerciseId = params.get("id") ?? ""
  const versionId = params.get("versionId") ?? ""
  const readOnly = versionId !== ""
  const { can, me } = useRole()
  const disabled = readOnly || !can("exercises.write")
  const positionKey = !readOnly && me?.ID && exerciseId ? editorPositionStorageKey(me.ID, exerciseId) : null
  const workingKey = !readOnly && me?.ID && exerciseId ? existingDraftStorageKey(me.ID, exerciseId) : null

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const changeSequence = useRef(0)
  const acknowledgedSequence = useRef(0)
  const suppressWatch = useRef(false)
  const lastContentSignature = useRef("")
  const leaveOpenRef = useRef(false)
  // The loaded/saved version's own id (the URL param is empty for the draft) —
  // needed to address the per-variant test-deploy endpoint.
  const [loadedVersionId, setLoadedVersionId] = useState("")
  // Which variant's test-deploy dialog is open (null = closed).
  const [deployVariantIndex, setDeployVariantIndex] = useState<number | null>(null)
  const [laboratoriesAvailable, setLaboratoriesAvailable] = useState(false)
  const [position, setPosition] = useState<EditorPosition>(DEFAULT_EDITOR_POSITION)
  const positionRef = useRef(position)
  const { formRef, focusField } = useEditorValidationFocus()

  const form = useForm<DraftFormValues>({
    resolver: zodResolver(draftSchema),
    defaultValues: toDraftFormValues(null),
    mode: "onBlur",
  })
  const { isDirty, isSubmitting } = form.formState
  const leave = useExerciseLeaveGuard(!disabled && isDirty)

  useEffect(() => {
    leaveOpenRef.current = Boolean(leave.destination)
    if (leave.destination) {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current)
      saveTimer.current = null
    } else if (!loading && !disabled && changeSequence.current !== acknowledgedSequence.current && saveTimer.current === null) {
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        void queueSaveRef.current().catch(() => undefined)
      }, 5000)
    }
  }, [leave.destination, loading, disabled])

  const persistWorkingCopy = useCallback(() => {
    if (!workingKey || changeSequence.current === acknowledgedSequence.current) return
    try {
      window.localStorage.setItem(workingKey, JSON.stringify({ version: 1, draft: form.getValues(), updatedAt: Date.now() }))
    } catch { /* The save error remains visible; editing can continue. */ }
  }, [workingKey, form])

  const clearWorkingCopy = useCallback(() => {
    if (!workingKey) return
    try { window.localStorage.removeItem(workingKey) } catch { /* Storage may be unavailable. */ }
  }, [workingKey])

  const persistPosition = useCallback((next: EditorPosition) => {
    if (!positionKey) return
    try { window.localStorage.setItem(positionKey, JSON.stringify(next)) } catch { /* UI location is best-effort. */ }
  }, [positionKey])

  function updatePosition<K extends keyof EditorPosition>(key: K, value: EditorPosition[K]) {
    const next = { ...positionRef.current, [key]: value }
    positionRef.current = next
    setPosition(next)
    persistPosition(next)
  }

  useEffect(() => {
    if (!positionKey) return
    let restored: EditorPosition | null = null
    try { restored = parseEditorPosition(window.localStorage.getItem(positionKey)) } catch { /* Storage may be unavailable. */ }
    if (restored) {
      positionRef.current = restored
      setPosition(restored)
    }
  }, [positionKey])

  useEffect(() => {
    if (loading || !positionKey) return
    const root = document.querySelector<HTMLElement>("[data-admin-scroll-root]")
    if (!root) return
    const frame = window.requestAnimationFrame(() => { root.scrollTop = positionRef.current.scrollTop })
    let timer: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      positionRef.current = { ...positionRef.current, scrollTop: root.scrollTop }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => persistPosition(positionRef.current), 350)
    }
    const flush = () => persistPosition(positionRef.current)
    root.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("beforeunload", flush)
    return () => {
      root.removeEventListener("scroll", onScroll)
      window.removeEventListener("beforeunload", flush)
      window.cancelAnimationFrame(frame)
      if (timer) clearTimeout(timer)
      flush()
    }
  }, [loading, positionKey, persistPosition])

  // Serialize full-snapshot writes. A slow response can update server-assigned
  // IDs, but must not reset fields changed while that request was in flight.
  function queueSave(force = false): Promise<void> {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
    saveTimer.current = null
    const next = saveQueue.current.catch(() => undefined).then(async () => {
      if (!force && changeSequence.current === acknowledgedSequence.current) return
      const values = form.getValues()
      if (!draftSchema.safeParse(values).success) return
      const sequence = changeSequence.current
      setSaveError(null)
      setAutoSaving(true)
      try {
        const savedVersion = await saveDraft(exerciseId, toSaveDraftInput(values))
        const serverValues = toDraftFormValues(savedVersion)
        suppressWatch.current = true
        if (changeSequence.current === sequence) {
          form.reset(serverValues)
          setSaved(true)
        } else {
          // Preserve edits made during the request; untouched IDs and other
          // server-assigned fields still flow into the next snapshot.
          form.reset(serverValues, { keepDirtyValues: true })
        }
        lastContentSignature.current = JSON.stringify(form.getValues())
        suppressWatch.current = false
        acknowledgedSequence.current = sequence
        if (changeSequence.current === sequence) clearWorkingCopy()
        else persistWorkingCopy()
        setLoadedVersionId(savedVersion.ID)
      } catch (cause) {
        setSaveError(exerciseErrorMessage(cause))
        throw cause
      } finally {
        setAutoSaving(false)
      }
    })
    saveQueue.current = next
    return next
  }
  const queueSaveRef = useRef(queueSave)
  queueSaveRef.current = queueSave

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!exerciseId) {
        setLoadError(true)
        setLoading(false)
        return
      }
      try {
        let version: Version | null = null
        if (versionId) {
          version = await getVersion(exerciseId, versionId)
        } else {
          const exercise = await getExercise(exerciseId)
          if (exercise.DraftVersionID) {
            version = await getVersion(exerciseId, exercise.DraftVersionID)
          }
        }
        if (!cancelled) {
          const serverValues = toDraftFormValues(version)
          form.reset(serverValues)
          if (!readOnly && workingKey) {
            let recovered: ReturnType<typeof parseExistingDraft> = null
            try { recovered = parseExistingDraft(window.localStorage.getItem(workingKey)) } catch { /* Storage may be unavailable. */ }
            if (recovered && JSON.stringify(recovered.draft) !== JSON.stringify(serverValues)) {
              form.reset(recovered.draft, { keepDefaultValues: true })
              changeSequence.current = 1
            } else if (recovered) clearWorkingCopy()
          }
          if (version) setLoadedVersionId(version.ID)
        }
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
    // form is stable across renders (useForm); the effect only depends on the params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, versionId, readOnly, workingKey, clearWorkingCopy])

  useEffect(() => {
    if (disabled) return
    let cancelled = false
    getExerciseCapabilities()
      .then((capabilities) => { if (!cancelled) setLaboratoriesAvailable(capabilities.Laboratories) })
      .catch(() => { if (!cancelled) setLaboratoriesAvailable(false) })
    return () => { cancelled = true }
  }, [disabled])

  useEffect(() => {
    if (loading || disabled) return
    lastContentSignature.current = JSON.stringify(form.getValues())
    const subscription = form.watch(() => {
      if (suppressWatch.current) return
      const signature = JSON.stringify(form.getValues())
      if (signature === lastContentSignature.current) return
      lastContentSignature.current = signature
      changeSequence.current += 1
      persistWorkingCopy()
      setSaved(false)
      if (saveTimer.current !== null) clearTimeout(saveTimer.current)
      if (!leaveOpenRef.current) saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        void queueSaveRef.current().catch(() => undefined)
      }, 5000)
    })
    return () => {
      subscription.unsubscribe()
      if (saveTimer.current !== null) clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
  }, [loading, disabled, form, persistWorkingCopy])

  // A reload keeps the local copy and never invokes a native leave prompt.
  useEffect(() => {
    if (readOnly) return
    window.addEventListener("beforeunload", persistWorkingCopy)
    return () => window.removeEventListener("beforeunload", persistWorkingCopy)
  }, [readOnly, persistWorkingCopy])

  async function saveAndLeave() {
    const values = form.getValues()
    const parsed = draftSchema.safeParse(values)
    if (!parsed.success) {
      setSaveError(t("admin.ex.leaveExisting.invalid"))
      const issue = parsed.error.issues[0]
      if (issue) {
        const next = positionForDraftIssue(positionRef.current, values, issue.path)
        positionRef.current = next
        setPosition(next)
        focusField(issue.path)
      }
      leave.cancelLeave()
      return
    }
    try {
      await queueSave(true)
      if (changeSequence.current === acknowledgedSequence.current) leave.finishLeave()
    } catch { /* The editor keeps the local copy and shows the save error. */ }
  }

  function discardAndLeave() {
    if (autoSaving) return
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
    changeSequence.current = acknowledgedSequence.current
    clearWorkingCopy()
    leave.finishLeave()
  }

  const onSubmit = form.handleSubmit(async () => {
    try { await queueSave(true) } catch { /* queueSave displays the error. */ }
  }, () => {
    const parsed = draftSchema.safeParse(form.getValues())
    if (!parsed.success && parsed.error.issues[0]) {
      const next = positionForDraftIssue(positionRef.current, form.getValues(), parsed.error.issues[0].path)
      positionRef.current = next
      setPosition(next)
      persistPosition(next)
      focusField(parsed.error.issues[0].path)
    }
  })

  if (loading) {
    return <LoadingArea label={t("admin.loading")} />
  }
  if (loadError) {
    return (
      <div className="frost-panel frost-in rounded-lg p-8 text-center">
        <p className="text-muted-foreground">{t("admin.exDraft.loadError")}</p>
        <Link href="/exercises" className="mt-3 inline-block text-sm text-primary hover:underline">
          {t("admin.exDetail.back")}
        </Link>
      </div>
    )
  }

  return (
    <EditorPositionProvider position={position} onChange={updatePosition}>
    <Dialog open={Boolean(leave.destination)} onOpenChange={(open) => { if (!open) leave.cancelLeave() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.ex.leaveExisting.title")}</DialogTitle>
          <DialogDescription>{t("admin.ex.leaveExisting.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={leave.cancelLeave}>{t("admin.ex.leave.stay")}</Button>
          <Button type="button" variant="outline" disabled={autoSaving} onClick={discardAndLeave}>{t("admin.ex.leaveExisting.discard")}</Button>
          <Button type="button" disabled={autoSaving} onClick={() => void saveAndLeave()}>{t("admin.ex.leaveExisting.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Form {...form}>
      {/* Centered, capped width — on a wide monitor a full-bleed editor reads as
          stretched and hard to scan; ~896px keeps fields at a comfortable size. */}
      <form ref={formRef} noValidate onSubmit={onSubmit} className="frost-in mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/exercises/detail?id=${exerciseId}`} className="text-xs text-primary hover:underline">
              ← {t("admin.exDetail.back")}
            </Link>
            <h1 className="text-xl font-semibold text-foreground">
              {readOnly ? t("admin.exDraft.readOnly") : t("admin.exDraft.heading")}
            </h1>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-3">
              {isDirty && <span className="text-xs text-muted-foreground">{t("admin.exDraft.unsaved")}</span>}
              {autoSaving && <span role="status" className="text-xs text-muted-foreground">{t("admin.exDraft.autoSaving")}</span>}
              {saved && !isDirty && <span className="text-xs text-muted-foreground">{t("admin.exDraft.savedNote")}</span>}
              <Button type="submit" disabled={disabled || isSubmitting}>
                {t("admin.exDraft.save")}
              </Button>
            </div>
          )}
        </div>

        {saveError && (
          <Alert variant="destructive"><AlertDescription>{saveError}</AlertDescription></Alert>
        )}

        <DraftSettings form={form} disabled={disabled} />
        <DraftVariants form={form} disabled={disabled} onTestVariant={setDeployVariantIndex}
          canTestVariant={(index) => laboratoriesAvailable && form.getValues(`Variants.${index}.Topology.Devices`).length > 0} />
      </form>

      {deployVariantIndex !== null && (
        <DeployTestDialog
          open
          onClose={() => setDeployVariantIndex(null)}
          exerciseId={exerciseId}
          versionId={loadedVersionId}
          variantId={form.getValues(`Variants.${deployVariantIndex}.ID`) ?? ""}
          tasks={form.getValues(`Variants.${deployVariantIndex}.Tasks`) ?? []}
        />
      )}
    </Form>
    </EditorPositionProvider>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingArea label={t("admin.loading")} />}>
      <DraftEditor />
    </Suspense>
  )
}
