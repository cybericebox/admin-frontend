"use client"

import { useEffect, useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import DOMPurify from "isomorphic-dompurify"
import { Bell, ChevronLeft, X } from "lucide-react"
import { apiGet, apiPatch } from "@/api/client"
import { useRole } from "@/lib/useRole"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { onServiceRestored } from "@/lib/serviceStatus"

type Message = {
  ID: string
  Title: string
  Body: string
  Link: string
  ReadAt: string | null
  CreatedAt: string
}

export function InboxButton() {
  const allowed = useRole().can("notifications.self")
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Message[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!allowed) return
    let current = true
    const refresh = () => {
      apiGet<Message[]>("/api/notifications/inbox")
        .then((next) => {
          if (!current) return
          // A refresh started before a read request must not restore an old unread badge.
          setItems((previous) => (next ?? []).map((item) => ({
            ...item,
            ReadAt: item.ReadAt ?? previous.find((entry) => entry.ID === item.ID)?.ReadAt ?? null,
          })))
          setError("")
        })
        .catch(() => { if (current) setError("Не вдалося завантажити вхідні повідомлення.") })
        .finally(() => { if (current) setLoading(false) })
    }
    const refreshWhenVisible = () => { if (document.visibilityState !== "hidden") refresh() }
    refresh()
    const unsubscribe = onServiceRestored(refresh)
    const timer = window.setInterval(refreshWhenVisible, 15_000)
    document.addEventListener("visibilitychange", refreshWhenVisible)
    window.addEventListener("focus", refreshWhenVisible)
    window.addEventListener("cybericebox:inbox-updated", refresh)
    return () => {
      current = false
      unsubscribe()
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
      window.removeEventListener("focus", refreshWhenVisible)
      window.removeEventListener("cybericebox:inbox-updated", refresh)
    }
  }, [allowed, open])

  if (!allowed) return null

  const unread = items.filter((item) => !item.ReadAt).length
  const active = items.find((item) => item.ID === selected)
  const title = unread ? `Вхідні: ${unread} непрочитаних` : "Вхідні"

  async function openMessage(item: Message) {
    setSelected(item.ID)
    setError("")
    if (item.ReadAt) return
    try {
      await apiPatch(`/api/notifications/inbox/${encodeURIComponent(item.ID)}/read`, {})
      setItems((current) => current.map((entry) => entry.ID === item.ID ? { ...entry, ReadAt: new Date().toISOString() } : entry))
    } catch {
      setError("Повідомлення відкрито, але не вдалося позначити його прочитаним.")
    }
  }

  async function readAll() {
    setError("")
    try {
      await apiPatch("/api/notifications/inbox/read-all", {})
      const now = new Date().toISOString()
      setItems((current) => current.map((item) => ({ ...item, ReadAt: item.ReadAt ?? now })))
    } catch {
      setError("Не вдалося позначити повідомлення прочитаними.")
    }
  }

  return <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSelected(null) }}>
    <Popover.Trigger asChild>
      <button type="button" aria-label={title} className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-semibold leading-none text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="end" sideOffset={8} collisionPadding={12} aria-label="Особисті вхідні" className="z-50 flex max-h-[min(38rem,calc(100vh-5rem))] w-[min(32rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {active && <button type="button" onClick={() => setSelected(null)} aria-label="До списку повідомлень" className="rounded-md p-1 hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft className="h-4 w-4" /></button>}
            {active ? <h2 className="truncate text-sm font-semibold">{active.Title}</h2> : <h2>
              <span className="sr-only">Вхідні</span>
              <Bell aria-hidden="true" className="h-[19px] w-[19px] text-muted-foreground" />
            </h2>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!active && <button type="button" disabled={unread === 0} onClick={() => void readAll()} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">Позначити все прочитаним</button>}
            <Popover.Close aria-label="Закрити вхідні" className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><X className="h-4 w-4" /></Popover.Close>
          </div>
        </div>
        {error && <p role="alert" className="mx-3 mt-3 rounded-md bg-[var(--ib-danger-bg)] p-2 text-xs text-[var(--ib-danger)]">{error}</p>}
        {active ? <section className="min-h-0 overflow-y-auto p-4" aria-label="Повідомлення">
          <time className="block text-xs text-muted-foreground" dateTime={active.CreatedAt}>{new Date(active.CreatedAt).toLocaleString("uk-UA")}</time>
          <div className="mt-4 break-words text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(active.Body ?? "") }} />
          {active.Link && /^https?:\/\/|^\/(?!\/)/i.test(active.Link) && <a className="mt-4 inline-block text-sm font-medium text-primary hover:underline" href={active.Link}>Відкрити</a>}
        </section> : <>
          <div className="min-h-0 overflow-y-auto">
            {loading ? <LoadingArea compact label="Завантаження повідомлень" /> : items.length === 0 ? <EmptyState message="Повідомлень поки немає." inbox /> : <ul className="divide-y divide-border">{items.map((item) => <li key={item.ID}><button type="button" onClick={() => void openMessage(item)} className="flex w-full flex-col gap-1 px-4 py-3 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"><span className="flex w-full items-center gap-2"><span className={`min-w-0 flex-1 truncate ${item.ReadAt ? "" : "font-semibold"}`}>{item.Title}</span>{!item.ReadAt && <span aria-label="Непрочитане" className="h-2 w-2 shrink-0 rounded-full bg-primary" />}</span><time className="text-xs text-muted-foreground" dateTime={item.CreatedAt}>{new Date(item.CreatedAt).toLocaleString("uk-UA")}</time></button></li>)}</ul>}
          </div>
        </>}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
}
