"use client"
import { useEffect, useState } from "react"
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/api/client"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog"
import { StatusPill } from "./StatusPill"
import { useNotificationTypes } from "./templateTypes"

type InAppTpl = { ID: string; NotificationType: string; Status: string; Title: string; Body: string; Link: string; CreatedAt: string; UpdatedAt: string }
type InAppList = { Templates: InAppTpl[]; MissingActiveFor: string[] }

export function TemplatesTab() {
  const types = useNotificationTypes()
  return (
    <div className="space-y-8 pt-4">
      <InAppSection types={types.map((x) => x.Type)} />
    </div>
  )
}

function InAppSection({ types }: { types: string[] }) {
  const [data, setData] = useState<InAppList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<InAppTpl | "new" | null>(null)

  function reload() {
    setLoading(true); setError(false)
    apiGet<InAppList>("/api/notifications/templates/inapp")
      .then(setData).catch(() => setError(true)).finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.notif.tpl.inapp")}</h2>
        <Button onClick={() => setEditing("new")}>{t("admin.notif.tpl.new")}</Button>
      </div>

      {error ? <p className="text-sm text-destructive">{t("admin.notif.loadError")}</p>
        : loading ? <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
        : (data?.Templates.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">{t("admin.notif.tpl.empty")}</p>
        : (
          <div className="space-y-2">
            {data!.Templates.map((tpl) => (
              <div key={tpl.ID} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{tpl.NotificationType}</span>
                    <StatusPill status={tpl.Status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tpl.Title}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => apiPatch(`/api/notifications/templates/inapp/${tpl.ID}/status`, { Status: tpl.Status === "active" ? "draft" : "active" }).then(reload)}>
                    {tpl.Status === "active" ? t("admin.notif.tpl.deactivate") : t("admin.notif.tpl.activate")}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(tpl)}>{t("admin.notif.tpl.edit")}</Button>
                  <DeleteButton onConfirm={() => apiDelete(`/api/notifications/templates/inapp/${tpl.ID}`).then(reload)} />
                </div>
              </div>
            ))}
          </div>
        )}

      {data && data.MissingActiveFor.length > 0 && (
        <p className="text-xs text-destructive">{t("admin.notif.tpl.missingActive")}: {data.MissingActiveFor.join(", ")}</p>
      )}

      {editing && (
        <InAppEditor
          types={types}
          tpl={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload() }}
        />
      )}
    </section>
  )
}

function InAppEditor({ types, tpl, onClose, onSaved }: { types: string[]; tpl: InAppTpl | null; onClose: () => void; onSaved: () => void }) {
  const [notificationType, setNotificationType] = useState(tpl?.NotificationType ?? types[0] ?? "")
  const [title, setTitle] = useState(tpl?.Title ?? "")
  const [body, setBody] = useState(tpl?.Body ?? "")
  const [link, setLink] = useState(tpl?.Link ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function save() {
    setBusy(true); setError(false)
    try {
      if (tpl) await apiPut(`/api/notifications/templates/inapp/${tpl.ID}`, { Title: title, Body: body, Link: link })
      else await apiPost("/api/notifications/templates/inapp", { NotificationType: notificationType, Title: title, Body: body, Link: link })
      onSaved()
    } catch { setError(true); setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tpl ? t("admin.notif.tpl.edit") : t("admin.notif.tpl.new")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!tpl && (
            <label className="block text-sm">
              <span className="text-muted-foreground">{t("admin.notif.tpl.type")}</span>
              <select value={notificationType} onChange={(e) => setNotificationType(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {types.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
              </select>
            </label>
          )}
          <Field label={t("admin.notif.tpl.title")} value={title} onChange={setTitle} />
          <label className="block text-sm">
            <span className="text-muted-foreground">{t("admin.notif.tpl.body")}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <Field label={t("admin.notif.tpl.link")} value={link} onChange={setLink} />
          {error && <p className="text-sm text-destructive">{t("admin.notif.tpl.saveError")}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("admin.notif.tpl.cancel")}</Button></DialogClose>
          <Button disabled={busy} onClick={save}>{t("admin.notif.tpl.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Field is a shared labelled text input.
export function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </label>
  )
}

// DeleteButton is a confirm-dialog delete trigger reused by both sections.
export function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="destructive">{t("admin.notif.tpl.delete")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("admin.notif.tpl.deleteConfirm")}</DialogTitle></DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("admin.notif.tpl.cancel")}</Button></DialogClose>
          <DialogClose asChild><Button variant="destructive" onClick={onConfirm}>{t("admin.notif.tpl.delete")}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
