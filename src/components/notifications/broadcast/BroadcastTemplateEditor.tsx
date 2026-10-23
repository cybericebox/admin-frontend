"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { t } from "@/i18n/t"
import { getBroadcastTemplate, updateBroadcastTemplate, createBroadcastTemplate, type BroadcastTemplate } from "@/api/notifications/broadcastTemplates"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { BroadcastMessageFields, BroadcastMessagePreview } from "./BroadcastMessageFields"
import { TemplateNameField, templateSaveError } from "./SaveTemplateDialog"
import { TEMPLATES_BASE, templateEditHref } from "./BroadcastTemplatesList"
import { emptyMessage, messageComplete, templateInput, templateMessage, templateNameError, type BroadcastMessage } from "./broadcastMessage"

// A template just created here: its editor address opens with it at once, without a loader.
const justSaved = new Map<string, BroadcastTemplate>()

// One saved platform broadcast template: a name and the very fields of the broadcast composer (no audience).
// An empty id is a new template.
export function BroadcastTemplateEditor({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<{ id: string; template: BroadcastTemplate } | null>(() => {
    const seeded = id ? justSaved.get(id) : undefined
    return seeded ? { id, template: seeded } : null
  })
  const [error, setError] = useState<{ id: string; cause: unknown } | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getBroadcastTemplate(id).then(
      (template) => { if (!cancelled) { setLoaded({ id, template }); setError(null) } },
      (cause) => { if (!cancelled) setError({ id, cause }) },
    )
    return () => { cancelled = true }
  }, [id, reload])

  if (id && error?.id === id) return <LoadError message={t("admin.notif.broadcastTpl.loadOneError")} error={error.cause} className="frost-panel frost-in h-full rounded-lg" onRetry={() => { setError(null); setReload((n) => n + 1) }} />
  if (id && loaded?.id !== id) return <LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />
  return <TemplateForm key={id || "new"} initial={id ? loaded!.template : null} />
}

function TemplateForm({ initial }: { initial: BroadcastTemplate | null }) {
  const router = useRouter()
  const [saved, setSaved] = useState(initial)
  const [name, setName] = useState(initial?.Name ?? "")
  const [message, setMessage] = useState<BroadcastMessage>(() => initial ? templateMessage(initial) : emptyMessage())
  const set = (patch: Partial<BroadcastMessage>) => setMessage((current) => ({ ...current, ...patch }))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [serverName, setServerName] = useState<{ name: string; error: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const touch = (field: string) => setTouched((current) => current.has(field) ? current : new Set(current).add(field))
  const clearField = (field: string) => setFieldErrors((current) => ({ ...current, [field]: "" }))
  const nameError = (touched.has("name") ? templateNameError(name) : "") || (serverName && serverName.name === name ? serverName.error : "")
  const reference = saved ? templateInput(saved.Name, templateMessage(saved)) : templateInput("", emptyMessage())
  const dirty = JSON.stringify(templateInput(name, message)) !== JSON.stringify(reference)
  const title = saved ? saved.Name : t("admin.notif.broadcastTpl.newTitle")

  async function save() {
    setFormError("")
    if (templateNameError(name) || !messageComplete(message)) {
      for (const field of ["name", "channels", "subject", "body", "title", "inAppBody"]) touch(field)
      return
    }
    if (saving) return
    setSaving(true)
    try {
      const input = templateInput(name, message)
      const result = saved ? await updateBroadcastTemplate(saved.ID, input) : await createBroadcastTemplate(input)
      toast.success(t("admin.notif.broadcastTpl.saved"))
      setSaved(result)
      setName(result.Name)
      if (!saved) { justSaved.set(result.ID, result); router.replace(templateEditHref(result.ID)) }
    } catch (cause) {
      const errors = templateSaveError(cause)
      if (errors.name) setServerName({ name, error: errors.name })
      setFormError(errors.form ?? "")
    } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title}
        crumbs={[{ label: t("admin.notif.broadcastTpl.title"), href: TEMPLATES_BASE }, { label: title }]}
        actions={<Button busy={saving} busyLabel={t("busy.saving")} disabled={!dirty} onClick={() => void save()}>{t("admin.notif.broadcastTpl.save")}</Button>} />
      <div className="frost-panel frost-in rounded-lg p-6">
        <p className="mb-4 text-sm text-muted-foreground">{t("admin.notif.broadcastTpl.editorIntro")}</p>
        {formError && <p role="alert" className="mb-4 text-sm text-destructive">{formError}</p>}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,45%)]">
          <div className="min-w-0 space-y-6">
            <div className="max-w-sm">
              <TemplateNameField id="bc-template-name" value={name} onChange={setName} onBlur={() => touch("name")} error={nameError} />
            </div>
            <BroadcastMessageFields value={message} onChange={set} state={{ fieldErrors, clearField, touch, touched: (field) => touched.has(field) }} />
          </div>
          <div className="min-w-0 space-y-6">
            <BroadcastMessagePreview value={message} />
          </div>
        </div>
      </div>
    </div>
  )
}
