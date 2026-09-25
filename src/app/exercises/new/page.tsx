"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createExercise, getExercise, listExerciseTags, updateExercise, type ExerciseTagSuggestion } from "@/api/exercises/catalog"
import { getVersion, saveDraft } from "@/api/exercises/versions"
import { DraftVariants } from "@/components/exercises/DraftFields"
import { ExerciseFieldLabel } from "@/components/exercises/ExerciseFieldLabel"
import { TagInput } from "@/components/exercises/TagInput"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Form } from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { t } from "@/i18n/t"
import { toast } from "@/components/ui/toast"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import {
  draftSchema, emptyDraft, identitySchema, toDraftFormValues, toSaveDraftInput,
  type DraftFormValues, type IdentityFormValues,
} from "@/lib/exerciseSchemas"
import { useRole } from "@/lib/useRole"
import { DEFAULT_EDITOR_POSITION, localDraftStorageKey, makeLocalDraft, parseLocalDraft, type EditorPosition } from "@/lib/localExerciseDraft"
import { EditorPositionProvider, useEditorValidationFocus } from "@/components/exercises/EditorPosition"
import { positionForDraftIssue } from "@/lib/exerciseErrorNavigation"
import { useExerciseLeaveGuard } from "@/lib/useExerciseLeaveGuard"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Check, CircleAlert, HardDriveDownload, Info, LoaderCircle } from "lucide-react"

export default function NewExercisePage() {
  const router = useRouter()
  const { can, me } = useRole()
  const storageKey = me?.ID ? localDraftStorageKey(me.ID) : null
  const tagDraftRef = useRef<HTMLInputElement>(null)
  const [pendingTag, setPendingTag] = useState("")
  const [tagSuggestions, setTagSuggestions] = useState<ExerciseTagSuggestion[]>([])
  const createdId = useRef<string | null>(null)
  const [hasPartialSave, setHasPartialSave] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState<EditorPosition>(DEFAULT_EDITOR_POSITION)
  const { formRef, focusField } = useEditorValidationFocus()
  const positionRef = useRef(position)
  positionRef.current = position
  const [storageReady, setStorageReady] = useState(false)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const leave = useExerciseLeaveGuard(storageReady && (hasUnsaved || Boolean(createdId.current)) && !busy)
  const [localCopySaved, setLocalCopySaved] = useState(false)
  const [localSaveFailed, setLocalSaveFailed] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [serverSynced, setServerSynced] = useState(false)
  const [restoredOmitted, setRestoredOmitted] = useState({ flags: 0, secrets: 0 })
  const [restoredNotice, setRestoredNotice] = useState(false)
  const unsavedRef = useRef(false)
  const savedRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const serverTimerRef = useRef<number | null>(null)
  const serverQueueRef = useRef<Promise<boolean>>(Promise.resolve(false))
  const changeSequenceRef = useRef(0)
  const acknowledgedSequenceRef = useRef(0)
  const serverSyncedRef = useRef(false)
  const suppressWatchRef = useRef(false)
  const scrollRef = useRef(0)
  const pendingTagRef = useRef(pendingTag)
  pendingTagRef.current = pendingTag
  const restoreScrollRef = useRef<number | null>(null)
  const identityForm = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { Name: "", Description: "", Tags: [] },
  })
  const tags = useWatch({ control: identityForm.control, name: "Tags" })
  const draftForm = useForm<DraftFormValues>({
    resolver: zodResolver(draftSchema),
    defaultValues: emptyDraft(),
    mode: "onBlur",
  })
  const resetIdentity = identityForm.reset
  const resetDraft = draftForm.reset
  const watchIdentity = identityForm.watch
  const watchDraft = draftForm.watch
  const contentSignature = () => JSON.stringify([identityForm.getValues(), draftForm.getValues(), pendingTagRef.current])
  const contentSignatureRef = useRef(contentSignature)
  contentSignatureRef.current = contentSignature
  const lastContentSignatureRef = useRef("")
  if (!lastContentSignatureRef.current) lastContentSignatureRef.current = contentSignature()

  function flushLocalDraft(force = false) {
    if (!storageReady || !storageKey || savedRef.current || (!unsavedRef.current && !createdId.current && !force)) return false
    try {
      const snapshot = makeLocalDraft(identityForm.getValues(), draftForm.getValues(),
        { ...positionRef.current, scrollTop: scrollRef.current }, createdId.current, pendingTagRef.current, serverSyncedRef.current)
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot))
      setLocalCopySaved(true)
      setLocalSaveFailed(false)
      return true
    } catch {
      setLocalCopySaved(false)
      setLocalSaveFailed(true)
      return false
    }
  }
  const flushRef = useRef(flushLocalDraft)
  flushRef.current = flushLocalDraft

  function scheduleLocalSave() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      flushRef.current()
    }, 350)
  }
  const scheduleRef = useRef(scheduleLocalSave)
  scheduleRef.current = scheduleLocalSave

  function markUnsaved() {
    if (suppressWatchRef.current) return
    const signature = contentSignature()
    if (signature === lastContentSignatureRef.current) return
    lastContentSignatureRef.current = signature
    changeSequenceRef.current += 1
    unsavedRef.current = true
    serverSyncedRef.current = false
    setServerSynced(false)
    setHasUnsaved(true)
    setRestoredNotice(false)
    setLocalCopySaved(false)
    scheduleRef.current()
    scheduleServerRef.current()
  }
  const markUnsavedRef = useRef(markUnsaved)
  markUnsavedRef.current = markUnsaved

  function queueServerSave(force = false, identityOverride?: IdentityFormValues): Promise<boolean> {
    if (serverTimerRef.current !== null) window.clearTimeout(serverTimerRef.current)
    serverTimerRef.current = null
    const next = serverQueueRef.current.catch(() => false).then(async () => {
      if (!force && (changeSequenceRef.current === acknowledgedSequenceRef.current || pendingTagRef.current)) return false
      const identity = identitySchema.safeParse(identityOverride ?? identityForm.getValues())
      const draft = draftSchema.safeParse(draftForm.getValues())
      if (!identity.success || !draft.success) return false
      const sequence = changeSequenceRef.current
      setAutoSaving(true)
      try {
        if (createdId.current) {
          await updateExercise(createdId.current, identity.data)
        } else {
          const exercise = await createExercise(identity.data)
          createdId.current = exercise.ID
          flushRef.current(true) // Preserve the new ID even if the draft PUT fails.
        }
        const savedVersion = await saveDraft(createdId.current, toSaveDraftInput(draft.data))
        suppressWatchRef.current = true
        if (changeSequenceRef.current === sequence) {
          draftForm.reset(toDraftFormValues(savedVersion))
          unsavedRef.current = false
          serverSyncedRef.current = true
          setServerSynced(true)
          setHasUnsaved(false)
        } else {
          draftForm.reset(toDraftFormValues(savedVersion), { keepDirtyValues: true })
        }
        suppressWatchRef.current = false
        lastContentSignatureRef.current = contentSignature()
        acknowledgedSequenceRef.current = sequence
        flushRef.current(true)
        setError(null)
        setHasPartialSave(false)
        setRestoredOmitted({ flags: 0, secrets: 0 })
        return true
      } catch (cause) {
        setHasPartialSave(Boolean(createdId.current))
        setError(exerciseErrorMessage(cause))
        flushRef.current(true)
        throw cause
      } finally {
        suppressWatchRef.current = false
        setAutoSaving(false)
      }
    })
    serverQueueRef.current = next
    return next
  }
  const queueServerRef = useRef(queueServerSave)
  queueServerRef.current = queueServerSave

  function scheduleServerSave() {
    if (serverTimerRef.current !== null) window.clearTimeout(serverTimerRef.current)
    serverTimerRef.current = window.setTimeout(() => {
      serverTimerRef.current = null
      void queueServerRef.current().catch(() => undefined)
    }, 5000)
  }
  const scheduleServerRef = useRef(scheduleServerSave)
  scheduleServerRef.current = scheduleServerSave

  useEffect(() => {
    if (!storageKey) return
    let cancelled = false
    async function restore() {
      try {
        const stored = parseLocalDraft(window.localStorage.getItem(storageKey!))
        if (stored) {
          let identity = stored.identity
          let draft = stored.draft
          let recoveredFromServer = false
          if (stored.serverSynced && stored.createdId) {
            try {
              const exercise = await getExercise(stored.createdId)
              if (exercise.DraftVersionID) {
                const version = await getVersion(stored.createdId, exercise.DraftVersionID)
                identity = { Name: exercise.Name, Description: exercise.Description, Tags: exercise.Tags }
                draft = toDraftFormValues(version)
                recoveredFromServer = true
              }
            } catch { /* Fall back to the sanitized local copy. */ }
          }
          if (cancelled) return
          suppressWatchRef.current = true
          resetIdentity(identity)
          resetDraft(draft)
          suppressWatchRef.current = false
          lastContentSignatureRef.current = contentSignatureRef.current()
          setPosition(stored.position)
          positionRef.current = stored.position
          createdId.current = stored.createdId
          scrollRef.current = stored.position.scrollTop
          restoreScrollRef.current = stored.position.scrollTop
          unsavedRef.current = !recoveredFromServer
          serverSyncedRef.current = recoveredFromServer
          setHasUnsaved(!recoveredFromServer)
          setServerSynced(recoveredFromServer)
          setLocalCopySaved(!recoveredFromServer)
          setRestoredOmitted(recoveredFromServer ? { flags: 0, secrets: 0 } : stored.omitted)
          setPendingTag(stored.pendingTag)
          setRestoredNotice(true)
          pendingTagRef.current = stored.pendingTag
          if (stored.pendingTag) {
            unsavedRef.current = true
            serverSyncedRef.current = false
            setHasUnsaved(true)
            setServerSynced(false)
          }
        }
      } catch { /* Browser storage may be unavailable. Normal editing still works. */ }
      if (!cancelled) setStorageReady(true)
    }
    void restore()
    return () => { cancelled = true }
  }, [storageKey, resetIdentity, resetDraft])

  useEffect(() => {
    if (!restoredNotice) return
    const timer = window.setTimeout(() => setRestoredNotice(false), 4000)
    return () => window.clearTimeout(timer)
  }, [restoredNotice])

  useEffect(() => {
    const prefix = pendingTag.trim()
    if (!prefix) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void listExerciseTags(prefix).then((items) => {
        if (!cancelled) setTagSuggestions(items)
      }).catch(() => {
        if (!cancelled) setTagSuggestions([])
      })
    }, 200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [pendingTag])

  useEffect(() => {
    if (!storageReady) return
    // eslint-disable-next-line react-hooks/incompatible-library -- Imperative form subscription; React Compiler must not memoize this effect.
    const identityWatch = watchIdentity(() => markUnsavedRef.current())
    const draftWatch = watchDraft(() => markUnsavedRef.current())
    return () => { identityWatch.unsubscribe(); draftWatch.unsubscribe() }
  }, [storageReady, watchIdentity, watchDraft])

  useEffect(() => {
    if (storageReady && (unsavedRef.current || createdId.current)) scheduleRef.current()
  }, [position, storageReady])

  useEffect(() => {
    if (!storageReady) return
    const root = document.querySelector<HTMLElement>("[data-admin-scroll-root]")
    if (!root) return
    const onScroll = () => {
      scrollRef.current = root.scrollTop
      if (unsavedRef.current || createdId.current) scheduleRef.current()
    }
    root.addEventListener("scroll", onScroll, { passive: true })
    let frame = 0
    if (restoreScrollRef.current !== null) {
      const target = restoreScrollRef.current
      frame = window.requestAnimationFrame(() => { root.scrollTop = target })
      restoreScrollRef.current = null
    }
    return () => { root.removeEventListener("scroll", onScroll); if (frame) window.cancelAnimationFrame(frame) }
  }, [storageReady])

  useEffect(() => {
    const beforeUnload = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
      flushRef.current()
    }
    window.addEventListener("beforeunload", beforeUnload)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      flushRef.current()
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      if (serverTimerRef.current !== null) window.clearTimeout(serverTimerRef.current)
    }
  }, [])

  function updatePosition<K extends keyof EditorPosition>(key: K, value: EditorPosition[K]) {
    setPosition((current) => ({ ...current, [key]: value }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError(null)
    const pendingTag = tagDraftRef.current?.value.trim()
    const currentIdentity = identityForm.getValues()
    const completeIdentity = pendingTag && !currentIdentity.Tags.includes(pendingTag)
      ? { ...currentIdentity, Tags: [...currentIdentity.Tags, pendingTag] }
      : currentIdentity
    const identity = identitySchema.safeParse(completeIdentity)
    if (!identity.success) {
      for (const issue of identity.error.issues) {
        const field = issue.path[0] as keyof IdentityFormValues
        identityForm.setError(field, { message: issue.message })
      }
      updatePosition("tab", "general")
      focusField(identity.error.issues[0]?.path ?? [])
      return
    }
    identityForm.clearErrors()
    const draftValid = await draftForm.trigger()
    if (!draftValid) {
      const parsed = draftSchema.safeParse(draftForm.getValues())
      const issue = parsed.success ? null : parsed.error.issues[0]
      setPosition((current) => issue
        ? positionForDraftIssue(current, draftForm.getValues(), issue.path)
        : { ...current, tab: "variants" })
      if (issue) focusField(issue.path)
      return
    }

    setBusy(true)
    try {
      const persisted = await queueServerSave(true, identity.data)
      if (!persisted || !createdId.current) return
      savedRef.current = true
      unsavedRef.current = false
      setHasUnsaved(false)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
      if (serverTimerRef.current !== null) window.clearTimeout(serverTimerRef.current)
      serverTimerRef.current = null
      if (storageKey) {
        try { window.localStorage.removeItem(storageKey) } catch { /* Server save succeeded. */ }
      }
      leave.allowNavigation()
      toast.success("Завдання створено.")
      router.push(`/exercises/detail?id=${encodeURIComponent(createdId.current)}`)
    } catch (cause) {
      flushRef.current()
      setHasPartialSave(Boolean(createdId.current))
      toast.error(exerciseErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!can("exercises.write")) {
    return <p role="alert" className="text-sm text-destructive">{t("admin.ex.create.forbidden")}</p>
  }

  const tagError = identityForm.formState.errors.Tags
  const tagErrorMessage = Array.isArray(tagError)
    ? tagError.find(Boolean)?.message
    : tagError?.message ?? (tagError as { 0?: { message?: string } } | undefined)?.[0]?.message

  return <EditorPositionProvider position={position} onChange={updatePosition}>
    <Dialog open={Boolean(leave.destination)} onOpenChange={(open) => { if (!open) leave.cancelLeave() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.ex.leaveNew.title")}</DialogTitle>
          <DialogDescription>{t("admin.ex.leaveNew.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={leave.cancelLeave}>{t("admin.ex.leave.stay")}</Button>
          <Button type="button" onClick={() => { if (flushRef.current(true)) leave.finishLeave() }}>
            {t("admin.ex.leaveNew.keep")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Tabs value={position.tab} onValueChange={(value) => updatePosition("tab", value === "variants" ? "variants" : "general")}
      className="flex min-h-full w-full flex-col gap-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Link href="/exercises" className="text-sm text-primary hover:underline">← {t("admin.exDetail.back")}</Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{t("admin.ex.create.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.ex.create.description")}</p>
      </div>
      <TabsList className="w-fit shrink-0">
        <TabsTrigger value="general">{t("admin.ex.create.tab.general")}</TabsTrigger>
        <TabsTrigger value="variants">{t("admin.ex.create.tab.variants")}</TabsTrigger>
      </TabsList>
    </div>
    <Card className="flex flex-1 flex-col">
      <CardContent className="flex flex-1 flex-col pt-5">
        <Form {...draftForm}>
          <form ref={formRef} noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-1 flex-col gap-5">
              <TabsContent value="general" forceMount className="m-0 flex-1 data-[state=inactive]:hidden">
                <div className="grid w-full gap-x-6 gap-y-3 pt-3 lg:grid-cols-2">
                  <div className="min-w-0 space-y-1.5">
                    <ExerciseFieldLabel labelKey="admin.ex.field.name" helpKey="admin.ex.help.name" htmlFor="exercise-name" required />
                    <Input id="exercise-name" autoFocus disabled={busy} aria-invalid={Boolean(identityForm.formState.errors.Name)} {...identityForm.register("Name")} />
                    <p role={identityForm.formState.errors.Name ? "alert" : undefined} className="min-h-4 text-xs text-destructive">{identityForm.formState.errors.Name?.message}</p>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <ExerciseFieldLabel labelKey="admin.ex.field.tags" helpKey="admin.ex.field.tagsHelp" htmlFor="exercise-tags" />
                    <TagInput id="exercise-tags" value={tags} onChange={(nextTags) => identityForm.setValue("Tags", nextTags, { shouldValidate: true })} disabled={busy} inputRef={tagDraftRef}
                      draftValue={pendingTag} suggestions={tagSuggestions}
                      onDraftValueChange={(value) => { setPendingTag(value); pendingTagRef.current = value; markUnsavedRef.current() }} />
                    <p role={tagErrorMessage ? "alert" : undefined} className="min-h-4 text-xs text-destructive">{tagErrorMessage}</p>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <ExerciseFieldLabel labelKey="admin.ex.field.description" helpKey="admin.ex.field.descriptionHelp" htmlFor="exercise-description" />
                    <Textarea id="exercise-description" rows={5} disabled={busy} aria-invalid={Boolean(identityForm.formState.errors.Description)} {...identityForm.register("Description")} />
                    <p role={identityForm.formState.errors.Description ? "alert" : undefined} className="min-h-4 text-xs text-destructive">{identityForm.formState.errors.Description?.message}</p>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <ExerciseFieldLabel labelKey="admin.ex.create.notes" helpKey="admin.exDraft.adminNoteHelp" htmlFor="draft-admin-note" />
                    <Textarea id="draft-admin-note" rows={5} disabled={busy} {...draftForm.register("AdminNote")} />
                    <p className="min-h-4 text-xs text-destructive" />
                  </div>
                  <Controller control={draftForm.control} name="RegenerateFlagsOnPublish" render={({ field }) => <div className="flex min-w-0 items-start gap-2 lg:col-span-2">
                    <Checkbox id="regen-flags-new" ref={field.ref} checked={field.value} onChange={(event) => field.onChange(event.target.checked)} onBlur={field.onBlur} disabled={busy} />
                    <ExerciseFieldLabel labelKey="admin.exDraft.regenFlags" helpKey="admin.exDraft.regenFlags.hint" htmlFor="regen-flags-new" />
                  </div>} />
                </div>
              </TabsContent>
              <TabsContent value="variants" forceMount className="m-0 flex-1 data-[state=inactive]:hidden">
                <DraftVariants form={draftForm} disabled={busy} />
              </TabsContent>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {hasPartialSave && <p role="status" className="text-sm text-muted-foreground">{t("admin.ex.create.partialSave")}</p>}
            {localSaveFailed && <Alert variant="destructive"><AlertDescription>{t("admin.ex.create.localSaveFailed")}</AlertDescription></Alert>}
            <div className="mt-auto flex min-h-9 flex-wrap items-center justify-between gap-2">
              <div className="flex h-9 min-w-9 items-center">
                {(restoredOmitted.flags + restoredOmitted.secrets > 0 || restoredNotice || localSaveFailed || autoSaving || hasUnsaved || serverSynced) && (() => {
                  const status = restoredOmitted.flags + restoredOmitted.secrets > 0 ? t("admin.ex.create.localOmitted")
                    : localSaveFailed ? t("admin.ex.create.localSaveFailed")
                      : restoredNotice ? t("admin.ex.create.restored")
                      : autoSaving ? t("admin.exDraft.autoSaving")
                        : hasUnsaved && localCopySaved ? t("admin.ex.create.localSaved")
                          : hasUnsaved ? t("admin.ex.create.localSaving") : t("admin.exDraft.savedNote")
                  const icon = localSaveFailed ? <CircleAlert className="h-4 w-4 text-destructive" />
                    : restoredOmitted.flags + restoredOmitted.secrets > 0 ? <Info className="h-4 w-4 text-muted-foreground" />
                      : autoSaving || (hasUnsaved && !localCopySaved) ? <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
                      : hasUnsaved || restoredNotice ? <HardDriveDownload className="h-4 w-4 text-muted-foreground" />
                        : <Check className="h-4 w-4 text-muted-foreground" />
                  return <HoverTooltip text={status}><span role="status" aria-label={status} tabIndex={0} className="inline-flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{icon}</span></HoverTooltip>
                })()}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
              {busy ? <Button type="button" variant="outline" disabled>{t("admin.ex.create.cancel")}</Button>
                : <Button asChild variant="outline"><Link href="/exercises">{t("admin.ex.create.cancel")}</Link></Button>}
              <Button type="submit" disabled={busy}>{t("admin.ex.create.submit")}</Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
    </Tabs>
  </EditorPositionProvider>
}
