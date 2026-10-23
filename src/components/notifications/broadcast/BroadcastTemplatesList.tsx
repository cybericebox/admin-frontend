"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Pencil, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { localizedError } from "@/i18n/apiError"
import { deleteBroadcastTemplate, listBroadcastTemplates, type BroadcastTemplate } from "@/api/notifications/broadcastTemplates"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { toast } from "@/components/ui/toast"
import { broadcastChannelLabel, broadcastHeading } from "./broadcastLabels"

export const TEMPLATES_BASE = "/notifications/broadcast-templates"
export const templateEditHref = (id?: string) => `${TEMPLATES_BASE}/edit${id ? `?id=${encodeURIComponent(id)}` : ""}`

// «Шаблони розсилок»: saved platform broadcast messages. They are not bound to any platform action; an admin picks
// one in «Нова розсилка» to fill the form. The whole page needs notifications.broadcast (the route checks it).
export function BroadcastTemplatesList() {
  const [rows, setRows] = useState<BroadcastTemplate[] | null>(null)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [reload, setReload] = useState(0)
  const [removing, setRemoving] = useState<BroadcastTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [removeError, setRemoveError] = useState("")

  useEffect(() => {
    let cancelled = false
    listBroadcastTemplates().then(
      (list) => { if (!cancelled) { setRows(list); setError(null) } },
      (cause) => { if (!cancelled) setError({ cause }) },
    )
    return () => { cancelled = true }
  }, [reload])

  async function remove() {
    if (!removing || deleting) return
    setDeleting(true)
    setRemoveError("")
    try {
      await deleteBroadcastTemplate(removing.ID)
      setRows((list) => list?.filter((row) => row.ID !== removing.ID) ?? list)
      toast.success(t("admin.notif.broadcastTpl.deleted"))
      setRemoving(null)
    } catch (cause) {
      setRemoveError(localizedError(cause))
    } finally { setDeleting(false) }
  }

  return (
    <div className="flex min-h-full min-w-0 flex-col md:h-full md:min-h-0 gap-4">
      <PageHeader title={t("admin.notif.broadcastTpl.title")} sub={t("admin.notif.broadcastTpl.subtitle")}
        actions={<Button asChild><Link href={templateEditHref()}>{t("admin.notif.broadcastTpl.create")}</Link></Button>} />
      <div className="frost-panel frost-in flex min-h-0 flex-col overflow-hidden rounded-lg p-6">
        <div className="relative min-h-0 overflow-auto [--ib-state-h:400px]" aria-busy={rows === null && !error}>
          {error && !rows ? (
            <LoadError message={t("admin.notif.broadcastTpl.loadError")} error={error.cause} className="h-[var(--ib-state-h)]" onRetry={() => { setError(null); setReload((n) => n + 1) }} />
          ) : rows === null ? (
            <LoadingArea className="h-[var(--ib-state-h)]" label={t("admin.loading")} />
          ) : rows.length === 0 ? (
            <EmptyState message={t("admin.notif.broadcastTpl.empty")} className="h-[var(--ib-state-h)]" />
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-border bg-[var(--ib-table-head)] text-left text-[length:var(--ib-fs-13)] font-medium text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcastTpl.col.name")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcast.col.message")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcast.channels")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcastTpl.col.updatedBy")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.broadcastTpl.col.updated")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("admin.notif.broadcastTpl.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.ID} className="border-b border-border/50">
                    <td className="max-w-72 px-3 py-2 font-medium text-foreground">
                      <HoverTooltip text={row.Name} truncated className="max-w-full"><Link href={templateEditHref(row.ID)} className="block truncate hover:underline">{row.Name}</Link></HoverTooltip>
                    </td>
                    <td className="max-w-72 px-3 py-2 text-foreground"><span className="block truncate">{broadcastHeading(row)}</span></td>
                    <td className="px-3 py-2 text-foreground">{(row.Channels ?? []).map(broadcastChannelLabel).join(", ")}</td>
                    <td className="px-3 py-2 text-foreground">{row.UpdatedByName || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(row.UpdatedAt).toLocaleString("uk-UA")}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <HoverTooltip text={t("admin.notif.broadcastTpl.edit")}><Button variant="outline" size="icon" asChild><Link href={templateEditHref(row.ID)} aria-label={t("admin.notif.broadcastTpl.edit")}><Pencil className="h-4 w-4" strokeWidth={2} aria-hidden="true" /></Link></Button></HoverTooltip>
                        <HoverTooltip text={t("admin.notif.broadcastTpl.delete")}><Button variant="outline" size="icon" aria-label={t("admin.notif.broadcastTpl.delete")} onClick={() => { setRemoveError(""); setRemoving(row) }}><Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" /></Button></HoverTooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <ConfirmDialog open={removing !== null} onCancel={() => setRemoving(null)} tone="danger"
        title={t("admin.notif.broadcastTpl.deleteTitle")} description={t("admin.notif.broadcastTpl.deleteBody", { name: removing?.Name ?? "" })}
        confirmLabel={t("admin.notif.broadcastTpl.deleteAction")} busy={deleting} busyLabel={t("busy.deleting")} error={removeError} onConfirm={() => void remove()} />
    </div>
  )
}
