"use client"
import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { getExercise, updateExercise, deleteExercise, type Exercise } from "@/api/exercises/catalog"
import {
  listVersions, publishDraft, discardDraft, createCheckpoint, restoreVersion, type VersionListItem,
} from "@/api/exercises/versions"
import { identitySchema, type IdentityFormValues } from "@/lib/exerciseSchemas"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import { TagInput } from "@/components/exercises/TagInput"
import { VersionsTable } from "@/components/exercises/VersionsTable"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { LoadingArea } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"

function IdentityCard({ exercise, onSaved }: { exercise: Exercise; onSaved: () => void }) {
  const { can } = useRole()
  const readOnly = !can("exercises.write")

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { Name: exercise.Name, Description: exercise.Description, Tags: exercise.Tags },
  })
  const busy = form.formState.isSubmitting

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateExercise(exercise.ID, values)
      form.reset(values)
      toast.success(t("admin.exDetail.identity.saved"))
      onSaved()
    } catch (e) {
      toast.error(exerciseErrorMessage(e))
    }
  })

  return (
    <section className="frost-panel rounded-lg p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.exDetail.identity.title")}
      </h2>
      <Form {...form}>
        <form onSubmit={onSubmit} className="max-w-xl space-y-3">
          <FormField control={form.control} name="Name" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.ex.field.name")}</FormLabel>
              <FormControl><Input {...field} disabled={busy || readOnly} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="Description" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.ex.field.description")}</FormLabel>
              <FormControl><Textarea {...field} disabled={busy || readOnly} rows={4} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="Tags" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.ex.field.tags")}</FormLabel>
              <FormControl>
                <TagInput value={field.value} onChange={field.onChange} disabled={busy || readOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          {!readOnly && (
            <Button type="submit" disabled={busy || !form.formState.isDirty}>{t("admin.exDetail.identity.save")}</Button>
          )}
        </form>
      </Form>
    </section>
  )
}

function DeleteCard({ exercise }: { exercise: Exercise }) {
  const router = useRouter()
  const { can } = useRole()
  const [busy, setBusy] = useState(false)

  if (!can("exercises.delete")) return null

  async function remove() {
    setBusy(true)
    try {
      await deleteExercise(exercise.ID)
      toast.success("Завдання видалено.")
      router.push("/exercises")
    } catch (e) {
      toast.error(exerciseErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <section className="frost-panel rounded-lg p-5">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive" disabled={busy}>{t("admin.exDetail.delete.button")}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.exDetail.delete.title")}</DialogTitle>
            <DialogDescription>{t("admin.exDetail.delete.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("admin.exDetail.cancel")}</Button>
            </DialogClose>
            <Button variant="destructive" disabled={busy} onClick={remove}>
              {t("admin.exDetail.delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

type LifecycleAction =
  | { kind: "publish" }
  | { kind: "discard" }
  | { kind: "rollback"; versionId: string }

function VersionsCard({ exercise, onChanged }: { exercise: Exercise; onChanged: () => void }) {
  const { can } = useRole()
  const [versions, setVersions] = useState<VersionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<LifecycleAction | null>(null)

  // loadVersions never sets state synchronously in its own body (only inside the
  // promise callbacks) so the mount effect below stays clear of
  // react-hooks/set-state-in-effect; a refetch that also wants the loading
  // spinner (confirmPending) sets `loading` itself before calling this.
  const loadVersions = useCallback(() => {
    return listVersions(exercise.ID)
      .then(setVersions)
      .catch(() => setError(t("admin.ex.loadError")))
      .finally(() => setLoading(false))
  }, [exercise.ID])

  useEffect(() => { loadVersions() }, [loadVersions])

  async function confirmPending() {
    if (!pending) return
    setBusy(true); setError(null)
    try {
      if (pending.kind === "publish") await publishDraft(exercise.ID)
      if (pending.kind === "discard") await discardDraft(exercise.ID)
      if (pending.kind === "rollback") await restoreVersion(exercise.ID, pending.versionId)
      toast.success(pending.kind === "publish" ? "Чернетку опубліковано." : pending.kind === "discard" ? "Чернетку відхилено." : "Версію відновлено.")
      setPending(null)
      setLoading(true)
      await loadVersions()
      onChanged()
    } catch (e) {
      toast.error(exerciseErrorMessage(e))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const hasDraft = exercise.DraftVersionID !== null
  const hasPublished = exercise.PublishedVersionID !== null

  async function checkpoint() {
    setBusy(true); setError(null)
    try {
      await createCheckpoint(exercise.ID)
      toast.success("Контрольну версію створено.")
      setLoading(true)
      await loadVersions()
    } catch (cause) {
      toast.error(exerciseErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="frost-panel rounded-lg p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.exDetail.status.title")}
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm">
          {hasDraft ? t("admin.exDetail.status.hasDraft") : t("admin.exDetail.status.noDraft")}
          {" · "}
          {hasPublished ? t("admin.exDetail.status.hasPublished") : t("admin.exDetail.status.noPublished")}
        </span>
        {can("exercises.write") && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/exercises/draft?id=${exercise.ID}`}>{t("admin.exDetail.editDraft")}</Link>
          </Button>
        )}
        {hasDraft && can("exercises.write") && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void checkpoint()}>
            {t("admin.exVersions.checkpoint")}
          </Button>
        )}
        {hasDraft && can("exercises.publish") && (
          <>
            <Button size="sm" disabled={busy} onClick={() => setPending({ kind: "publish" })}>
              {t("admin.exDetail.publish")}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setPending({ kind: "discard" })}>
              {t("admin.exDetail.discard")}
            </Button>
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>
            <span className="font-medium">{t("admin.exDetail.publishError")}</span>: {error}
          </AlertDescription>
        </Alert>
      )}

      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.exVersions.title")}
      </h3>
      {loading ? (
        <LoadingArea compact label={t("admin.loading")} />
      ) : (
        <VersionsTable
          exerciseId={exercise.ID}
          versions={versions}
          busy={busy}
          onPublish={() => setPending({ kind: "publish" })}
          onDiscard={() => setPending({ kind: "discard" })}
          onRollback={(versionId) => setPending({ kind: "rollback", versionId })}
        />
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === "publish" && t("admin.exDetail.publish.title")}
              {pending?.kind === "discard" && t("admin.exDetail.discard.title")}
              {pending?.kind === "rollback" && t("admin.exVersions.rollback.title")}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === "publish" && t("admin.exDetail.publish.body")}
              {pending?.kind === "discard" && t("admin.exDetail.discard.body")}
              {pending?.kind === "rollback" && t("admin.exVersions.rollback.body")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>
              {t("admin.exDetail.cancel")}
            </Button>
            <Button disabled={busy} onClick={confirmPending}>
              {pending?.kind === "publish" && t("admin.exDetail.publish")}
              {pending?.kind === "discard" && t("admin.exDetail.discard")}
              {pending?.kind === "rollback" && t("admin.exVersions.rollback")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Detail() {
  const params = useSearchParams()
  const id = params.get("id") ?? ""

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // All state updates happen inside the promise callbacks (never synchronously in
  // the function body) so the effect below stays clear of react-hooks/set-state-in-effect.
  const load = useCallback(() => {
    const request = id ? getExercise(id) : Promise.reject(new Error("missing exercise id"))
    request
      .then((e) => { setExercise(e); setNotFound(false) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <LoadingArea label={t("admin.loading")} />
  }
  if (notFound || !exercise) {
    return (
      <div className="frost-panel frost-in rounded-lg p-8 text-center">
        <p className="text-muted-foreground">{t("admin.exDetail.notFound")}</p>
        <Link href="/exercises" className="mt-3 inline-block text-sm text-primary hover:underline">
          {t("admin.exDetail.back")}
        </Link>
      </div>
    )
  }

  return (
    <div className="frost-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/exercises" className="text-xs text-primary hover:underline">
            ← {t("admin.exDetail.back")}
          </Link>
          <h1 className="text-xl font-semibold text-foreground">{exercise.Name}</h1>
        </div>
      </div>

      {/* keyed remount: after reload the form gets fresh defaultValues */}
      <IdentityCard key={exercise.UpdatedAt} exercise={exercise} onSaved={load} />

      <VersionsCard exercise={exercise} onChanged={load} />

      <DeleteCard exercise={exercise} />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingArea label={t("admin.loading")} />}>
      <Detail />
    </Suspense>
  )
}
