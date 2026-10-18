"use client"

import { ApiError } from "@/api/client"
import { localizedError } from "@/i18n/apiError"
import { FieldValidation } from "@/components/ui/field-validation"
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { X } from "lucide-react"
import { getPreviewCatalog, getPreviewSettings, previewSelectionIdentity, savePreviewSettings, type PreviewDefaultsDraft, type PreviewSettings, type PreviewCatalogItem } from "@/api/participantPreviewSettings"
import { useRole } from "@/lib/useRole"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { t } from "@/i18n/t"
import { cn } from "@/utils/cn"

export function PreviewDefaultsEditor() {
  const canWrite = useRole().can("platform.settings.write")
  const [query, setQuery] = useState<{ data?: PreviewSettings; error?: unknown; isPending: boolean }>({ isPending: true })
  const load = useCallback(async () => {
    try { setQuery({ data: await getPreviewSettings(), isPending: false }) }
    catch (error) { setQuery(current => ({ ...current, error, isPending: false })) }
  }, [])
  useEffect(() => { void load() }, [load])
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [catalog, setCatalog] = useState<{ data: PreviewCatalogItem[]; error?: unknown; isPending: boolean }>({ data: [], isPending: true })
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!boxRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])
  useEffect(() => {
    if (!canWrite || !open) return
    let active = true
    getPreviewCatalog(deferredSearch).then(data => { if (active) setCatalog({ data, isPending: false }) }, error => { if (active) setCatalog(current => ({ ...current, error, isPending: false })) })
    return () => { active = false }
  }, [canWrite, open, deferredSearch, catalogRevision])
  const [draft, setDraft] = useState<PreviewDefaultsDraft | null>(null)
  const latest = useRef(draft)
  useLayoutEffect(() => { latest.current = draft }, [draft])
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState("")
  const [saveError, setSaveError] = useState(false)
  const model = draft ?? query.data
  const selected = model?.Selections ?? []
  const savedGroupName = query.data?.GroupName || t("admin.previewSettings.defaultGroupName")
  const groupName = draft ? draft.GroupName : savedGroupName
  const updateSelection = (Selections: PreviewDefaultsDraft["Selections"]) => setDraft({ GroupName: groupName, Selections })
  const dirty = !!query.data && (groupName !== savedGroupName || previewSelectionIdentity(selected) !== previewSelectionIdentity(query.data.Selections))
  // Choosable tasks first, then the muted ones with their reason.
  const options = [...catalog.data.filter(item => item.Eligible !== false), ...catalog.data.filter(item => item.Eligible === false)]
  const selectable = options.flatMap((item, index) => item.Eligible === false || item.Variants.length === 0 ? [] : [index])
  const toggle = (item: PreviewCatalogItem) => selected.some(x => x.ExerciseVersionID === item.ExerciseVersionID)
    ? updateSelection(selected.filter(x => x.ExerciseVersionID !== item.ExerciseVersionID))
    : updateSelection([...selected, { ExerciseVersionID: item.ExerciseVersionID, VariantID: item.Variants[0].ID, Name: item.Name }])
  const chooseVariant = (item: PreviewCatalogItem, VariantID: string) => updateSelection(selected.map(x => x.ExerciseVersionID === item.ExerciseVersionID ? { ...x, VariantID } : x))
  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { if (open) { event.preventDefault(); setOpen(false) } return }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) { setOpen(true); return }
      if (selectable.length === 0) return
      const at = selectable.indexOf(active)
      const next = event.key === "ArrowDown" ? (at + 1) % selectable.length : (at <= 0 ? selectable.length - 1 : at - 1)
      setActive(selectable[next])
      return
    }
    if (open && active >= 0 && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault()
      const item = options[active]
      if (item) toggle(item)
    } else if (event.key === "Enter") event.preventDefault()
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canWrite || !dirty || saving || !model || !groupName.trim()) return
    const submitted = draft
    setSaving(true); setSaveError(false)
    try {
      const saved = await savePreviewSettings({ GroupName: groupName.trim(), Selections: selected })
      setQuery({ data: saved, isPending: false })
      if (latest.current === submitted) setDraft(null)
      toast.success(t("admin.previewSettings.saved"))
    } catch (error) { if (error instanceof ApiError && error.code === 22705) setNameError(localizedError(error)); else setSaveError(true) } finally { setSaving(false) }
  }
  if (query.isPending) return <LoadingArea className="min-h-72" label={t("admin.loading")} />
  if (query.error) return <LoadError className="min-h-72" message={t("admin.previewSettings.loadFailed")} error={query.error} onRetry={() => void load()} />
  return <form onSubmit={save} className="space-y-5">
    <Card><CardHeader><CardTitle className="text-base">{t("admin.previewSettings.title")}</CardTitle><CardDescription>{t("admin.previewSettings.description")}</CardDescription></CardHeader><CardContent className="space-y-5">
      <p className="text-sm text-muted-foreground">{t("admin.previewSettings.inheritance")}</p>
      <div className="space-y-2"><label className="block text-sm font-medium" htmlFor="preview-group-name">{t("admin.previewSettings.groupName")}</label>
        <FieldValidation label={t("admin.previewSettings.groupName")} error={nameError}>{canWrite ? <Input id="preview-group-name" value={groupName} maxLength={100} required onChange={event => { setNameError(""); setDraft({ GroupName: event.target.value, Selections: selected }) }} /> : <p>{groupName}</p>}</FieldValidation>
      </div>
      {canWrite && <div ref={boxRef} className="relative space-y-2" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
        <label className="block text-sm font-medium" htmlFor="preview-catalog-search">{t("admin.previewSettings.catalog")}</label>
        <Input id="preview-catalog-search" role="combobox" aria-expanded={open} aria-controls="preview-catalog-list" aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? `preview-option-${active}` : undefined} autoComplete="off" value={search} placeholder={t("admin.previewSettings.search")}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onChange={event => { setSearch(event.target.value); setActive(-1); setOpen(true) }}
          onKeyDown={onSearchKey} />
        {open && <div id="preview-catalog-list" role="listbox" aria-multiselectable="true" aria-label={t("admin.previewSettings.catalog")} className="absolute left-0 right-0 z-20 flex max-h-80 min-h-40 flex-col overflow-auto rounded-md border border-border bg-card" onMouseDown={event => { if (!(event.target instanceof HTMLSelectElement)) event.preventDefault() }}>
          {catalog.isPending ? <LoadingArea className="min-h-40 flex-1" label={t("admin.loading")} /> : catalog.error ? <LoadError className="min-h-40 flex-1" message={t("admin.previewSettings.catalogFailed")} error={catalog.error} onRetry={() => setCatalogRevision(value => value + 1)} /> : options.length === 0 ? <EmptyState className="min-h-40 flex-1" message={t("admin.previewSettings.noMatches")} /> : options.map((item, index) => {
            const chosen = selected.find(x => x.ExerciseVersionID === item.ExerciseVersionID)
            if (item.Eligible === false) return <div key={item.ID} role="option" aria-disabled="true" aria-selected="false" className="flex flex-col border-b border-border px-3 py-2 text-muted-foreground last:border-b-0"><span className="break-words">{item.Name}</span><span className="text-sm">{t(`admin.previewSettings.reason.${item.Reason}`)}</span></div>
            return <div key={item.ID} id={`preview-option-${index}`} role="option" aria-selected={!!chosen} className={cn("flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 last:border-b-0", index === active && "bg-muted")}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"><input type="checkbox" tabIndex={-1} checked={!!chosen} disabled={item.Variants.length === 0} onChange={() => toggle(item)} /><span className="break-words">{item.Name}</span></label>
              {chosen && item.Variants.length > 1 && <select className="h-9 max-w-full rounded-md border border-border bg-card px-2 text-sm" aria-label={t("admin.previewSettings.variant", { name: item.Name })} value={chosen.VariantID} onChange={event => chooseVariant(item, event.target.value)}>{item.Variants.map(variant => <option key={variant.ID} value={variant.ID}>{t("admin.previewSettings.variantNumber", { number: variant.Index + 1 })}</option>)}</select>}
            </div>
          })}
        </div>}
      </div>}
      {selected.length === 0 ? <EmptyState compact message={t("admin.previewSettings.empty")} /> : <ul className="min-h-24 divide-y divide-border">{selected.map(item => <li key={item.ExerciseVersionID} className="flex min-h-12 items-center justify-between gap-3 py-2">
        <span className="min-w-0 break-words">{item.Name || item.ExerciseVersionID}</span>
        {canWrite && <Button type="button" size="icon" variant="ghost" aria-label={t("admin.previewSettings.remove", { name: item.Name || item.ExerciseVersionID })} onClick={() => updateSelection(selected.filter(x => x.ExerciseVersionID !== item.ExerciseVersionID))}><X className="h-4 w-4" aria-hidden="true" /></Button>}
      </li>)}</ul>}
    </CardContent></Card>
    {saveError && <p role="alert" className="text-sm text-destructive">{t("admin.previewSettings.saveFailed")}</p>}
    {canWrite && <SaveButton type="submit" dirty={dirty} busy={saving}>{t("admin.settings.save")}</SaveButton>}
  </form>
}
