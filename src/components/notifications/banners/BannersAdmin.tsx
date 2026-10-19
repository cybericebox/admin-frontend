"use client"
import { ApiError } from "@/api/client"
import { Pencil, Power, Trash2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { t } from "@/i18n/t"
import { UI_LOCALE } from "@/lib/locale"
import { localizedError } from "@/i18n/apiError"
import { BANNER_LABEL_MAX, BANNER_TEXT_MAX, createBanner, deleteBanner, listBanners, updateBanner, type Banner, type BannerInput, type BannerLevel, type BannerTargetMode, type BannerTargetSite } from "@/api/notifications/banners"
import { Checkbox } from "@/components/ui/checkbox"
import { EventPicker } from "./EventPicker"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { useSavedDraft } from "@/lib/useSavedDraft"
import { PageHeader } from "@/components/ui/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

const TARGET_SITES: BannerTargetSite[] = ["main", "id", "admin", "exercises", "event"]

type Form = { targetMode: BannerTargetMode; targetSites: BannerTargetSite[]; targetEventIDs: string[]; text: string; linkURL: string; linkLabel: string; level: BannerLevel; from: string; to: string; dismissible: boolean; audience: "everyone" | "signed_in"; active: boolean }
const EMPTY_FORM: Form = { targetMode: "all", targetSites: [], targetEventIDs: [], text: "", linkURL: "", linkLabel: "", level: "info", from: "", to: "", dismissible: true, audience: "everyone", active: true }

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
  return { targetMode: banner.TargetMode === "selected" ? "selected" : "all", targetSites: banner.TargetSites ?? [], targetEventIDs: banner.TargetEventIDs ?? [], text: banner.Text, linkURL: banner.LinkURL ?? "", linkLabel: banner.LinkLabel ?? "", level: banner.Level, from: toLocal(banner.ActiveFrom), to: toLocal(banner.ActiveTo), dismissible: banner.Dismissible, audience: banner.Audience === "signed_in" ? "signed_in" : "everyone", active: banner.IsActive }
}

function toInput(form: Form): BannerInput {
  return { TargetMode: form.targetMode, TargetSites: form.targetMode === "selected" ? form.targetSites : [], TargetEventIDs: form.targetMode === "selected" ? form.targetEventIDs : [], Text: form.text.trim(), LinkURL: form.linkURL.trim(), LinkLabel: form.linkLabel.trim(), Level: form.level, ActiveFrom: toISO(form.from), ActiveTo: toISO(form.to), Dismissible: form.dismissible, Audience: form.audience, IsActive: form.active }
}

const BANNER_FIELDS: Record<string, keyof Form> = {
  "Banner text is required": "text",
  "Banner link label is too long": "linkLabel",
  "Banner link must be an https address or a site path": "linkURL",
  "Banner end must be after its start": "to",
  "Select at least one banner target": "targetMode",
}
function bannerErrorField(error: unknown): keyof Form | undefined {
  if (!(error instanceof ApiError) || error.code !== 20224) return undefined
  const body = error.body as { Status?: { Message?: string } } | null
  return BANNER_FIELDS[body?.Status?.Message ?? error.message]
}

function linkValid(url: string): boolean {
  const value = url.trim()
  return value.length <= 500 && (value === "" || (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value))
}

const BANNER_STATE_KEY = {
  active: "admin.notif.banners.stateActive",
  inactive: "admin.notif.banners.stateInactive",
  ended: "admin.notif.banners.stateEnded",
  scheduled: "admin.notif.banners.stateScheduled",
} as const

function windowLabel(banner: Banner): string {
  const fmt = (iso: string) => new Date(iso).toLocaleString(UI_LOCALE, { dateStyle: "short", timeStyle: "short" })
  if (!banner.ActiveFrom && !banner.ActiveTo) return t("admin.notif.banners.windowAlways")
  return `${banner.ActiveFrom ? fmt(banner.ActiveFrom) : "…"} — ${banner.ActiveTo ? fmt(banner.ActiveTo) : "…"}`
}

// The state a reader expects: a switched-on banner whose window is over has ended, one whose window has not begun is
// scheduled; only a banner inside its window (or without one) is shown on the sites now.
export function bannerState(banner: Pick<Banner, "IsActive" | "ActiveFrom" | "ActiveTo">, now = Date.now()): "active" | "inactive" | "ended" | "scheduled" {
  if (!banner.IsActive) return "inactive"
  if (banner.ActiveTo && new Date(banner.ActiveTo).getTime() <= now) return "ended"
  if (banner.ActiveFrom && new Date(banner.ActiveFrom).getTime() > now) return "scheduled"
  return "active"
}

function targetSummary(banner: Pick<Banner, "TargetMode" | "TargetSites" | "TargetEventIDs">): string {
  if (banner.TargetMode !== "selected") return t("admin.notif.banners.targets.all")
  const parts = (banner.TargetSites ?? []).map((site) => t(`admin.notif.banners.targets.site.${site}`))
  if (banner.TargetEventIDs?.length) parts.push(t("admin.notif.banners.targets.eventCount", { count: banner.TargetEventIDs.length }))
  return parts.join(t("admin.notif.banners.targets.separator"))
}

function BannerDialog({ banner, onClose, onSaved }: { banner: Banner | "new"; onClose: () => void; onSaved: (saved: Banner, close: boolean) => void }) {
  const { draft: form, setDraft: setForm, dirty, accept } = useSavedDraft(banner === "new" ? EMPTY_FORM : toForm(banner), toInput)
  const [serverFields, setServerFields] = useState<Partial<Record<keyof Form, string>>>({})
  const [textTouched, setTextTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const set = <K extends keyof Form>(key: K, value: Form[K]) => { setServerFields((current) => ({ ...current, [key]: undefined, ...(key === "from" ? { to: undefined } : {}), ...(key === "targetSites" || key === "targetEventIDs" ? { targetMode: undefined } : {}) })); setForm((current) => ({ ...current, [key]: value })) }

  const textError = serverFields.text || (textTouched && !form.text.trim() ? t("admin.notif.banners.textRequired") : form.text.length > BANNER_TEXT_MAX ? t("admin.form.maxLength", { max: BANNER_TEXT_MAX }) : "")
  const linkError = serverFields.linkURL || (!linkValid(form.linkURL) ? t("admin.notif.banners.linkInvalid") : "")
  const labelError = serverFields.linkLabel || (form.linkLabel.length > BANNER_LABEL_MAX ? t("admin.form.maxLength", { max: BANNER_LABEL_MAX }) : "")
  const rangeInvalid = form.from !== "" && form.to !== "" && new Date(form.to) <= new Date(form.from)
  const targetInvalid = form.targetMode === "selected" && form.targetSites.length === 0 && form.targetEventIDs.length === 0
  const valid = form.text.trim() !== "" && form.text.length <= BANNER_TEXT_MAX && form.linkLabel.length <= BANNER_LABEL_MAX && linkValid(form.linkURL) && !rangeInvalid && !targetInvalid

  async function save() {
    if (busy || !valid || (banner !== "new" && !dirty)) return
    const submitted = toInput(form)
    setBusy(true)
    setError("")
    try {
      const saved = banner === "new" ? await createBanner(submitted) : await updateBanner(banner.ID, submitted)
      onSaved(saved, accept(toForm(saved), submitted))
    } catch (cause) {
      const field = bannerErrorField(cause)
      if (field) {
        const message = field === "text" ? t("admin.notif.banners.textRequired") : field === "linkLabel" ? t("admin.form.maxLength", { max: BANNER_LABEL_MAX }) : field === "linkURL" ? t("admin.notif.banners.linkInvalid") : field === "to" ? t("admin.notif.banners.rangeInvalid") : t("admin.notif.banners.targets.required")
        setServerFields({ [field]: message })
      } else setError(localizedError(cause))
    } finally {
      setBusy(false)
    }
  }

  const label = "mb-1 block text-sm font-medium text-foreground"
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
        <DialogHeader><DialogTitle>{t(banner === "new" ? "admin.notif.banners.create" : "admin.notif.banners.edit")}</DialogTitle><DialogDescription>{t("admin.notif.banners.scopeHint")}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="banner-text" className={label}>{t("admin.notif.banners.text")}</label>
            <Textarea id="banner-text" aria-invalid={Boolean(textError)} aria-describedby={textError ? "banner-text-error" : undefined} onBlur={() => setTextTouched(true)} rows={3} value={form.text} maxLength={BANNER_TEXT_MAX} onChange={(event) => set("text", event.target.value)} />
            {textError && <p id="banner-text-error" role="alert" className="mt-1 text-xs text-destructive">{textError}</p>}
            <p className="mt-1 text-right text-xs text-muted-foreground">{form.text.length} / {BANNER_TEXT_MAX}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="banner-link" className={label}>{t("admin.notif.banners.linkUrl")}</label>
              <Input id="banner-link" value={form.linkURL} onChange={(event) => set("linkURL", event.target.value)} placeholder="https://… / /path" aria-invalid={Boolean(linkError)} aria-describedby={linkError ? "banner-link-error" : undefined} />
              {linkError && <p id="banner-link-error" role="alert" className="mt-1 text-xs text-destructive">{linkError}</p>}
            </div>
            <div>
              <label htmlFor="banner-label" className={label}>{t("admin.notif.banners.linkLabel")}</label>
              <Input aria-invalid={Boolean(labelError)} aria-describedby={labelError ? "banner-label-error" : undefined} id="banner-label" value={form.linkLabel} maxLength={BANNER_LABEL_MAX} onChange={(event) => set("linkLabel", event.target.value)} />
              {labelError && <p id="banner-label-error" role="alert" className="mt-1 text-xs text-destructive">{labelError}</p>}
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
              <DateTimePicker aria-invalid={rangeInvalid || Boolean(serverFields.to)} aria-describedby={rangeInvalid || serverFields.to ? "banner-range-error" : undefined} value={form.to} onChange={(value) => set("to", value)} allowClear aria-label={t("admin.notif.banners.activeTo")} />
              {(rangeInvalid || serverFields.to) && <p id="banner-range-error" role="alert" className="mt-1 text-xs text-destructive">{t("admin.notif.banners.rangeInvalid")}</p>}
            </div>
          </div>
          <fieldset aria-invalid={targetInvalid || Boolean(serverFields.targetMode)} aria-describedby={targetInvalid || serverFields.targetMode ? "banner-target-error" : undefined} className="space-y-3 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">{t("admin.notif.banners.targets.title")}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(["all", "selected"] as const).map((mode) => <label key={mode} className="flex items-center gap-2 text-sm">
                <input type="radio" name="banner-target-mode" value={mode} checked={form.targetMode === mode} onChange={() => set("targetMode", mode)} className="h-4 w-4 accent-primary" />
                {t(`admin.notif.banners.targets.${mode}`)}
              </label>)}
            </div>
            {form.targetMode === "selected" && <>
              <div className="grid gap-2 sm:grid-cols-2">
                {TARGET_SITES.map((site) => <Checkbox key={site} checked={form.targetSites.includes(site)} label={t(`admin.notif.banners.targets.site.${site}`)} onChange={() => set("targetSites", form.targetSites.includes(site) ? form.targetSites.filter((item) => item !== site) : [...form.targetSites, site])} />)}
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("admin.notif.banners.targets.eventsHint")}</p>
                <EventPicker value={form.targetEventIDs} onChange={(ids) => set("targetEventIDs", ids)} />
              </div>
              {(targetInvalid || serverFields.targetMode) && <p id="banner-target-error" role="alert" className="text-xs text-destructive">{t("admin.notif.banners.targets.required")}</p>}
            </>}
            <p className="text-xs text-muted-foreground">{targetSummary({ TargetMode: form.targetMode, TargetSites: form.targetSites, TargetEventIDs: form.targetEventIDs })}</p>
          </fieldset>
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
          <SaveButton dirty={banner === "new" || dirty} busy={busy} disabled={!valid} onClick={() => void save()}>{t("admin.notif.banners.save")}</SaveButton>
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
    <div className="flex min-h-full min-w-0 flex-col md:h-full md:min-h-0 gap-4">
      <PageHeader title={t("admin.notif.banners.title")}
        actions={canWrite ? <Button onClick={() => setEditing("new")}>{t("admin.notif.banners.create")}</Button> : undefined} />
    <div className="frost-panel frost-in flex min-h-0 flex-col overflow-hidden rounded-lg p-6">
      {actionError && <p role="alert" className="mb-2 text-sm text-destructive">{actionError}</p>}
      <div className="relative min-h-0 overflow-auto [--ib-state-h:400px]" aria-busy={banners === null && !error}>
        {error && !banners ? (
          <LoadError message={t("admin.notif.banners.loadError")} error={error.cause} className="h-[var(--ib-state-h)]" onRetry={() => { setError(null); load() }} />
        ) : banners === null ? (
          <LoadingArea className="h-[var(--ib-state-h)]" label={t("admin.loading")} />
        ) : banners.length === 0 ? (
          <EmptyState message={t("admin.notif.banners.empty")} className="h-[var(--ib-state-h)]" />
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border bg-[var(--ib-table-head)] text-left text-[length:var(--ib-fs-13)] font-medium text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("admin.notif.banners.text")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.banners.level")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.banners.window")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.banners.targets.title")}</th>
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
                  <td className="max-w-64 px-3 py-2 text-foreground">{targetSummary(banner)}</td>
                  <td className="px-3 py-2 text-foreground">{t(`admin.notif.banners.audience.${banner.Audience}`)}</td>
                  <td className="px-3 py-2 text-foreground">{t(BANNER_STATE_KEY[bannerState(banner)])}</td>
                  {canWrite && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <HoverTooltip text={t("admin.notif.banners.edit")}><Button variant="outline" size="icon" aria-label={t("admin.notif.banners.edit")} onClick={() => setEditing(banner)}><Pencil className="h-4 w-4" strokeWidth={2} aria-hidden="true" /></Button></HoverTooltip>
                        <HoverTooltip text={t(banner.IsActive ? "admin.notif.banners.deactivate" : "admin.notif.banners.activate")}><Button variant="outline" size="icon" aria-label={t(banner.IsActive ? "admin.notif.banners.deactivate" : "admin.notif.banners.activate")} onClick={() => void toggle(banner)}><Power className="h-4 w-4" strokeWidth={2} aria-hidden="true" /></Button></HoverTooltip>
                        <HoverTooltip text={t("admin.notif.banners.delete")}><Button variant="outline" size="icon" aria-label={t("admin.notif.banners.delete")} onClick={() => { setRemoveError(""); setRemoving(banner) }}><Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" /></Button></HoverTooltip>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
      {editing && <BannerDialog banner={editing} onClose={() => setEditing(null)} onSaved={(saved, close) => { setEditing(close ? null : saved); load() }} />}
      <ConfirmDialog
        open={removing !== null}
        onCancel={() => setRemoving(null)}
        tone="danger"
        title={t("admin.notif.banners.deleteTitle")}
        description={t("admin.notif.banners.deleteBody")}
        confirmLabel={t("admin.notif.banners.delete")}
        busy={removeBusy} busyLabel={t("busy.deleting")}
        error={removeError}
        onConfirm={() => void remove()}
      >
        {removing && <p className="truncate text-sm font-medium text-foreground">{removing.Text}</p>}
      </ConfirmDialog>
    </div>
  )
}
