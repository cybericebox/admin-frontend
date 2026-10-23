"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { localizedError } from "@/i18n/apiError"
import { getBroadcastTemplate, updateBroadcastTemplate, createBroadcastTemplate, deleteBroadcastTemplate, type BroadcastTemplate } from "@/api/notifications/broadcastTemplates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PageHeader } from "@/components/ui/page-header"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { BroadcastMessageFields, BroadcastMessagePreview } from "@/components/notifications/broadcast/BroadcastMessageFields"
import { TemplateNameField, templateSaveError } from "@/components/notifications/broadcast/SaveTemplateDialog"
import { emptyMessage, messageComplete, templateInput, templateMessage, templateNameError, type BroadcastMessage } from "@/components/notifications/broadcast/broadcastMessage"
import { customTemplateHref, type TemplateChannel } from "./customTemplates"

// The templates page a custom template is opened from.
const pages: Record<TemplateChannel, { href: string; title: string }> = {
  email: { href: "/notifications/templates/email", title: "admin.notif.list.title" },
  in_app: { href: "/notifications/templates/in-app", title: "admin.notif.inapp.list.title" },
}

// A template just created here: its editor address opens with it at once, without a loader.
const justSaved = new Map<string, BroadcastTemplate>()

// One custom template (a saved broadcast message, not bound to any platform action): a name and the very fields of
// the broadcast composer, with the channels of a broadcast and no action or trigger settings. An empty id is a new
// template; `channel` is the templates page it belongs to (a new template starts on it).
export function CustomTemplateEditor({ id, channel }: { id: string; channel: TemplateChannel }) {
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

  if (id && error?.id === id) return <LoadError message={t("admin.notif.customTpl.loadOneError")} error={error.cause} className="frost-panel frost-in h-full rounded-lg" onRetry={() => { setError(null); setReload((n) => n + 1) }} />
  if (id && loaded?.id !== id) return <LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />
  return <TemplateForm key={id || "new"} channel={channel} initial={id ? loaded!.template : null} />
}

function TemplateForm({ channel, initial }: { channel: TemplateChannel; initial: BroadcastTemplate | null }) {
  const router = useRouter()
  const page = pages[channel]
  const [saved, setSaved] = useState(initial)
  const fresh = (): BroadcastMessage => ({ ...emptyMessage(), email: channel === "email", inApp: channel === "in_app" })
  const [name, setName] = useState(initial?.Name ?? "")
  const [message, setMessage] = useState<BroadcastMessage>(() => initial ? templateMessage(initial) : fresh())
  const set = (patch: Partial<BroadcastMessage>) => setMessage((current) => ({ ...current, ...patch }))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [serverName, setServerName] = useState<{ name: string; error: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const touch = (field: string) => setTouched((current) => current.has(field) ? current : new Set(current).add(field))
  const clearField = (field: string) => setFieldErrors((current) => ({ ...current, [field]: "" }))
  const nameError = (touched.has("name") ? templateNameError(name) : "") || (serverName && serverName.name === name ? serverName.error : "")
  const reference = saved ? templateInput(saved.Name, templateMessage(saved)) : templateInput("", fresh())
  const dirty = JSON.stringify(templateInput(name, message)) !== JSON.stringify(reference)
  const title = saved ? saved.Name : t("admin.notif.customTpl.newTitle")

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
      toast.success(t("admin.notif.customTpl.saved"))
      setSaved(result)
      setName(result.Name)
      if (!saved) { justSaved.set(result.ID, result); router.replace(customTemplateHref(channel, result.ID)) }
    } catch (cause) {
      const errors = templateSaveError(cause)
      if (errors.name) setServerName({ name, error: errors.name })
      setFormError(errors.form ?? "")
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!saved || deleting) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteBroadcastTemplate(saved.ID)
      justSaved.delete(saved.ID)
      toast.success(t("admin.notif.customTpl.deleted"))
      setConfirmDelete(false)
      router.push(page.href)
    } catch (cause) {
      setDeleteError(localizedError(cause))
    } finally { setDeleting(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title}
        crumbs={[{ label: t(page.title), href: page.href }, { label: title }]}
        actions={<>
          {saved && <Button variant="outline" onClick={() => { setDeleteError(""); setConfirmDelete(true) }}><Trash2 className="h-4 w-4" aria-hidden="true" />{t("admin.notif.customTpl.delete")}</Button>}
          <Button busy={saving} busyLabel={t("busy.saving")} disabled={!dirty} onClick={() => void save()}>{t("admin.notif.customTpl.save")}</Button>
        </>} />
      <div className="frost-panel frost-in rounded-lg p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="ok" size="sm">{t("admin.notif.customTpl.kind.custom")}</Badge>
          <p className="text-sm text-muted-foreground">{t("admin.notif.customTpl.editorIntro")}</p>
        </div>
        {formError && <p role="alert" className="mb-4 text-sm text-destructive">{formError}</p>}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,45%)]">
          <div className="min-w-0 space-y-6">
            <div className="max-w-sm">
              <TemplateNameField id="custom-template-name" value={name} onChange={setName} onBlur={() => touch("name")} error={nameError} />
            </div>
            <BroadcastMessageFields value={message} onChange={set} state={{ fieldErrors, clearField, touch, touched: (field) => touched.has(field) }} />
          </div>
          <div className="min-w-0 space-y-6">
            <BroadcastMessagePreview value={message} />
          </div>
        </div>
      </div>
      <ConfirmDialog open={confirmDelete} onCancel={() => setConfirmDelete(false)} tone="danger"
        title={t("admin.notif.customTpl.deleteTitle")} description={t("admin.notif.customTpl.deleteBody", { name: saved?.Name ?? "" })}
        confirmLabel={t("admin.notif.customTpl.deleteAction")} busy={deleting} busyLabel={t("busy.deleting")} error={deleteError} onConfirm={() => void remove()} />
    </div>
  )
}
