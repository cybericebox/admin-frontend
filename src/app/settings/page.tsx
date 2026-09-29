"use client"
import { useCallback, useEffect, useState } from "react"
import { apiGet, apiPut } from "@/api/client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { useRole } from "@/lib/useRole"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingArea } from "@/components/ui/spinner"
import { SettingsTabs } from "@/components/settings/SettingsTabs"

type Setting = {
  ID: string
  Key: string
  Value: unknown
  RequiredPermission: string
  CreatedAt: string
  UpdatedAt: string
}

export default function Page() {
  const allowed = useRole().can("platform.settings.read")
  const [items, setItems] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setError("")
      setItems(await apiGet<Setting[]>("/api/settings"))
    } catch {
      setError("Не вдалося завантажити налаштування платформи.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (allowed) queueMicrotask(() => void load()) }, [allowed, load])

  async function save(item: Setting) {
    let value: unknown
    try {
      value = JSON.parse(draft)
    } catch {
      setError("Значення має бути коректним JSON.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const saved = await apiPut<Setting>(`/api/settings/${encodeURIComponent(item.Key)}`, { Value: value, RequiredPermission: item.RequiredPermission })
      setItems((previous) => previous.map((current) => current.Key === item.Key ? saved : current))
      setEditing(null)
    } catch {
      setError("Не вдалося зберегти налаштування.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <RequirePermission
      perm="platform.settings.read"
      fallback={
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">Немає доступу до налаштувань платформи.</div>
      }
    >
      <div className="flex min-h-full flex-col gap-5">
        <SettingsTabs />
        <div><h2 className="text-xl font-semibold text-foreground">Налаштування платформи</h2><p className="mt-1 text-sm text-muted-foreground">Загальні параметри, доступні адміністратору платформи.</p></div>
        {error && <p role="alert" className="rounded-md bg-[var(--ib-danger-bg)] p-3 text-sm text-[var(--ib-danger)]">{error}</p>}
        {loading ? <LoadingArea className="flex-1" label="Завантаження…" /> : items.length === 0 ? <Card><CardContent className="pt-5"><EmptyState message="Налаштувань поки немає." compact /></CardContent></Card> : (
          <Card><CardContent className="divide-y divide-border pt-5">
            {items.map((item) => <div key={item.ID} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="font-medium text-foreground">{item.Key}</h3>{editing !== item.Key && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-sm text-muted-foreground">{typeof item.Value === "string" ? item.Value : JSON.stringify(item.Value, null, 2)}</pre>}</div>
                {editing !== item.Key && <RequirePermission perm="platform.settings.write"><Button variant="outline" size="sm" aria-label={`Редагувати ${item.Key}`} onClick={() => { setEditing(item.Key); setDraft(JSON.stringify(item.Value, null, 2)); setError("") }}>Редагувати</Button></RequirePermission>}</div>
              {editing === item.Key && <div className="mt-3 space-y-3"><label className="block text-sm font-medium" htmlFor="setting-value">Значення</label><textarea id="setting-value" value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} className="w-full rounded-md border border-border bg-card p-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-primary" /><div className="flex gap-2"><Button onClick={() => void save(item)} disabled={saving}>Зберегти</Button><Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Скасувати</Button></div></div>}
            </div>)}
          </CardContent></Card>
        )}
      </div>
    </RequirePermission>
  )
}
