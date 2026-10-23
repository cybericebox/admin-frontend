"use client"
import { useState } from "react"
import { ApiError } from "@/api/client"
import { createBroadcastTemplate, TEMPLATE_NAME_MAX, TEMPLATE_NAME_TAKEN } from "@/api/notifications/broadcastTemplates"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { templateInput, templateNameError, type BroadcastMessage } from "./broadcastMessage"

// The error of a template write: a taken name belongs to the name field, everything else to the form.
export function templateSaveError(cause: unknown): { name?: string; form?: string } {
  if (cause instanceof ApiError && cause.code === TEMPLATE_NAME_TAKEN) return { name: t("admin.notif.customTpl.validation.nameTaken") }
  return { form: localizedError(cause) }
}

// The template name field with its error beside it.
export function TemplateNameField({ id, value, onChange, onBlur, error }: { id: string; value: string; onChange: (value: string) => void; onBlur?: () => void; error: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">{t("admin.notif.customTpl.field.name")}</label>
      <Input id={id} value={value} maxLength={TEMPLATE_NAME_MAX} autoComplete="off" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

// «Зберегти як шаблон» in the composer: asks for a name and stores the message (not the audience) as a template.
export function SaveTemplateDialog({ open, message, onClose }: { open: boolean; message: BroadcastMessage; onClose: () => void }) {
  const [name, setName] = useState("")
  const [left, setLeft] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverName, setServerName] = useState<{ name: string; error: string } | null>(null)
  const [formError, setFormError] = useState("")
  const nameError = (left ? templateNameError(name) : "") || (serverName && serverName.name === name ? serverName.error : "")

  function reset() { setName(""); setLeft(false); setServerName(null); setFormError("") }
  function close() { if (saving) return; reset(); onClose() }

  async function save() {
    setLeft(true)
    if (templateNameError(name) || saving) return
    setSaving(true)
    setFormError("")
    try {
      await createBroadcastTemplate(templateInput(name, message))
      toast.success(t("admin.notif.customTpl.saved"))
      setSaving(false)
      reset()
      onClose()
    } catch (cause) {
      const errors = templateSaveError(cause)
      if (errors.name) setServerName({ name, error: errors.name })
      setFormError(errors.form ?? "")
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.notif.customTpl.saveAs.title")}</DialogTitle>
          <DialogDescription>{t("admin.notif.customTpl.saveAs.body")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); void save() }}>
          <TemplateNameField id="bc-save-template-name" value={name} onChange={setName} onBlur={() => setLeft(true)} error={nameError} />
        </form>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={close}>{t("confirm.cancel")}</Button>
          <Button type="button" busy={saving} busyLabel={t("busy.saving")} onClick={() => void save()}>{t("admin.notif.customTpl.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
