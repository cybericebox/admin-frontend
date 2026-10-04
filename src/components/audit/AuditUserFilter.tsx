"use client"
import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { apiGet } from "@/api/client"
import type { OffsetPage } from "@/api/pagination"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"

export type PickedUser = { id: string; name: string }
type UserHit = { ID: string; FirstName: string; LastName: string; Email: string }

const hitName = (user: UserHit) => `${user.FirstName ?? ""} ${user.LastName ?? ""}`.trim() || user.Email

// The user filter: a chip once someone is picked, otherwise a debounced search over /api/users.
// The results list sits under the field and keeps its height across loading / empty / error.
export function AuditUserFilter({ value, onChange }: { value: PickedUser | null; onChange: (user: PickedUser | null) => void }) {
  const [text, setText] = useState("")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<{ query: string; items: UserHit[] } | null>(null)
  const [failed, setFailed] = useState<{ query: string } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const next = text.trim()
    if (next === query) return
    const id = setTimeout(() => setQuery(next), 300)
    return () => clearTimeout(id)
  }, [text, query])

  useEffect(() => {
    if (!open || !query) return
    let active = true
    apiGet<OffsetPage<UserHit>>(`/api/users?search=${encodeURIComponent(query)}&page=1&pageSize=6`)
      .then((page) => { if (active) { setHits({ query, items: page.Items ?? [] }); setFailed(null) } })
      .catch(() => { if (active) setFailed({ query }) })
    return () => { active = false }
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  if (value) {
    return (
      <div className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-foreground">
        <span className="max-w-56 truncate">{t("admin.audit.filter.user")}: {value.name}</span>
        <button type="button" onClick={() => onChange(null)} aria-label={t("admin.audit.filter.userClear")} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    )
  }

  const settled = !!query && hits?.query === query
  const failure = !!query && failed?.query === query

  return (
    <div ref={box} className="relative min-w-[min(100%,16rem)] flex-1 lg:max-w-xs">
      <Input type="search" value={text} onChange={(event) => { setText(event.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
        placeholder={t("admin.audit.filter.userSearch")} aria-label={t("admin.audit.filter.userSearch")} />
      {open && query && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 h-48 overflow-auto rounded-md border border-border bg-card">
          {failure ? <LoadError compact message={t("admin.audit.filter.userLoadError")} className="h-full" onRetry={() => { setFailed(null); setQuery(""); setTimeout(() => setQuery(text.trim()), 0) }} />
            : !settled ? <LoadingArea compact className="h-full" />
            : hits.items.length === 0 ? <EmptyState compact className="h-full" message={t("admin.audit.filter.userEmpty")} />
            : <ul>{hits.items.map((user) => (
              <li key={user.ID}>
                <button type="button" onClick={() => { onChange({ id: user.ID, name: hitName(user) }); setText(""); setQuery(""); setOpen(false) }}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent/10">
                  <span className="truncate text-foreground">{hitName(user)}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.Email}</span>
                </button>
              </li>))}</ul>}
        </div>
      )}
    </div>
  )
}
