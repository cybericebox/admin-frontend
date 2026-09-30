"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { t } from "@/i18n/t"
import { localizedError } from "@/i18n/apiError"
import { BANNER_LABEL_MAX, BANNER_TEXT_MAX, createBanner, deleteBanner, listBanners, updateBanner, type Banner, type BannerInput, type BannerLevel } from "@/api/notifications/banners"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { SelectMenu } from "@/components/ui/select-menu"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { useRole } from "@/lib/useRole"
import { cn } from "@/utils/cn"
import { SiteBanner } from "@/components/shell/SiteBanner"

const LEVELS: BannerLevel[] = ["info", "warning", "critical"]
const LEVEL_CHIP: Record<BannerLevel, string> = {
  info: "bg-[var(--ib-soft)] text-[var(--ib-ink)]",
  warning: "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]",
  critical: "bg-[var(--ib-danger-bg)] text-[var(--ib-danger)]",
}

type Form = { text: string; linkURL: string; linkLabel: string; level: BannerLevel; from: string; to: string; dismissible: boolean; audience: "everyone" | "signed_in"; active: boolean }
const EMPTY_FORM: Form = { text: "", linkURL: "", linkLabel: "", level: "info", from: "", to: "", dismissible: true, audience: "everyone", active: true }

const pad = (value: number) => String(value).padStart(2, "0")
// The picker works with wall-clock "YYYY-MM-DDTHH:mm"; the API with ISO instants.
function toLocal(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function toISO(local: string): string | null {
  if (!local) return null
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toForm(banner: Banner): Form {
  return { text: banner.Text, linkURL: banner.LinkURL ?? "", linkLabel: banner.LinkLabel ?? "", level: banner.Level, from: toLocal(banner.ActiveFrom), to: toLocal(banner.ActiveTo), dismissible: banner.Dismissible, audience: banner.Audience === "signed_in" ? "signed_in" : "everyone", active: banner.IsActive }
}

function toInput(form: Form): BannerInput {
  return { Text: form.text.trim(), LinkURL: form.linkURL.trim(), LinkLabel: form.linkLabel.trim(), Level: form.level, ActiveFrom: toISO(form.from), ActiveTo: toISO(form.to), Dismissible: form.dismissible, Audience: form.audience, IsActive: form.active }
}

function linkValid(url: string): boolean {
  const value = url.trim()
  return value === "" || (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value)
}

function windowLabel(banner: Banner): string {
  const fmt = (iso: string) => new Date(iso).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" })
  if (!banner.ActiveFrom && !banner.ActiveTo) return t("admin.notif.banners.windowAlways")
  return `${banner.ActiveFrom ? fmt(banner.ActiveFrom) : "…"} — ${banner.ActiveTo ? fmt(banner.ActiveTo) : "…"}`
}

function BannerDialog({ banner, onClose, onSaved }: { banner: Banner | "new"; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(banner === "new" ? EMPTY_FORM : toForm(banner))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }))

  const rangeInvalid = form.from !== "" && form.to !== "" && new Date(form.to) <= new Date(form.from)
  const valid = form.text.trim() !== "" && form.text.length <= BANNER_TEXT_MAX && form.linkLabel.length <= BANNER_LABEL_MAX && linkValid(form.linkURL) && !rangeInvalid

  async function save() {
    setBusy(true)
    setError("")
    try {
      if (banner === "new") await createBanner(toInput(form))
      else await updateBanner(banner.ID, toInput(form))
      onSaved()
    } catch (cause) {
      setError(localizedError(cause))
      setBusy(false)
    }
  }

  const label = "mb-1 block text-sm font-medium text-foreground"
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
        <DialogHeader><DialogTitle>{t(banner === "new" ? "admin.notif.banners.create" : "admin.notif.banners.edit")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="banner-text" className={label}>{t("admin.notif.banners.text")}</label>
            <Textarea id="banner-text" rows={3} value={form.text} maxLength={BANNER_TEXT_MAX} onChange={(event) => set("text", event.target.value)} />
            <p className="mt-1 text-right text-xs text-muted-foreground">{form.text.length} / {BANNER_TEXT_MAX}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="banner-link" className={label}>{t("admin.notif.banners.linkUrl")}</label>
              <Input id="banner-link" value={form.linkURL} onChange={(event) => set("linkURL", event.target.value)} placeholder="https://… / /path" aria-invalid={!linkValid(form.linkURL)} />
              {!linkValid(form.linkURL) && <p className="mt-1 text-xs text-destructive">{t("admin.notif.banners.linkInvalid")}</p>}
            </div>
            <div>
              <label htmlFor="banner-label" className={label}>{t("admin.notif.banners.linkLabel")}</label>
              <Input id="banner-label" value={form.linkLabel} maxLength={BANNER_LABEL_MAX} onChange={(event) => set("linkLabel", event.target.value)} />
            </div>
            <div>
              <span className={label}>{t("admin.notif.banners.level")}</span>
              <SelectMenu value={form.level} onChange={(value) => set("level", value as BannerLevel)} ariaLabel={t("admin.notif.banners.level")} options={LEVELS.map((level) => ({ value: level, label: t(`admin.notif.banners.level.${level}`) }))} className="w-full" />
            </div>
            <div>
              <span className={label}>{t("admin.notif.banners.audience")}</span>
              <SelectMenu value={form.audience} onChange={(value) => set("audience", value as Form["audience"])} ariaLabel={t("admin.notif.banners.audience")} options={[{ value: "everyone", label: t("admin.notif.banners.audience.everyone") }, { value: "signed_in", label: t("admin.notif.banners.audience.signed_in") }]} className="w-full" />
            </div>
            <div>
              <span className={label}>{t("admin.notif.banners.activeFrom")}</span>
              <DateTimePicker value={form.from} onChange={(value) => set("from", value)} allowClear aria-label={t("admin.notif.banners.activeFrom")} />
            </div>
            <div>
              <span className={label}>{t("admin.notif.banners.activeTo")}</span>
              <DateTimePicker value={form.to} onChange={(value) => set("to", value)} allowClear aria-label={t("admin.notif.banners.activeTo")} />
              {rangeInvalid && <p className="mt-1 text-xs text-destructive">{t("admin.notif.banners.rangeInvalid")}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <label className="flex items-center gap-2 text-sm text-foreground"><Switch checked={form.dismissible} onCheckedChange={(value) => set("dismissible", value)} aria-label={t("admin.notif.banners.dismissible")} />{t("admin.notif.banners.dismissible")}</label>
            <label className="flex items-center gap-2 text-sm text-foreground"><Switch checked={form.active} onCheckedChange={(value) => set("active", value)} aria-label={t("admin.notif.banners.isActive")} />{t("admin.notif.banners.isActive")}</label>
          </div>
          <div>
            <span className={label}>{t("admin.notif.banners.preview")}</span>
            <div className="overflow-hidden rounded-md border border-border" data-testid="banner-preview">
              <SiteBanner className="border-b-0" banner={{ Text: form.text || t("admin.notif.banners.previewText"), LinkURL: form.linkURL, LinkLabel: form.linkLabel, Level: form.level, Dismissible: form.dismissible }} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>{t("confirm.cancel")}</Button>
          <Button busy={busy} disabled={!valid} onClick={() => void save()}>{t("admin.notif.banners.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BannersAdmin() {
  const canWrite = useRole().can("notifications.banners.write")
  const [banners, setBanners] = useState<Banner[] | null>(null)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [editing, setEditing] = useState<Banner | "new" | null>(null)
  const [removing, setRemoving] = useState<Banner | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [removeError, setRemoveError] = useState("")
  const [actionError, setActionError] = useState("")
  // Activate/deactivate saves run one after another; the row reacts at once and no button waits for the server.
  const toggleQueue = useRef<Promise<void>>(Promise.resolve())
  const latest = useRef<Banner[] | null>(null)

  const load = useCallback(() => {
    listBanners().then((rows) => { latest.current = rows; setBanners(rows); setError(null) }).catch((cause) => setError({ cause }))
  }, [])
  useEffect(() => { queueMicrotask(load) }, [load])

  function toggle(banner: Banner) {
    setActionError("")
    const wanted = !banner.IsActive
    const apply = (rows: Banner[] | null) => rows?.map((row) => (row.ID === banner.ID ? { ...row, IsActive: wanted } : row)) ?? rows
    latest.current = apply(latest.current)
    setBanners((rows) => apply(rows))
    toggleQueue.current = toggleQueue.current.then(async () => {
      const current = latest.current?.find((row) => row.ID === banner.ID)
      if (!current || current.IsActive !== wanted) return // a newer click supersedes this one
      try {
        await updateBanner(banner.ID, { ...toInput(toForm(current)), IsActive: wanted })
      } catch (cause) {
        setActionError(localizedError(cause))
        load() // silent refetch: the table keeps its rows while it reconciles
      }
    })
  }

  async function remove() {
    if (!removing) return
    setRemoveBusy(true)
    setRemoveError("")
    try {
      await deleteBanner(removing.ID)
      setRemoving(null)
      load()
    } catch (cause) {
      setRemoveError(localizedError(cause))
    } finally {
      setRemoveBusy(false)
    }
  }

  return (
    <div className="frost-panel frost-in flex h-full min-h-0 flex-col overflow-hidden rounded-lg p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">{t("admin.notif.banners.title")}</h1>
        {canWrite && <Button onClick={() => setEditing("new")}>{t("admin.notif.banners.create")}</Button>}
      </div>
      {actionError && <p role="alert" className="mb-2 text-sm text-destructive">{actionError}</p>}
      <div className="relative min-h-0 flex-1 overflow-auto" aria-busy={banners === null && !error}>
        {error && !banners ? (
          <LoadError message={t("admin.notif.banners.loadError")} error={error.cause} className="h-full" onRetry={() => { setError(null); load() }} />
        ) : banners === null ? (
          <LoadingArea className="h-full" label={t("admin.loading")} />
        ) : banners.length === 0 ? (
          <EmptyState message={t("admin.notif.banners.empty")} className="h-full" />
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border bg-background text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("admin.notif.banners.text")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.banners.level")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.banners.window")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.banners.audience")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.banners.state")}</th>
                {canWrite && <th className="px-3 py-2 text-right font-medium">{t("admin.notif.banners.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner.ID} className="border-b border-border/50">
                  <td className="max-w-80 px-3 py-2 text-foreground">
                    <HoverTooltip text={banner.Text} truncated className="max-w-full"><span className="block truncate">{banner.Text}</span></HoverTooltip>
                  </td>
                  <td className="px-3 py-2"><span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", LEVEL_CHIP[banner.Level])}>{t(`admin.notif.banners.level.${banner.Level}`)}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{windowLabel(banner)}</td>
                  <td className="px-3 py-2 text-foreground">{t(`admin.notif.banners.audience.${banner.Audience}`)}</td>
                  <td className="px-3 py-2 text-foreground">{banner.IsActive ? t("admin.notif.banners.stateActive") : t("admin.notif.banners.stateInactive")}</td>
                  {canWrite && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(banner)}>{t("admin.notif.banners.edit")}</Button>
                        <Button variant="outline" size="sm" onClick={() => void toggle(banner)}>{t(banner.IsActive ? "admin.notif.banners.deactivate" : "admin.notif.banners.activate")}</Button>
                        <Button variant="outline" size="sm" onClick={() => { setRemoveError(""); setRemoving(banner) }}>{t("admin.notif.banners.delete")}</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <BannerDialog banner={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      <ConfirmDialog
        open={removing !== null}
        onCancel={() => setRemoving(null)}
        tone="danger"
        title={t("admin.notif.banners.deleteTitle")}
        description={t("admin.notif.banners.deleteBody")}
        confirmLabel={t("admin.notif.banners.delete")}
        busy={removeBusy}
        error={removeError}
        onConfirm={() => void remove()}
      >
        {removing && <p className="truncate text-sm font-medium text-foreground">{removing.Text}</p>}
      </ConfirmDialog>
    </div>
  )
}
