"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { listExercisesPage, type ExerciseListItem } from "@/api/exercises/catalog"
import { TagInput } from "@/components/exercises/TagInput"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { TablePagination } from "@/components/ui/table-pagination"
import { SortableHeader } from "@/components/ui/sortable-header"
import { SelectMenu } from "@/components/ui/select-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { localDraftStorageKey, parseLocalDraft, type LocalExerciseDraft } from "@/lib/localExerciseDraft"
import { Trash2 } from "lucide-react"

function StatusBadges({ item }: { item: ExerciseListItem }) {
  return (
    <span className="flex flex-wrap gap-1">
      {item.HasDraft && (
        <span className="rounded-full bg-secondary/40 px-2 py-0.5 text-xs">{t("admin.ex.status.draft")}</span>
      )}
      {item.HasPublished && (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{t("admin.ex.status.published")}</span>
      )}
      {!item.HasDraft && !item.HasPublished && <span className="text-xs text-muted-foreground">—</span>}
    </span>
  )
}

export default function Page() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [status, setStatus] = useState("all")
  const [rows, setRows] = useState<ExerciseListItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState("updated")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [localDraft, setLocalDraft] = useState<LocalExerciseDraft | null>(null)
  const [draftDialog, setDraftDialog] = useState<"create" | "delete" | null>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const { can, me } = useRole()
  const storageKey = me?.ID ? localDraftStorageKey(me.ID) : null

  useEffect(() => {
    if (!storageKey) return
    const refresh = () => {
      try { setLocalDraft(parseLocalDraft(window.localStorage.getItem(storageKey))) }
      catch { setLocalDraft(null) }
    }
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey) refresh() }
    const onVisible = () => { if (document.visibilityState === "visible") refresh() }
    refresh()
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [storageKey])

  function createExercise() {
    if (storageKey) {
      try {
        const stored = parseLocalDraft(window.localStorage.getItem(storageKey))
        if (stored) {
          setLocalDraft(stored)
          setDraftDialog("create")
          return
        }
      } catch { /* No accessible browser draft; open the editor. */ }
    }
    router.push("/exercises/new")
  }

  function clearBrowserDraft(): boolean {
    if (!storageKey) return false
    try {
      window.localStorage.removeItem(storageKey)
      setLocalDraft(null)
      toast.success("Локальну чернетку видалено.")
      setDraftDialog(null)
      return true
    } catch {
      toast.error(t("admin.ex.localDraft.deleteError"))
      return false
    }
  }

  useEffect(() => {
    const id = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setLoading(true); setError(false) } })
    listExercisesPage({ search: debounced, tags, status: status === "all" ? "" : status, page, pageSize, sortBy, sortDir })
      .then((data) => { if (active) { setRows(data.Items); setTotal(data.Total) } })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [debounced, tags, status, page, pageSize, sortBy, sortDir, reloadKey])

  function goToPage(next: number) {
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0
    setLoading(true)
    setPage(next)
  }

  function sort(field: string) {
    setSortDir(field === sortBy ? sortDir === "asc" ? "desc" : "asc" : field === "updated" ? "desc" : "asc")
    setSortBy(field)
    goToPage(1)
  }

  return (
    <div className="frost-panel frost-in flex h-full min-h-0 flex-col overflow-hidden rounded-lg p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.ex.search")}
          aria-label={t("admin.ex.search")}
          className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm"
        />
        <div className="min-w-64 max-w-md flex-1">
          <TagInput value={tags} onChange={(value) => { setTags(value); goToPage(1) }} placeholder={t("admin.ex.filterTags.placeholder")} className="min-h-10" />
        </div>
        <SelectMenu value={status} onChange={(value) => { setStatus(value); goToPage(1) }}
          options={[{ value: "all", label: t("admin.ex.filterStatusAll") }, { value: "draft", label: t("admin.ex.status.draft") }, { value: "published", label: t("admin.ex.status.published") }, { value: "none", label: t("admin.ex.filterStatusNone") }]}
          ariaLabel={t("admin.ex.filterStatus")} className="h-10 min-w-44 text-sm" />
        {can("exercises.write") && (
          <Button type="button" onClick={createExercise} className="ml-auto h-10 shrink-0 text-sm">{t("admin.ex.create.button")}</Button>
        )}
      </div>

      <div ref={tableScrollRef} className="relative min-h-0 flex-1 overflow-auto" aria-busy={loading}>
      {error && rows.length === 0 && !localDraft ? (
        <div className="flex flex-col items-center gap-3 py-8"><p role="alert" className="text-center text-sm text-destructive">{t("admin.ex.loadError")}</p><Button variant="outline" onClick={() => { setError(false); setLoading(true); setReloadKey((key) => key + 1) }}>{t("admin.ex.retry")}</Button></div>
      ) : loading && rows.length === 0 && !localDraft ? (
        <LoadingArea label={t("admin.loading")} />
      ) : rows.length === 0 && !localDraft ? (
        <EmptyState message={t(debounced || tags.length > 0 || status !== "all" ? "admin.ex.emptyFiltered" : "admin.ex.empty")} className="h-full" />
      ) : (
        <div>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <SortableHeader label={t("admin.ex.col.name")} field="name" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortableHeader label={t("admin.ex.col.tags")} field="tags" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortableHeader label={t("admin.ex.col.status")} field="status" activeField={sortBy} direction={sortDir} onSort={sort} />
                <SortableHeader label={t("admin.ex.col.updated")} field="updated" activeField={sortBy} direction={sortDir} onSort={sort} />
              </tr>
            </thead>
            <tbody>
              {localDraft && <tr className="border-b border-amber-300/70 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/25">
                <td className="border-l-2 border-l-amber-400 px-3 py-2">
                  <Link href="/exercises/new" className="block">
                    <span className="font-medium text-foreground">{localDraft.identity.Name || t("admin.ex.localDraft.untitled")}</span>
                    {localDraft.identity.Description && <span className="block max-w-md truncate text-xs text-muted-foreground">{localDraft.identity.Description}</span>}
                  </Link>
                </td>
                <td className="px-3 py-2"><span className="flex flex-wrap gap-1">{localDraft.identity.Tags.map((tag) => <span key={tag} className="rounded-full bg-secondary/40 px-2 py-0.5 text-xs">{tag}</span>)}</span></td>
                <td className="px-3 py-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{t("admin.ex.localDraft.badge")}</span></td>
                <td className="px-3 py-2"><div className="flex items-center justify-between gap-2"><time className="whitespace-nowrap text-muted-foreground" dateTime={new Date(localDraft.updatedAt).toISOString()}>{new Date(localDraft.updatedAt).toLocaleString("uk-UA", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><Button type="button" variant="ghost" size="icon" aria-label={t("admin.ex.localDraft.delete")} className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDraftDialog("delete")}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button></div></td>
              </tr>}
              {rows.filter((item) => item.ID !== localDraft?.createdId).map((item) => (
                <tr key={item.ID} className="border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2">
                    <Link href={`/exercises/detail?id=${item.ID}`} className="block">
                      <span className="font-medium text-foreground">{item.Name}</span>
                      {item.Description && (
                        <span className="block max-w-md truncate text-xs text-muted-foreground">{item.Description}</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {item.Tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-secondary/40 px-2 py-0.5 text-xs">{tag}</span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2"><StatusBadges item={item} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {item.UpdatedAt ? new Date(item.UpdatedAt).toLocaleString("uk-UA", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && (rows.length > 0 || localDraft) && <div className="sticky bottom-3 ml-auto mr-3 flex w-fit items-center gap-2 rounded-md border border-destructive bg-card px-3 py-1.5 text-xs text-destructive"><span role="alert">{t("admin.ex.loadError")}</span><Button variant="outline" size="sm" onClick={() => { setError(false); setLoading(true); setReloadKey((key) => key + 1) }}>{t("admin.ex.retry")}</Button></div>}
      </div>
      <TablePagination page={page} pageSize={pageSize} total={total} busy={loading}
        onPage={goToPage} onPageSize={(size) => { setPageSize(size); goToPage(1) }} />
      <Dialog open={draftDialog !== null} onOpenChange={(open) => { if (!open) setDraftDialog(null) }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xl">
          <DialogHeader>
            <DialogTitle>{t(draftDialog === "delete" ? "admin.ex.localDraft.deleteTitle" : "admin.ex.localDraft.confirmTitle")}</DialogTitle>
            <DialogDescription>{t(draftDialog === "delete" ? "admin.ex.localDraft.deleteDescription" : "admin.ex.localDraft.confirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap gap-2 sm:space-x-0">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setDraftDialog(null)}>{t("admin.ex.create.cancel")}</Button>
            {draftDialog === "create" && <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => { setDraftDialog(null); router.push("/exercises/new") }}>{t("admin.ex.localDraft.continue")}</Button>}
            <Button type="button" variant={draftDialog === "delete" ? "destructive" : "default"} className="w-full max-w-full whitespace-normal text-center sm:w-auto" onClick={() => { if (clearBrowserDraft() && draftDialog === "create") router.push("/exercises/new") }}>{t(draftDialog === "delete" ? "admin.ex.localDraft.deleteConfirm" : "admin.ex.localDraft.reset")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
