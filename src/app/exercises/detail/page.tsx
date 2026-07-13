"use client"
import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { getExercise, updateExercise, deleteExercise, type Exercise } from "@/api/exercises/catalog"
import { identitySchema, type IdentityFormValues } from "@/lib/exerciseSchemas"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import { TagInput } from "@/components/exercises/TagInput"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
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
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { Name: exercise.Name, Description: exercise.Description, Tags: exercise.Tags },
  })
  const busy = form.formState.isSubmitting

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null); setSaved(false)
    try {
      await updateExercise(exercise.ID, values)
      setSaved(true)
      onSaved()
    } catch (e) {
      setError(exerciseErrorMessage(e))
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
              <FormControl><Input {...field} disabled={busy || readOnly} /></FormControl>
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
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {saved && <p className="text-xs text-muted-foreground">{t("admin.exDetail.identity.saved")}</p>}
          {!readOnly && (
            <Button type="submit" disabled={busy}>{t("admin.exDetail.identity.save")}</Button>
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
  const [error, setError] = useState<string | null>(null)

  if (!can("exercises.delete")) return null

  async function remove() {
    setBusy(true); setError(null)
    try {
      await deleteExercise(exercise.ID)
      router.push("/exercises")
    } catch (e) {
      setError(exerciseErrorMessage(e))
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
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
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
    return <div className="flex justify-center py-12"><Spinner label={t("admin.loading")} /></div>
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

      {/* SECTION:VERSIONS — Task 5 inserts the status block and versions table here */}

      <DeleteCard exercise={exercise} />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner label={t("admin.loading")} /></div>}>
      <Detail />
    </Suspense>
  )
}
