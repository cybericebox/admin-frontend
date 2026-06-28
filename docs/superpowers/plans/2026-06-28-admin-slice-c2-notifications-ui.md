# Admin Slice C-2 — Notifications Management UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the super-admin-only Notifications management page in `admin-frontend` — a tabbed view (Statistics, Logs, Global Settings, Templates) wired to the slice C-1 read endpoints and the existing template/settings/test endpoints.

**Architecture:** A single `/notifications` route, gated by `RequireSuperAdmin`, hosting Radix `Tabs`. Each tab is its own component under `src/components/notifications/` that fetches via the aligned `apiGet/apiPut/apiPost/...` client (returns the unwrapped `Data` payload). Built entirely on the design-system components from slice A.

**Tech Stack:** Next 16 / React 19 / Tailwind v4 (Indigo Frost DS), TypeScript. No new dependencies.

## Global Constraints

- Repo & branch (no new branch): `admin-frontend@feature/base-redesign`. Run `tsc`/`build`/`git` from inside `/Users/volodymyrporokhniak/Projects/My/CyberICEBox/admin-frontend`.
- Commit footer on every commit: `Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7`
- All UI built only on design-system components + Indigo Frost tokens. No bespoke colors. Reuse existing DS primitives: `Tabs`, `Card`, `Button`, `Dialog*`, `Checkbox`, `Input`, `Label`, `Form`.
- The page is permission-gated: wrap content in `<RequirePermission perm="notifications.templates.read">` (the permission-driven gate from the "permission-driven UI" slice, which holds only for super_admin). Do NOT use the removed `RequireSuperAdmin`.
- i18n: every new key in BOTH `messages/en.json` (canonical) and `messages/uk.json` (active).
- The aligned API client unwraps the `{Status, Data}` envelope — components consume the payload directly (e.g. `d.Total`, `d.Templates`).

## Endpoint reference (exact shapes, post-envelope-unwrap)

- `GET /api/notifications/stats?days=<int>` → `{ Since: string, Total: number, ByStatus: {Key,Count}[], ByType: {Key,Count}[], ByChannel: {Channel,Status,Count}[] }`
- `GET /api/notifications/dispatches?type=&status=&limit=&offset=` → `{ Dispatches: Dispatch[], Total: number }`, `Dispatch = {ID,NotificationType,RecipientUserID,Status,CreatedAt,UpdatedAt}`
- `GET /api/notifications/dispatches/:id` → `Dispatch & { Targets: {Channel,Status,Error,Attempts,UpdatedAt}[] }`
- `GET /api/notifications/settings/global` → `{NotificationType,Channel,Enabled,UserCanChange,UserDefault}[]`
- `PUT /api/notifications/settings/global` body `{NotificationType,Channel,Enabled,UserCanChange,UserDefault}` (full upsert of one row)
- `GET /api/notifications/types` → `{Type, Channels: string[], Variables: {Name,Description,Default}[]}[]`
- `GET /api/notifications/templates/inapp` → `{Templates: InAppTpl[], MissingActiveFor: string[]}`, `InAppTpl = {ID,NotificationType,Status,Title,Body,Link,CreatedAt,UpdatedAt}`
- `POST /api/notifications/templates/inapp` body `{NotificationType,Title,Body,Link}` ; `PUT .../inapp/:id` body `{Title,Body,Link}` ; `PATCH .../inapp/:id/status` body `{Status}` ; `DELETE .../inapp/:id`
- `GET /api/notifications/templates/email` → `{Templates: EmailTpl[], MissingActiveFor: string[]}`, `EmailTpl = {ID,NotificationType,Status,Subject,Preheader,Body,CreatedAt,UpdatedAt}`
- `POST .../templates/email` body `{NotificationType,Subject,Preheader,Body}` ; `PUT .../email/:id` body `{Subject,Preheader,Body}` ; `PATCH/DELETE` as in-app
- `POST /api/notifications/test` body `{Type, Channels: string[], Variables: Record<string,unknown>}`
- Template `Status` values: `"draft"` | `"active"`.

---

## File Structure

- `src/app/notifications/page.tsx` — route shell: `RequireSuperAdmin` + Radix `Tabs`.
- `src/components/notifications/StatisticsTab.tsx` — Statistics (stats endpoint).
- `src/components/notifications/LogsTab.tsx` — dispatch log + detail dialog.
- `src/components/notifications/GlobalSettingsTab.tsx` — global settings matrix.
- `src/components/notifications/TemplatesTab.tsx` — templates sub-view (in-app + email + test).
- `src/components/notifications/StatusPill.tsx` — shared dispatch/target/template status pill.
- `messages/en.json`, `messages/uk.json` — new keys.

---

## Task 1: Notifications shell + tabs + Statistics tab

**Files:**
- Modify: `src/app/notifications/page.tsx`
- Create: `src/components/notifications/StatusPill.tsx`, `src/components/notifications/StatisticsTab.tsx`
- Create (placeholders, replaced in later tasks): `src/components/notifications/LogsTab.tsx`, `GlobalSettingsTab.tsx`, `TemplatesTab.tsx`
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `apiGet`, `RequirePermission` (from `@/components/rbac/RequirePermission`), DS `Tabs/Card`, `t`.
- Produces: the `/notifications` tabbed shell (tabs `statistics|logs|settings|templates`, default `statistics`); `StatusPill` (reused by Logs/Templates).
- **Prerequisite:** the "permission-driven UI" slice must be merged first (it provides `RequirePermission` + `useRole().can`).

- [ ] **Step 1: Add i18n keys (en.json)**

```json
"admin.notif.title": "Notifications",
"admin.notif.noAccess": "Super admin only.",
"admin.notif.tab.statistics": "Statistics",
"admin.notif.tab.logs": "Logs",
"admin.notif.tab.settings": "Global settings",
"admin.notif.tab.templates": "Templates",
"admin.notif.comingSoon": "Coming soon",
"admin.notif.loadError": "Failed to load",
"admin.notif.stats.total": "Total dispatches",
"admin.notif.stats.byStatus": "By status",
"admin.notif.stats.byType": "By type",
"admin.notif.stats.byChannel": "By channel",
"admin.notif.stats.window": "Window (days)",
"admin.notif.stats.empty": "No data in this window"
```

- [ ] **Step 2: Add the same keys (uk.json)**

```json
"admin.notif.title": "Сповіщення",
"admin.notif.noAccess": "Лише для суперадміна.",
"admin.notif.tab.statistics": "Статистика",
"admin.notif.tab.logs": "Логи",
"admin.notif.tab.settings": "Глобальні налаштування",
"admin.notif.tab.templates": "Шаблони",
"admin.notif.comingSoon": "Незабаром",
"admin.notif.loadError": "Не вдалося завантажити",
"admin.notif.stats.total": "Усього відправок",
"admin.notif.stats.byStatus": "За статусом",
"admin.notif.stats.byType": "За типом",
"admin.notif.stats.byChannel": "За каналом",
"admin.notif.stats.window": "Вікно (днів)",
"admin.notif.stats.empty": "Немає даних за період"
```

- [ ] **Step 3: Create the shared status pill**

Create `src/components/notifications/StatusPill.tsx`:

```tsx
const STYLES: Record<string, string> = {
  done: "bg-primary/15 text-primary",
  active: "bg-primary/15 text-primary",
  error: "bg-destructive/15 text-destructive",
  pending: "bg-muted text-muted-foreground",
  started: "bg-secondary text-secondary-foreground",
  draft: "bg-muted text-muted-foreground",
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  )
}
```

- [ ] **Step 4: Create placeholder tab components**

Create three files, each with this body (replace the component name per file — `LogsTab`, `GlobalSettingsTab`, `TemplatesTab`):

`src/components/notifications/LogsTab.tsx`:
```tsx
"use client"
import { t } from "@/i18n/t"
export function LogsTab() {
  return <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.notif.comingSoon")}</p>
}
```
`src/components/notifications/GlobalSettingsTab.tsx` — same body, `export function GlobalSettingsTab()`.
`src/components/notifications/TemplatesTab.tsx` — same body, `export function TemplatesTab()`.

- [ ] **Step 5: Create the Statistics tab**

Create `src/components/notifications/StatisticsTab.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import { apiGet } from "@/api/client"
import { t } from "@/i18n/t"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { StatusPill } from "./StatusPill"

type KeyCount = { Key: string; Count: number }
type ChannelStatus = { Channel: string; Status: string; Count: number }
type Stats = {
  Since: string
  Total: number
  ByStatus: KeyCount[]
  ByType: KeyCount[]
  ByChannel: ChannelStatus[]
}

const WINDOWS = [7, 30, 90]

export function StatisticsTab() {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)
    apiGet<Stats>(`/api/notifications/stats?days=${days}`)
      .then((d) => { if (!cancelled) setStats(d) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [days])

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.stats.window")}</span>
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setDays(w)}
            className={"rounded-md px-3 py-1 text-sm transition-colors " + (days === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent/30")}
          >{w}</button>
        ))}
      </div>

      {error ? (
        <p className="py-8 text-center text-sm text-destructive">{t("admin.notif.loadError")}</p>
      ) : loading || !stats ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.loading")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.stats.total")}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold text-foreground">{stats.Total}</p></CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.stats.byStatus")}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {stats.ByStatus.length === 0 ? <p className="text-sm text-muted-foreground">{t("admin.notif.stats.empty")}</p> :
                stats.ByStatus.map((s) => (
                  <div key={s.Key} className="flex items-center justify-between text-sm">
                    <StatusPill status={s.Key} /><span className="font-medium text-foreground">{s.Count}</span>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.stats.byType")}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {stats.ByType.length === 0 ? <p className="text-sm text-muted-foreground">{t("admin.notif.stats.empty")}</p> :
                stats.ByType.map((s) => (
                  <div key={s.Key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{s.Key}</span><span className="font-medium text-foreground">{s.Count}</span>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.notif.stats.byChannel")}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {stats.ByChannel.length === 0 ? <p className="text-sm text-muted-foreground">{t("admin.notif.stats.empty")}</p> :
                stats.ByChannel.map((c, i) => (
                  <div key={`${c.Channel}-${c.Status}-${i}`} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.Channel}</span>
                    <span className="flex items-center gap-2"><StatusPill status={c.Status} /><span className="font-medium text-foreground">{c.Count}</span></span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Build the page shell**

Replace `src/app/notifications/page.tsx` with:

```tsx
"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { t } from "@/i18n/t"
import { StatisticsTab } from "@/components/notifications/StatisticsTab"
import { LogsTab } from "@/components/notifications/LogsTab"
import { GlobalSettingsTab } from "@/components/notifications/GlobalSettingsTab"
import { TemplatesTab } from "@/components/notifications/TemplatesTab"

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.templates.read"
      fallback={
        <div className="frost-panel frost-in rounded-lg p-8 text-center text-sm text-muted-foreground">{t("admin.notif.noAccess")}</div>
      }
    >
      <div className="frost-in">
        <h1 className="mb-4 text-lg font-semibold text-foreground">{t("admin.notif.title")}</h1>
        <Tabs defaultValue="statistics">
          <TabsList>
            <TabsTrigger value="statistics">{t("admin.notif.tab.statistics")}</TabsTrigger>
            <TabsTrigger value="logs">{t("admin.notif.tab.logs")}</TabsTrigger>
            <TabsTrigger value="settings">{t("admin.notif.tab.settings")}</TabsTrigger>
            <TabsTrigger value="templates">{t("admin.notif.tab.templates")}</TabsTrigger>
          </TabsList>
          <TabsContent value="statistics"><StatisticsTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
          <TabsContent value="settings"><GlobalSettingsTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
        </Tabs>
      </div>
    </RequirePermission>
  )
}
```

- [ ] **Step 7: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0; `/notifications` builds.

- [ ] **Step 8: Commit**

```bash
cd admin-frontend
git add src/app/notifications/page.tsx src/components/notifications/ messages/en.json messages/uk.json
git commit -m "feat(admin): notifications shell + statistics tab (super_admin)

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 2: Logs tab (dispatch log + detail dialog)

**Files:**
- Modify: `src/components/notifications/LogsTab.tsx` (replace placeholder)
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `apiGet`, DS `Dialog*`, `StatusPill`, `t`.
- Produces: the Logs tab — filterable paginated dispatch table + per-dispatch targets dialog.

- [ ] **Step 1: Add i18n keys (en.json)**

```json
"admin.notif.logs.type": "Type",
"admin.notif.logs.status": "Status",
"admin.notif.logs.recipient": "Recipient",
"admin.notif.logs.created": "Created",
"admin.notif.logs.allTypes": "All types",
"admin.notif.logs.allStatuses": "All statuses",
"admin.notif.logs.empty": "No dispatches",
"admin.notif.logs.prev": "Previous",
"admin.notif.logs.next": "Next",
"admin.notif.logs.targets": "Delivery targets",
"admin.notif.logs.channel": "Channel",
"admin.notif.logs.attempts": "Attempts",
"admin.notif.logs.error": "Error",
"admin.notif.logs.close": "Close",
"admin.notif.logs.noTargets": "No targets"
```

- [ ] **Step 2: Add the same keys (uk.json)**

```json
"admin.notif.logs.type": "Тип",
"admin.notif.logs.status": "Статус",
"admin.notif.logs.recipient": "Отримувач",
"admin.notif.logs.created": "Створено",
"admin.notif.logs.allTypes": "Усі типи",
"admin.notif.logs.allStatuses": "Усі статуси",
"admin.notif.logs.empty": "Немає відправок",
"admin.notif.logs.prev": "Назад",
"admin.notif.logs.next": "Далі",
"admin.notif.logs.targets": "Цілі доставки",
"admin.notif.logs.channel": "Канал",
"admin.notif.logs.attempts": "Спроби",
"admin.notif.logs.error": "Помилка",
"admin.notif.logs.close": "Закрити",
"admin.notif.logs.noTargets": "Немає цілей"
```

- [ ] **Step 3: Build the Logs tab**

Replace `src/components/notifications/LogsTab.tsx` with:

```tsx
"use client"
import { useEffect, useState } from "react"
import { apiGet } from "@/api/client"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { StatusPill } from "./StatusPill"

type Dispatch = {
  ID: string
  NotificationType: string
  RecipientUserID: string
  Status: string
  CreatedAt: string
  UpdatedAt: string
}
type Target = { Channel: string; Status: string; Error: string; Attempts: number; UpdatedAt: string }
type DispatchDetail = Dispatch & { Targets: Target[] }
type ListResp = { Dispatches: Dispatch[]; Total: number }

const PAGE = 25
const STATUSES = ["pending", "started", "done"]

export function LogsTab() {
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<ListResp | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<DispatchDetail | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)
    const params = new URLSearchParams()
    if (type) params.set("type", type)
    if (status) params.set("status", status)
    params.set("limit", String(PAGE))
    params.set("offset", String(offset))
    apiGet<ListResp>(`/api/notifications/dispatches?${params.toString()}`)
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [type, status, offset])

  function openDetail(id: string) {
    setDetail(null); setOpen(true)
    apiGet<DispatchDetail>(`/api/notifications/dispatches/${id}`).then(setDetail).catch(() => setOpen(false))
  }

  const total = data?.Total ?? 0
  const rows = data?.Dispatches ?? []

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap gap-3">
        <input
          value={type}
          onChange={(e) => { setOffset(0); setType(e.target.value) }}
          placeholder={t("admin.notif.logs.allTypes")}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          value={status}
          onChange={(e) => { setOffset(0); setStatus(e.target.value) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{t("admin.notif.logs.allStatuses")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error ? (
        <p className="py-8 text-center text-sm text-destructive">{t("admin.notif.loadError")}</p>
      ) : loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.notif.logs.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.type")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.recipient")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.status")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.created")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.ID} onClick={() => openDetail(d.ID)} className="cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2 font-medium text-foreground">{d.NotificationType}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.RecipientUserID.slice(0, 8)}</td>
                  <td className="px-3 py-2"><StatusPill status={d.Status} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(d.CreatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{offset + 1}–{Math.min(offset + PAGE, total)} / {total}</span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>{t("admin.notif.logs.prev")}</Button>
          <Button variant="outline" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>{t("admin.notif.logs.next")}</Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("admin.notif.logs.targets")}</DialogTitle></DialogHeader>
          {!detail ? (
            <p className="py-4 text-sm text-muted-foreground">{t("admin.loading")}</p>
          ) : detail.Targets.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t("admin.notif.logs.noTargets")}</p>
          ) : (
            <div className="space-y-2">
              {detail.Targets.map((tg, i) => (
                <div key={`${tg.Channel}-${i}`} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{tg.Channel}</span>
                    <StatusPill status={tg.Status} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{t("admin.notif.logs.attempts")}: {tg.Attempts}</div>
                  {tg.Error && <div className="mt-1 text-xs text-destructive">{t("admin.notif.logs.error")}: {tg.Error}</div>}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("admin.notif.logs.close")}</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd admin-frontend
git add src/components/notifications/LogsTab.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): notifications logs tab (dispatch log + targets dialog)

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 3: Global Settings tab

**Files:**
- Modify: `src/components/notifications/GlobalSettingsTab.tsx` (replace placeholder)
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `apiGet`, `apiPut`, DS `Checkbox`, `t`.
- Produces: the Global Settings matrix — per type+channel toggles for Enabled / UserCanChange / UserDefault, each toggle PUTs the full row.

- [ ] **Step 1: Add i18n keys (en.json)**

```json
"admin.notif.settings.type": "Type",
"admin.notif.settings.channel": "Channel",
"admin.notif.settings.enabled": "Enabled",
"admin.notif.settings.userCanChange": "User can change",
"admin.notif.settings.userDefault": "User default",
"admin.notif.settings.empty": "No settings",
"admin.notif.settings.saveError": "Failed to save"
```

- [ ] **Step 2: Add the same keys (uk.json)**

```json
"admin.notif.settings.type": "Тип",
"admin.notif.settings.channel": "Канал",
"admin.notif.settings.enabled": "Увімкнено",
"admin.notif.settings.userCanChange": "Користувач може змінювати",
"admin.notif.settings.userDefault": "Типово для користувача",
"admin.notif.settings.empty": "Немає налаштувань",
"admin.notif.settings.saveError": "Не вдалося зберегти"
```

- [ ] **Step 3: Build the Global Settings tab**

Replace `src/components/notifications/GlobalSettingsTab.tsx` with:

```tsx
"use client"
import { useEffect, useState } from "react"
import { apiGet, apiPut } from "@/api/client"
import { t } from "@/i18n/t"
import { Checkbox } from "@/components/ui/checkbox"

type Setting = {
  NotificationType: string
  Channel: string
  Enabled: boolean
  UserCanChange: boolean
  UserDefault: boolean
}

const rowKey = (s: Setting) => `${s.NotificationType}::${s.Channel}`

export function GlobalSettingsTab() {
  const [rows, setRows] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)
    apiGet<Setting[]>("/api/notifications/settings/global")
      .then((d) => { if (!cancelled) setRows(d ?? []) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function toggle(s: Setting, field: "Enabled" | "UserCanChange" | "UserDefault", value: boolean) {
    const next = { ...s, [field]: value }
    setRows((prev) => prev.map((r) => (rowKey(r) === rowKey(s) ? next : r))) // optimistic
    setSaveError(false)
    try {
      await apiPut("/api/notifications/settings/global", next)
    } catch {
      setSaveError(true)
      setRows((prev) => prev.map((r) => (rowKey(r) === rowKey(s) ? s : r))) // revert
    }
  }

  if (error) return <p className="py-8 text-center text-sm text-destructive">{t("admin.notif.loadError")}</p>
  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.loading")}</p>
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.notif.settings.empty")}</p>

  return (
    <div className="space-y-3 pt-4">
      {saveError && <p className="text-sm text-destructive">{t("admin.notif.settings.saveError")}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("admin.notif.settings.type")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.notif.settings.channel")}</th>
              <th className="px-3 py-2 font-medium text-center">{t("admin.notif.settings.enabled")}</th>
              <th className="px-3 py-2 font-medium text-center">{t("admin.notif.settings.userCanChange")}</th>
              <th className="px-3 py-2 font-medium text-center">{t("admin.notif.settings.userDefault")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={rowKey(s)} className="border-b border-border/50">
                <td className="px-3 py-2 font-medium text-foreground">{s.NotificationType}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.Channel}</td>
                <td className="px-3 py-2 text-center"><Checkbox checked={s.Enabled} onCheckedChange={(v) => toggle(s, "Enabled", v === true)} /></td>
                <td className="px-3 py-2 text-center"><Checkbox checked={s.UserCanChange} onCheckedChange={(v) => toggle(s, "UserCanChange", v === true)} /></td>
                <td className="px-3 py-2 text-center"><Checkbox checked={s.UserDefault} onCheckedChange={(v) => toggle(s, "UserDefault", v === true)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

(Verify the DS `Checkbox` accepts `checked` + `onCheckedChange` props — it is the Radix-style checkbox copied in slice A. If its prop names differ, read `src/components/ui/checkbox.tsx` and adapt the two prop names; do not change the toggle logic.)

- [ ] **Step 4: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd admin-frontend
git add src/components/notifications/GlobalSettingsTab.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): notifications global settings tab (per type+channel toggles)

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 4: Templates tab — in-app templates

**Files:**
- Modify: `src/components/notifications/TemplatesTab.tsx` (replace placeholder)
- Create: `src/components/notifications/templateTypes.ts`
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `apiGet/apiPost/apiPut/apiPatch/apiDelete`, DS `Button/Dialog*/Input/Label`, `StatusPill`, `t`.
- Produces: the Templates tab hosting an in-app templates section (list + create/edit dialog + status toggle + delete) and the type catalog loader (`useNotificationTypes`). Task 5 adds the email section + test send to the same tab.

- [ ] **Step 1: Add i18n keys (en.json)**

```json
"admin.notif.tpl.inapp": "In-app templates",
"admin.notif.tpl.email": "Email templates",
"admin.notif.tpl.new": "New template",
"admin.notif.tpl.edit": "Edit",
"admin.notif.tpl.delete": "Delete",
"admin.notif.tpl.activate": "Activate",
"admin.notif.tpl.deactivate": "Set draft",
"admin.notif.tpl.type": "Notification type",
"admin.notif.tpl.title": "Title",
"admin.notif.tpl.body": "Body",
"admin.notif.tpl.link": "Link",
"admin.notif.tpl.subject": "Subject",
"admin.notif.tpl.preheader": "Preheader",
"admin.notif.tpl.save": "Save",
"admin.notif.tpl.cancel": "Cancel",
"admin.notif.tpl.empty": "No templates",
"admin.notif.tpl.saveError": "Failed to save",
"admin.notif.tpl.deleteConfirm": "Delete this template?",
"admin.notif.tpl.missingActive": "No active template for"
```

- [ ] **Step 2: Add the same keys (uk.json)**

```json
"admin.notif.tpl.inapp": "Шаблони in-app",
"admin.notif.tpl.email": "Шаблони email",
"admin.notif.tpl.new": "Новий шаблон",
"admin.notif.tpl.edit": "Редагувати",
"admin.notif.tpl.delete": "Видалити",
"admin.notif.tpl.activate": "Активувати",
"admin.notif.tpl.deactivate": "Зробити чернеткою",
"admin.notif.tpl.type": "Тип сповіщення",
"admin.notif.tpl.title": "Заголовок",
"admin.notif.tpl.body": "Текст",
"admin.notif.tpl.link": "Посилання",
"admin.notif.tpl.subject": "Тема",
"admin.notif.tpl.preheader": "Прехедер",
"admin.notif.tpl.save": "Зберегти",
"admin.notif.tpl.cancel": "Скасувати",
"admin.notif.tpl.empty": "Немає шаблонів",
"admin.notif.tpl.saveError": "Не вдалося зберегти",
"admin.notif.tpl.deleteConfirm": "Видалити цей шаблон?",
"admin.notif.tpl.missingActive": "Немає активного шаблону для"
```

- [ ] **Step 3: Create the shared type-catalog hook**

Create `src/components/notifications/templateTypes.ts`:

```ts
import { useEffect, useState } from "react"
import { apiGet } from "@/api/client"

export type NotifType = { Type: string; Channels: string[]; Variables: { Name: string; Description: string; Default: string }[] }

// useNotificationTypes loads the notification-type catalog once.
export function useNotificationTypes(): NotifType[] {
  const [types, setTypes] = useState<NotifType[]>([])
  useEffect(() => {
    let cancelled = false
    apiGet<NotifType[]>("/api/notifications/types")
      .then((d) => { if (!cancelled) setTypes(d ?? []) })
      .catch(() => { if (!cancelled) setTypes([]) })
    return () => { cancelled = true }
  }, [])
  return types
}
```

- [ ] **Step 4: Build the Templates tab with the in-app section**

Replace `src/components/notifications/TemplatesTab.tsx` with:

```tsx
"use client"
import { useEffect, useState } from "react"
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/api/client"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog"
import { StatusPill } from "./StatusPill"
import { useNotificationTypes } from "./templateTypes"

type InAppTpl = { ID: string; NotificationType: string; Status: string; Title: string; Body: string; Link: string; CreatedAt: string; UpdatedAt: string }
type InAppList = { Templates: InAppTpl[]; MissingActiveFor: string[] }

export function TemplatesTab() {
  const types = useNotificationTypes()
  return (
    <div className="space-y-8 pt-4">
      <InAppSection types={types.map((x) => x.Type)} />
    </div>
  )
}

function InAppSection({ types }: { types: string[] }) {
  const [data, setData] = useState<InAppList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<InAppTpl | "new" | null>(null)

  function reload() {
    setLoading(true); setError(false)
    apiGet<InAppList>("/api/notifications/templates/inapp")
      .then(setData).catch(() => setError(true)).finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.notif.tpl.inapp")}</h2>
        <Button onClick={() => setEditing("new")}>{t("admin.notif.tpl.new")}</Button>
      </div>

      {error ? <p className="text-sm text-destructive">{t("admin.notif.loadError")}</p>
        : loading ? <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
        : (data?.Templates.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">{t("admin.notif.tpl.empty")}</p>
        : (
          <div className="space-y-2">
            {data!.Templates.map((tpl) => (
              <div key={tpl.ID} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{tpl.NotificationType}</span>
                    <StatusPill status={tpl.Status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tpl.Title}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => apiPatch(`/api/notifications/templates/inapp/${tpl.ID}/status`, { Status: tpl.Status === "active" ? "draft" : "active" }).then(reload)}>
                    {tpl.Status === "active" ? t("admin.notif.tpl.deactivate") : t("admin.notif.tpl.activate")}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(tpl)}>{t("admin.notif.tpl.edit")}</Button>
                  <DeleteButton onConfirm={() => apiDelete(`/api/notifications/templates/inapp/${tpl.ID}`).then(reload)} />
                </div>
              </div>
            ))}
          </div>
        )}

      {data && data.MissingActiveFor.length > 0 && (
        <p className="text-xs text-destructive">{t("admin.notif.tpl.missingActive")}: {data.MissingActiveFor.join(", ")}</p>
      )}

      {editing && (
        <InAppEditor
          types={types}
          tpl={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload() }}
        />
      )}
    </section>
  )
}

function InAppEditor({ types, tpl, onClose, onSaved }: { types: string[]; tpl: InAppTpl | null; onClose: () => void; onSaved: () => void }) {
  const [notificationType, setNotificationType] = useState(tpl?.NotificationType ?? types[0] ?? "")
  const [title, setTitle] = useState(tpl?.Title ?? "")
  const [body, setBody] = useState(tpl?.Body ?? "")
  const [link, setLink] = useState(tpl?.Link ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function save() {
    setBusy(true); setError(false)
    try {
      if (tpl) await apiPut(`/api/notifications/templates/inapp/${tpl.ID}`, { Title: title, Body: body, Link: link })
      else await apiPost("/api/notifications/templates/inapp", { NotificationType: notificationType, Title: title, Body: body, Link: link })
      onSaved()
    } catch { setError(true); setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tpl ? t("admin.notif.tpl.edit") : t("admin.notif.tpl.new")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!tpl && (
            <label className="block text-sm">
              <span className="text-muted-foreground">{t("admin.notif.tpl.type")}</span>
              <select value={notificationType} onChange={(e) => setNotificationType(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {types.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
              </select>
            </label>
          )}
          <Field label={t("admin.notif.tpl.title")} value={title} onChange={setTitle} />
          <label className="block text-sm">
            <span className="text-muted-foreground">{t("admin.notif.tpl.body")}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <Field label={t("admin.notif.tpl.link")} value={link} onChange={setLink} />
          {error && <p className="text-sm text-destructive">{t("admin.notif.tpl.saveError")}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("admin.notif.tpl.cancel")}</Button></DialogClose>
          <Button disabled={busy} onClick={save}>{t("admin.notif.tpl.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Field is a shared labelled text input.
export function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </label>
  )
}

// DeleteButton is a confirm-dialog delete trigger reused by both sections.
export function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="destructive">{t("admin.notif.tpl.delete")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("admin.notif.tpl.deleteConfirm")}</DialogTitle></DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("admin.notif.tpl.cancel")}</Button></DialogClose>
          <DialogClose asChild><Button variant="destructive" onClick={onConfirm}>{t("admin.notif.tpl.delete")}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd admin-frontend
git add src/components/notifications/TemplatesTab.tsx src/components/notifications/templateTypes.ts messages/en.json messages/uk.json
git commit -m "feat(admin): notifications templates tab — in-app CRUD + status

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Task 5: Templates tab — email templates + test send

**Files:**
- Modify: `src/components/notifications/TemplatesTab.tsx` (add the email section + test-send)
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: the `Field`/`DeleteButton` helpers + `useNotificationTypes` from Task 4; `apiGet/apiPost/apiPut/apiPatch/apiDelete`; DS `Dialog*`/`Button`; `StatusPill`; `t`.
- Produces: the email-templates section (mirror of in-app, with Subject/Preheader/Body) and a "Send test" action posting to `/api/notifications/test`.

- [ ] **Step 1: Add i18n keys (en.json)**

```json
"admin.notif.tpl.test": "Send test",
"admin.notif.tpl.testChannels": "Channels",
"admin.notif.tpl.testSend": "Send",
"admin.notif.tpl.testOk": "Test sent",
"admin.notif.tpl.testError": "Test failed"
```

- [ ] **Step 2: Add the same keys (uk.json)**

```json
"admin.notif.tpl.test": "Надіслати тест",
"admin.notif.tpl.testChannels": "Канали",
"admin.notif.tpl.testSend": "Надіслати",
"admin.notif.tpl.testOk": "Тест надіслано",
"admin.notif.tpl.testError": "Помилка тесту"
```

- [ ] **Step 3: Add the email section + test dialog to `TemplatesTab.tsx`**

In `src/components/notifications/TemplatesTab.tsx`:

(a) Add the `EmailTpl`/`EmailList` types near the `InAppTpl` types:
```tsx
type EmailTpl = { ID: string; NotificationType: string; Status: string; Subject: string; Preheader: string; Body: string; CreatedAt: string; UpdatedAt: string }
type EmailList = { Templates: EmailTpl[]; MissingActiveFor: string[] }
```

(b) Change the default-export `TemplatesTab` to also pass the full type objects and render the email section + a test button. Replace the existing `TemplatesTab` function with:
```tsx
export function TemplatesTab() {
  const types = useNotificationTypes()
  const names = types.map((x) => x.Type)
  return (
    <div className="space-y-8 pt-4">
      <div className="flex justify-end"><TestSend types={types} /></div>
      <InAppSection types={names} />
      <EmailSection types={names} />
    </div>
  )
}
```

(c) Append the `EmailSection`, `EmailEditor`, and `TestSend` components at the end of the file:
```tsx
function EmailSection({ types }: { types: string[] }) {
  const [data, setData] = useState<EmailList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<EmailTpl | "new" | null>(null)

  function reload() {
    setLoading(true); setError(false)
    apiGet<EmailList>("/api/notifications/templates/email")
      .then(setData).catch(() => setError(true)).finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.notif.tpl.email")}</h2>
        <Button onClick={() => setEditing("new")}>{t("admin.notif.tpl.new")}</Button>
      </div>

      {error ? <p className="text-sm text-destructive">{t("admin.notif.loadError")}</p>
        : loading ? <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
        : (data?.Templates.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">{t("admin.notif.tpl.empty")}</p>
        : (
          <div className="space-y-2">
            {data!.Templates.map((tpl) => (
              <div key={tpl.ID} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{tpl.NotificationType}</span>
                    <StatusPill status={tpl.Status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tpl.Subject}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => apiPatch(`/api/notifications/templates/email/${tpl.ID}/status`, { Status: tpl.Status === "active" ? "draft" : "active" }).then(reload).catch(() => setError(true))}>
                    {tpl.Status === "active" ? t("admin.notif.tpl.deactivate") : t("admin.notif.tpl.activate")}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(tpl)}>{t("admin.notif.tpl.edit")}</Button>
                  <DeleteButton onConfirm={() => apiDelete(`/api/notifications/templates/email/${tpl.ID}`).then(reload).catch(() => setError(true))} />
                </div>
              </div>
            ))}
          </div>
        )}

      {data && data.MissingActiveFor.length > 0 && (
        <p className="text-xs text-destructive">{t("admin.notif.tpl.missingActive")}: {data.MissingActiveFor.join(", ")}</p>
      )}

      {editing && (
        <EmailEditor types={types} tpl={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
    </section>
  )
}

function EmailEditor({ types, tpl, onClose, onSaved }: { types: string[]; tpl: EmailTpl | null; onClose: () => void; onSaved: () => void }) {
  const [notificationType, setNotificationType] = useState(tpl?.NotificationType ?? types[0] ?? "")
  const [subject, setSubject] = useState(tpl?.Subject ?? "")
  const [preheader, setPreheader] = useState(tpl?.Preheader ?? "")
  const [body, setBody] = useState(tpl?.Body ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function save() {
    setBusy(true); setError(false)
    try {
      if (tpl) await apiPut(`/api/notifications/templates/email/${tpl.ID}`, { Subject: subject, Preheader: preheader, Body: body })
      else await apiPost("/api/notifications/templates/email", { NotificationType: notificationType, Subject: subject, Preheader: preheader, Body: body })
      onSaved()
    } catch { setError(true); setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tpl ? t("admin.notif.tpl.edit") : t("admin.notif.tpl.new")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!tpl && (
            <label className="block text-sm">
              <span className="text-muted-foreground">{t("admin.notif.tpl.type")}</span>
              <select value={notificationType} onChange={(e) => setNotificationType(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {types.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
              </select>
            </label>
          )}
          <Field label={t("admin.notif.tpl.subject")} value={subject} onChange={setSubject} />
          <Field label={t("admin.notif.tpl.preheader")} value={preheader} onChange={setPreheader} />
          <label className="block text-sm">
            <span className="text-muted-foreground">{t("admin.notif.tpl.body")}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          {error && <p className="text-sm text-destructive">{t("admin.notif.tpl.saveError")}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("admin.notif.tpl.cancel")}</Button></DialogClose>
          <Button disabled={busy} onClick={save}>{t("admin.notif.tpl.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TestSend({ types }: { types: { Type: string; Channels: string[] }[] }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState("")
  const [channels, setChannels] = useState<string[]>([])
  const [result, setResult] = useState<"ok" | "error" | null>(null)
  const [busy, setBusy] = useState(false)

  const selected = types.find((x) => x.Type === type)

  async function send() {
    setBusy(true); setResult(null)
    try {
      await apiPost("/api/notifications/test", { Type: type, Channels: channels, Variables: {} })
      setResult("ok")
    } catch { setResult("error") } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setResult(null); setType(types[0]?.Type ?? ""); setChannels([]) } }}>
      <DialogTrigger asChild><Button variant="secondary">{t("admin.notif.tpl.test")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("admin.notif.tpl.test")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">{t("admin.notif.tpl.type")}</span>
            <select value={type} onChange={(e) => { setType(e.target.value); setChannels([]) }}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {types.map((ty) => <option key={ty.Type} value={ty.Type}>{ty.Type}</option>)}
            </select>
          </label>
          <div className="text-sm">
            <span className="text-muted-foreground">{t("admin.notif.tpl.testChannels")}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {(selected?.Channels ?? []).map((ch) => {
                const on = channels.includes(ch)
                return (
                  <button key={ch} type="button"
                    onClick={() => setChannels((prev) => on ? prev.filter((c) => c !== ch) : [...prev, ch])}
                    className={"rounded-md px-3 py-1 text-sm " + (on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent/30")}>
                    {ch}
                  </button>
                )
              })}
            </div>
          </div>
          {result === "ok" && <p className="text-sm text-primary">{t("admin.notif.tpl.testOk")}</p>}
          {result === "error" && <p className="text-sm text-destructive">{t("admin.notif.tpl.testError")}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("admin.notif.tpl.cancel")}</Button></DialogClose>
          <Button disabled={busy || !type || channels.length === 0} onClick={send}>{t("admin.notif.tpl.testSend")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Typecheck + build**

Run: `cd admin-frontend && npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd admin-frontend
git add src/components/notifications/TemplatesTab.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): notifications templates — email CRUD + test send

Claude-Session: https://claude.ai/code/session_01QfvH8LfD5yp5zSztMtJzQ7"
```

---

## Self-Review

**Spec coverage (spec §"Slice C — Notification management", 4 tabs):**
- Statistics tab (landing) → Task 1, consuming `GET /api/notifications/stats`.
- Logs tab (paginated dispatch log + per-dispatch targets dialog, filters) → Task 2, consuming `/dispatches` + `/dispatches/:id`.
- Global Settings tab (per type+channel enabled/user_can_change/user_default) → Task 3, `GET/PUT /settings/global`.
- Templates tab (in-app + email CRUD + status + test) → Tasks 4–5, the template + catalog + test endpoints.
- Permission gate → `<RequirePermission perm="notifications.templates.read">` on the page (Task 1; from the permission-driven UI slice, super_admin-only in practice). Default landing tab = Statistics (Task 1 `defaultValue="statistics"`).

**Placeholder scan:** No TBD/TODO. Task 1 creates real placeholder tab components (functional, render "coming soon") so the page builds; Tasks 2–5 replace them with real implementations — this is explicit incremental delivery, not a hole. The one verification note (DS `Checkbox` prop names in Task 3) is a concrete read-and-adapt instruction.

**Type consistency:** Endpoint response shapes in each tab's TS types match the backend DTOs (slice C-1 handler `dispatchResponse`/`statsResponse`; existing template/settings/catalog DTOs). `StatusPill` (Task 1) is imported by Tasks 2/4/5. `Field`/`DeleteButton`/`useNotificationTypes` defined in Task 4 are reused in Task 5. The `TemplatesTab` export name is stable across Tasks 4–5 (Task 5 replaces the function body, keeping the export). Tab `value` strings (`statistics|logs|settings|templates`) are fixed in Task 1's shell and never re-keyed.
