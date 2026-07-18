"use client"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { getExercise } from "@/api/exercises/catalog"
import { getVersion, saveDraft, type Version } from "@/api/exercises/versions"
import {
  draftSchema, toDraftFormValues, toSaveDraftInput, type DraftFormValues,
} from "@/lib/exerciseSchemas"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import { VariantTabs } from "@/components/exercises/VariantTabs"
import { DeployTestDialog } from "@/components/exercises/DeployTestDialog"
import { TaskAccordion } from "@/components/exercises/TaskAccordion"
import { TopologySection } from "@/components/exercises/TopologySection"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Form } from "@/components/ui/form"

function DraftEditor() {
  const params = useSearchParams()
  const exerciseId = params.get("id") ?? ""
  const versionId = params.get("versionId") ?? ""
  const readOnly = versionId !== ""
  const { can } = useRole()
  const disabled = readOnly || !can("exercises.write")

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // The loaded/saved version's own id (the URL param is empty for the draft) —
  // needed to address the per-variant test-deploy endpoint.
  const [loadedVersionId, setLoadedVersionId] = useState("")
  // Which variant's test-deploy dialog is open (null = closed).
  const [deployVariantIndex, setDeployVariantIndex] = useState<number | null>(null)

  const form = useForm<DraftFormValues>({
    resolver: zodResolver(draftSchema),
    defaultValues: toDraftFormValues(null),
    mode: "onBlur",
  })
  const { isDirty, isSubmitting } = form.formState

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
          form.reset(toDraftFormValues(version))
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
  }, [exerciseId, versionId])

  // Dirty-guard: warn the browser when navigating away with unsaved changes.
  useEffect(() => {
    if (!isDirty || readOnly) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty, readOnly])

  const onSubmit = form.handleSubmit(async (values) => {
    setSaveError(null)
    setSaved(false)
    try {
      const savedVersion = await saveDraft(exerciseId, toSaveDraftInput(values))
      form.reset(toDraftFormValues(savedVersion)) // resets isDirty, pulls in server-assigned IDs
      setLoadedVersionId(savedVersion.ID)
      setSaved(true)
    } catch (e) {
      setSaveError(exerciseErrorMessage(e))
    }
  })

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner label={t("admin.loading")} /></div>
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
    <Form {...form}>
      {/* Centered, capped width — on a wide monitor a full-bleed editor reads as
          stretched and hard to scan; ~896px keeps fields at a comfortable size. */}
      <form onSubmit={onSubmit} className="frost-in mx-auto max-w-4xl space-y-4">
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

        {/* "Settings" section: AdminNote + RegenerateFlagsOnPublish (per-snapshot). */}
        <details className="frost-panel rounded-lg p-5">
          <summary className="cursor-pointer select-none text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.exDraft.settings.title")}
          </summary>
          <div className="mt-3 max-w-xl space-y-3">
            <Controller
              control={form.control}
              name="RegenerateFlagsOnPublish"
              render={({ field }) => (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="regen-flags"
                    ref={field.ref}
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    onBlur={field.onBlur}
                    disabled={disabled}
                  />
                  <div>
                    <label htmlFor="regen-flags" className="text-sm text-foreground">
                      {t("admin.exDraft.regenFlags")}
                    </label>
                    <p className="text-xs text-muted-foreground">{t("admin.exDraft.regenFlags.hint")}</p>
                  </div>
                </div>
              )}
            />
          </div>
        </details>

        <section className="frost-panel rounded-lg p-5">
          <VariantTabs
            disabled={disabled}
            renderVariant={(variantIndex) => (
              // Within a variant, Tasks and Topology are two focus tabs so the
              // admin sees one at a time (a variant has one topology, many tasks).
              // forceMount keeps both mounted — inactive is hidden, not unmounted,
              // so react-hook-form never loses the hidden section's values.
              <div data-variant-sections data-variant-index={variantIndex}>
                {/* Optional per-variant admin note (replaces the old global one). */}
                <details className="mb-3">
                  <summary className="cursor-pointer select-none text-xs uppercase tracking-wider text-muted-foreground">
                    {t("admin.exDraft.variantNote")}
                  </summary>
                  <Input
                    className="mt-2"
                    {...form.register(`Variants.${variantIndex}.Note`)}
                    disabled={disabled}
                  />
                </details>
                {/* Test-deploy this variant's saved topology; requires a saved,
                    non-dirty variant (the backend loads the persisted version). */}
                {!disabled && (
                  <div className="mb-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!form.getValues(`Variants.${variantIndex}.ID`) || isDirty}
                      title={
                        !form.getValues(`Variants.${variantIndex}.ID`) || isDirty
                          ? t("admin.exDeploy.saveFirst")
                          : undefined
                      }
                      onClick={() => setDeployVariantIndex(variantIndex)}
                    >
                      {t("admin.exDeploy.test")}
                    </Button>
                  </div>
                )}
                <Tabs defaultValue="tasks">
                  <TabsList>
                    <TabsTrigger value="tasks">{t("admin.exDraft.tab.tasks")}</TabsTrigger>
                    <TabsTrigger value="topology">{t("admin.exDraft.tab.topology")}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tasks" forceMount className="data-[state=inactive]:hidden">
                    <TaskAccordion variantIndex={variantIndex} disabled={disabled} />
                  </TabsContent>
                  <TabsContent value="topology" forceMount className="data-[state=inactive]:hidden">
                    <TopologySection variantIndex={variantIndex} disabled={disabled} />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          />
        </section>
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
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner label={t("admin.loading")} /></div>}>
      <DraftEditor />
    </Suspense>
  )
}
