"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { apiGet, apiPost } from "@/api/client"
import type { CursorPage } from "@/api/pagination"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SelectMenu } from "@/components/ui/select-menu"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"

type Participant = { UserID: string; Status: number; CreatedAt: string; DecidedAt: string | null }
type UserSummary = { ID: string; FirstName: string; LastName: string; Email: string }

const filters = [
  { value: "", label: "Усі статуси" },
  { value: "1", label: "Очікують рішення" },
  { value: "2", label: "Підтверджені" },
  { value: "3", label: "Відхилені" },
]
const statusLabel: Record<number, string> = { 1: "Очікує рішення", 2: "Підтверджено", 3: "Відхилено" }

function nameOf(user: UserSummary | undefined, fallback: string): string {
  if (!user) return fallback
  return `${user.FirstName ?? ""} ${user.LastName ?? ""}`.trim() || user.Email || fallback
}

export function EventParticipantsCard({ eventID, editable }: { eventID: string; editable: boolean }) {
  const [filter, setFilter] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [items, setItems] = useState<Participant[]>([])
  const [users, setUsers] = useState<Record<string, UserSummary>>({})
  const [cursor, setCursor] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busyID, setBusyID] = useState("")
  const [rejecting, setRejecting] = useState<Participant | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({ pageSize: "20" })
    if (filter) query.set("status", filter)
    apiGet<CursorPage<Participant>>(`/api/events/${encodeURIComponent(eventID)}/participants?${query}`)
      .then((page) => { if (active) { setItems(page.Items ?? []); setCursor(page.NextCursor ?? ""); setError("") } })
      .catch(() => { if (active) setError("Не вдалося завантажити учасників.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventID, filter, reloadKey])

  useEffect(() => {
    let active = true
    Promise.allSettled(items.map((item) => apiGet<UserSummary>(`/api/users/${encodeURIComponent(item.UserID)}`)))
      .then((results) => {
        if (!active) return
        setUsers((previous) => {
          const next = { ...previous }
          results.forEach((result) => { if (result.status === "fulfilled") next[result.value.ID] = result.value })
          return next
        })
      })
    return () => { active = false }
  }, [items])

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    setError("")
    const query = new URLSearchParams({ pageSize: "20", cursor })
    if (filter) query.set("status", filter)
    try {
      const page = await apiGet<CursorPage<Participant>>(`/api/events/${encodeURIComponent(eventID)}/participants?${query}`)
      setItems((current) => [...current, ...(page.Items ?? [])])
      setCursor(page.NextCursor ?? "")
    } catch {
      setError("Не вдалося завантажити наступну сторінку.")
    } finally {
      setLoadingMore(false)
    }
  }

  async function decide(item: Participant, decision: "approve" | "reject") {
    setBusyID(item.UserID)
    setError("")
    try {
      await apiPost(`/api/events/${encodeURIComponent(eventID)}/participants/${encodeURIComponent(item.UserID)}/${decision}`, {})
      setItems((current) => filter === "1"
        ? current.filter((entry) => entry.UserID !== item.UserID)
        : current.map((entry) => entry.UserID === item.UserID ? { ...entry, Status: decision === "approve" ? 2 : 3, DecidedAt: new Date().toISOString() } : entry))
      setRejecting(null)
    } catch {
      setError(decision === "approve" ? "Не вдалося підтвердити заявку." : "Не вдалося відхилити заявку.")
    } finally {
      setBusyID("")
    }
  }

  return <Card><CardContent className="pt-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-foreground">Учасники</h3><p className="mt-1 text-sm text-muted-foreground">Заявки на участь і рішення щодо них.</p></div><SelectMenu value={filter} onChange={(value) => { setLoading(true); setItems([]); setCursor(""); setFilter(value) }} options={filters} disabled={loadingMore} ariaLabel="Фільтр учасників" className="w-48" /></div>
    {error && <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 text-sm text-destructive"><span>{error}</span><Button type="button" size="sm" variant="outline" onClick={() => { setLoading(true); setReloadKey((key) => key + 1) }}>Повторити</Button></div>}
    {loading ? <LoadingArea compact label="Завантаження учасників" /> : items.length === 0 ? <EmptyState message={filter ? "Учасників не знайдено." : "Учасників поки немає."} compact /> : <ul className="divide-y divide-border">{items.map((item) => {
      const user = users[item.UserID]
      const name = nameOf(user, item.UserID)
      return <li key={item.UserID} className="flex flex-wrap items-center gap-3 py-3">
        <div className="min-w-0 flex-1"><Link className="break-words text-sm font-medium text-primary hover:underline" href={`/users/detail?id=${encodeURIComponent(item.UserID)}`}>{name}</Link>{user?.Email && <p className="break-all text-xs text-muted-foreground">{user.Email}</p>}</div>
        <span className="text-sm text-muted-foreground">{statusLabel[item.Status] ?? "Невідомий статус"}</span>
        {editable && item.Status === 1 && <div className="flex gap-2"><Button type="button" size="sm" disabled={!!busyID} onClick={() => void decide(item, "approve")} aria-label={`Підтвердити ${name}`}>Підтвердити</Button><Button type="button" size="sm" variant="outline" disabled={!!busyID} onClick={() => setRejecting(item)} aria-label={`Відхилити ${name}`}>Відхилити</Button></div>}
      </li>
    })}</ul>}
    {cursor && !loading && <Button type="button" variant="outline" size="sm" className="mt-4" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Завантаження…" : "Показати ще"}</Button>}
    <Dialog open={!!rejecting} onOpenChange={(open) => { if (!open && !busyID) setRejecting(null) }}><DialogContent><DialogHeader><DialogTitle>Відхилити заявку?</DialogTitle><DialogDescription>{rejecting ? `Заявка ${nameOf(users[rejecting.UserID], rejecting.UserID)} буде відхилена.` : ""}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" disabled={!!busyID} onClick={() => setRejecting(null)}>Скасувати</Button><Button type="button" variant="destructive" disabled={!!busyID} onClick={() => { if (rejecting) void decide(rejecting, "reject") }}>Відхилити заявку</Button></DialogFooter></DialogContent></Dialog>
  </CardContent></Card>
}
