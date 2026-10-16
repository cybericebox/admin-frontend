"use client"

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import { X } from "lucide-react"
import { getPreviewCatalog, getPreviewSettings, previewSelectionIdentity, savePreviewSettings, type PreviewDefaultsDraft, type PreviewSettings, type PreviewCatalogItem } from "@/api/participantPreviewSettings"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { useRole } from "@/lib/useRole"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { t } from "@/i18n/t"

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
  useEffect(() => {
    if (!canWrite) return
    let active = true
    getPreviewCatalog(deferredSearch).then(data => { if (active) setCatalog({ data, isPending: false }) }, error => { if (active) setCatalog(current => ({ ...current, error, isPending: false })) })
    return () => { active = false }
  }, [canWrite, deferredSearch, catalogRevision])
  const [draft, setDraft] = useState<PreviewDefaultsDraft | null>(null)
  const latest = useRef(draft)
  useLayoutEffect(() => { latest.current = draft }, [draft])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const model = draft ?? query.data
  const selected = model?.Selections ?? []
  const savedGroupName = query.data?.GroupName || t("admin.previewSettings.defaultGroupName")
  const groupName = draft ? draft.GroupName : savedGroupName
  const updateSelection = (Selections: PreviewDefaultsDraft["Selections"]) => setDraft({ GroupName: groupName, Selections })
  const dirty = !!query.data && (groupName !== savedGroupName || previewSelectionIdentity(selected) !== previewSelectionIdentity(query.data.Selections))
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
    } catch { setSaveError(true) } finally { setSaving(false) }
  }
  if (query.isPending) return <LoadingArea className="min-h-72" label={t("admin.loading")} />
  if (query.error) return <LoadError className="min-h-72" message={t("admin.previewSettings.loadFailed")} error={query.error} onRetry={() => void load()} />
  return <form onSubmit={save} className="space-y-5">
    <Card><CardContent className="space-y-5 pt-5">
      <div><h2 className="font-semibold">{t("admin.previewSettings.selection")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("admin.previewSettings.inheritance")}</p></div>
      <div className="space-y-2"><label className="block text-sm font-medium" htmlFor="preview-group-name">{t("admin.previewSettings.groupName")}</label>
        {canWrite ? <Input id="preview-group-name" value={groupName} maxLength={100} required onChange={event => setDraft({ GroupName: event.target.value, Selections: selected })} /> : <p>{groupName}</p>}
      </div>
      {selected.length === 0 ? <EmptyState compact message={t("admin.previewSettings.empty")} /> : <ul className="min-h-24 divide-y divide-border">{selected.map(item => <li key={item.ExerciseVersionID} className="flex min-h-12 items-center justify-between gap-3 py-2">
        <span className="min-w-0 break-words">{item.Name || item.ExerciseVersionID}</span>
        {canWrite && <Button type="button" size="icon" variant="ghost" aria-label={t("admin.previewSettings.remove", { name: item.Name || item.ExerciseVersionID })} onClick={() => updateSelection(selected.filter(x => x.ExerciseVersionID !== item.ExerciseVersionID))}><X className="h-4 w-4" aria-hidden="true" /></Button>}
      </li>)}</ul>}
      {canWrite && <div className="space-y-3 border-t border-border pt-5">
        <label className="block text-sm font-medium" htmlFor="preview-catalog-search">{t("admin.previewSettings.catalog")}</label>
        <Input id="preview-catalog-search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t("admin.previewSettings.search")} />
        {catalog.isPending ? <LoadingArea className="min-h-60" label={t("admin.loading")} /> : catalog.error ? <LoadError className="min-h-60" message={t("admin.previewSettings.catalogFailed")} error={catalog.error} onRetry={() => setCatalogRevision(value => value + 1)} /> : catalog.data.length === 0 ? <EmptyState className="min-h-60" message={t("admin.previewSettings.noMatches")} /> : <ul className="min-h-60 max-h-96 divide-y divide-border overflow-auto">{catalog.data.map(item => {
          const chosen = selected.find(x => x.ExerciseVersionID === item.ExerciseVersionID)
          const choose = (VariantID: string) => updateSelection([...selected.filter(x => x.ExerciseVersionID !== item.ExerciseVersionID), { ExerciseVersionID: item.ExerciseVersionID, VariantID, Name: item.Name }])
          return <li key={item.ID} className="flex flex-wrap items-center gap-3 py-3">
            <label className="flex min-w-0 flex-1 items-center gap-3"><input type="checkbox" checked={!!chosen} disabled={item.Variants.length === 0} onChange={event => event.target.checked ? choose(item.Variants[0].ID) : updateSelection(selected.filter(x => x.ExerciseVersionID !== item.ExerciseVersionID))} /><span className="break-words">{item.Name}</span></label>
            {chosen && item.Variants.length > 1 && <select className="h-9 max-w-full rounded-md border border-border bg-card px-2 text-sm" aria-label={t("admin.previewSettings.variant", { name: item.Name })} value={chosen.VariantID} onChange={event => choose(event.target.value)}>{item.Variants.map(variant => <option key={variant.ID} value={variant.ID}>{t("admin.previewSettings.variantNumber", { number: variant.Index + 1 })}</option>)}</select>}
          </li>
        })}</ul>}
      </div>}
    </CardContent></Card>
    {saveError && <p role="alert" className="text-sm text-destructive">{t("admin.previewSettings.saveFailed")}</p>}
    {canWrite && <SaveButton type="submit" dirty={dirty} busy={saving}>{t("admin.settings.save")}</SaveButton>}
  </form>
}

export default function PreviewSettingsPage() {
  return <RequirePermission perm="platform.settings.read" fallback={<NoAccess message={t("admin.settings.noAccess")} />}><div className="flex min-h-full flex-col gap-5">
    <PageHeader title={t("admin.previewSettings.title")} sub={t("admin.previewSettings.description")} /><SettingsTabs /><PreviewDefaultsEditor />
  </div></RequirePermission>
}
