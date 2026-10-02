"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MoreHorizontal, Plus, RefreshCw } from "lucide-react"
import {
  checkAgent, deleteAgent, listAgents, previewAgentDelete, renewAgentCertificate, rotateAgentAccessKey, updateAgent,
  type Agent, type DeletePreview,
} from "@/api/agents"
import { RefreshIndicator } from "@/components/infrastructure/RefreshIndicator"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { Spinner, LoadingArea } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { usePolling } from "@/lib/usePolling"
import { useRole } from "@/lib/useRole"
import { cn } from "@/utils/cn"
import { DeleteBlockedDialog, EditAgentDialog, EnrollDialog, ReconnectDialog, ReservationImpactList } from "./AgentDialogs"
import { CERT_WARN_DAYS, agentState, capacityText, certDaysLeft, featureChips, sortAgents, type AgentState } from "./agentView"

const STATE_STYLE: Record<AgentState, string> = {
  online: "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]",
  unreachable: "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]",
  offline: "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]",
  disabled: "bg-secondary text-muted-foreground",
  archived: "bg-secondary text-muted-foreground",
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", className)}>{children}</span>
}

function Fact({ label, children, warn }: { label: string; children: React.ReactNode; warn?: boolean }) {
  return <div className="min-w-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className={cn("text-sm", warn ? "text-[var(--ib-warn)]" : "text-foreground")}>{children}</dd>
  </div>
}

type Action = "check" | "renew" | "rotate" | "preview" | "delete"
type Confirm = { kind: "rotate"; agent: Agent } | { kind: "renew"; agent: Agent } | { kind: "delete"; agent: Agent; preview: DeletePreview }

export function AgentsPage() {
  const { can } = useRole()
  const allowed = can("infrastructure.read")
  const canWrite = can("infrastructure.write")

  const [items, setItems] = useState<Agent[] | null>(null)
  const [archived, setArchived] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState<Record<string, Action | undefined>>({})
  const [enrolling, setEnrolling] = useState(false)
  const [editing, setEditing] = useState<Agent | null>(null)
  const [reconnecting, setReconnecting] = useState<Agent | null>(null)
  const [blocked, setBlocked] = useState<{ agent: Agent; preview: DeletePreview } | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState("")

  const archivedRef = useRef(archived)
  const itemsRef = useRef<Agent[] | null>(null)
  useEffect(() => { archivedRef.current = archived; itemsRef.current = items })

  // Instant saves run one after another; a poll or a server answer never overwrites a newer choice still waiting.
  const queue = useRef<Promise<void>>(Promise.resolve())
  const waiting = useRef(0)

  const load = useCallback(async () => {
    try {
      const next = await listAgents(archivedRef.current)
      if (waiting.current === 0) setItems(next.Items ?? [])
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [])
  const { updatedAt, refreshing, refresh } = usePolling(load, allowed)

  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    void refresh(true)
  }, [archived, refresh])

  const upsert = (agent: Agent) => setItems((current) => current && (current.some((a) => a.ID === agent.ID) ? current.map((a) => (a.ID === agent.ID ? agent : a)) : [...current, agent]))
  const setAction = (id: string, action: Action | undefined) => setBusy((current) => ({ ...current, [id]: action }))

  function toggle(agent: Agent, enabled: boolean) {
    setItems((current) => current && current.map((a) => (a.ID === agent.ID ? { ...a, Enabled: enabled } : a)))
    waiting.current += 1
    queue.current = queue.current.then(async () => {
      try {
        const live = itemsRef.current?.find((a) => a.ID === agent.ID) ?? agent
        const saved = await updateAgent(agent.ID, { Name: live.Name, Priority: live.Priority, Enabled: live.Enabled })
        waiting.current -= 1
        if (waiting.current === 0) upsert(saved)
      } catch (err) {
        waiting.current -= 1
        toast.error(localizedError(err))
        if (waiting.current === 0) await load()
      }
    })
  }

  async function run(agent: Agent, action: Action, call: () => Promise<Agent>, done?: (saved: Agent) => void) {
    setAction(agent.ID, action)
    try {
      const saved = await call()
      upsert(saved)
      done?.(saved)
    } catch (err) {
      toast.error(localizedError(err))
    } finally {
      setAction(agent.ID, undefined)
    }
  }

  const check = (agent: Agent) => run(agent, "check", () => checkAgent(agent.ID), (saved) => {
    if (saved.Healthy) toast.success(t("admin.agents.check.ok", { name: saved.Name, ms: saved.LatencyMs }))
    else toast.error(t("admin.agents.check.failed", { name: saved.Name, error: saved.Error || t("admin.agents.check.noAnswer") }))
  })

  async function startDelete(agent: Agent) {
    setAction(agent.ID, "preview")
    try {
      const preview = await previewAgentDelete(agent.ID)
      if (preview.RunningGroups > 0) setBlocked({ agent, preview })
      else { setConfirmError(""); setConfirm({ kind: "delete", agent, preview }) }
    } catch (err) {
      toast.error(localizedError(err))
    } finally {
      setAction(agent.ID, undefined)
    }
  }

  async function runConfirm() {
    if (!confirm) return
    setConfirmBusy(true)
    setConfirmError("")
    const { agent } = confirm
    try {
      if (confirm.kind === "delete") {
        await deleteAgent(agent.ID)
        toast.success(t("admin.agents.delete.done", { name: agent.Name }))
        setConfirm(null)
        void refresh(true)
      } else {
        const saved = await (confirm.kind === "rotate" ? rotateAgentAccessKey : renewAgentCertificate)(agent.ID)
        upsert(saved)
        toast.success(t(confirm.kind === "rotate" ? "admin.agents.rotate.done" : "admin.agents.renew.done", { name: agent.Name }))
        setConfirm(null)
      }
    } catch (err) {
      setConfirmError(localizedError(err))
    } finally {
      setConfirmBusy(false)
    }
  }

  const retry = () => void refresh(true)
  const loading = items === null && error === null
  const list = items ? sortAgents(items) : []

  return <div className="flex min-h-full flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold text-foreground">{t("admin.agents.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("admin.agents.subtitle")}</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <RefreshIndicator updatedAt={updatedAt} refreshing={refreshing} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={archived} onCheckedChange={setArchived} aria-label={t("admin.agents.archived")} />{t("admin.agents.archived")}
        </label>
        <Button variant="outline" onClick={retry} disabled={refreshing}><RefreshCw className="mr-2 h-4 w-4" />{t("admin.labs.refresh")}</Button>
        {canWrite && <Button onClick={() => setEnrolling(true)}><Plus className="mr-2 h-4 w-4" />{t("admin.agents.add")}</Button>}
      </div>
    </div>

    {error !== null && items && <LoadError message={t("admin.agents.error.load")} error={error} compact onRetry={retry} />}
    {loading ? <LoadingArea className="flex-1" label={t("admin.loading")} />
      : !items ? <LoadError message={t("admin.agents.error.load")} error={error} onRetry={retry} className="flex-1" />
      : list.length === 0 ? <EmptyState className="flex-1" message={t(archived ? "admin.agents.emptyArchived" : canWrite ? "admin.agents.empty" : "admin.agents.emptyReadonly")} />
      : <Card><ul className="divide-y divide-border" data-testid="agents-list">
        {list.map((agent) => {
          const state = agentState(agent)
          const chips = featureChips(agent)
          const days = certDaysLeft(agent)
          const working = busy[agent.ID]
          return <li key={agent.ID} data-testid={`agent-${agent.ID}`} className={cn("space-y-3 px-4 py-4", state === "archived" && "opacity-70")}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  <span className="truncate">{agent.Name}</span>
                  <Badge className={STATE_STYLE[!agent.Enabled && state !== "archived" ? "disabled" : state]}>{t(`admin.agents.state.${!agent.Enabled && state !== "archived" ? "disabled" : state}`)}</Badge>
                  <Badge className="bg-secondary text-muted-foreground">{t(`admin.agents.source.${agent.Source}`)}</Badge>
                </p>
                <p className="truncate text-sm text-muted-foreground">{agent.Endpoint || "—"}{agent.Tenant && ` · ${agent.Tenant}`}</p>
              </div>
              <div className="flex items-center gap-2">
                {working && <Spinner size="sm" label={t(`admin.agents.working.${working}`)} />}
                {state !== "archived" && <Switch checked={agent.Enabled} onCheckedChange={(next) => toggle(agent, next)} disabled={!canWrite} aria-label={t("admin.agents.enabledLabel", { name: agent.Name })} />}
                {canWrite && state !== "archived" && <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("admin.agents.actions", { name: agent.Name })}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void check(agent)}>{t("admin.agents.action.check")}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setEditing(agent)}>{t("admin.agents.action.edit")}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setReconnecting(agent)}>{t("admin.agents.action.reconnect")}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => { setConfirmError(""); setConfirm({ kind: "renew", agent }) }}>{t("admin.agents.action.renew")}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => { setConfirmError(""); setConfirm({ kind: "rotate", agent }) }}>{t("admin.agents.action.rotate")}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onSelect={() => void startDelete(agent)}>{t("admin.agents.action.delete")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
              <Fact label={t("admin.agents.fact.priority")}>{agent.Priority}</Fact>
              <Fact label={t("admin.agents.fact.capacity")}>{capacityText(agent)}</Fact>
              <Fact label={t("admin.agents.fact.cert")} warn={days !== null && days < CERT_WARN_DAYS}>
                {agent.CertExpiresAt ? t("admin.agents.cert.until", { date: formatDateTime(agent.CertExpiresAt) }) : "—"}
              </Fact>
              <Fact label={t("admin.agents.fact.groups")}>{agent.Groups}</Fact>
            </dl>
            <div className="flex flex-wrap items-center gap-1.5" data-testid="agent-features">
              {chips ? chips.map((chip) => <Badge key={chip} className="bg-secondary text-muted-foreground">{chip}</Badge>) : <span className="text-xs text-muted-foreground">{t("admin.agents.feature.unknown")}</span>}
            </div>
            {state !== "online" && state !== "archived" && agent.Error && <p className="break-words text-xs text-destructive">{agent.Error}</p>}
          </li>
        })}
      </ul></Card>}

    {enrolling && <EnrollDialog onClose={() => setEnrolling(false)} onDone={(agent) => { upsert(agent); setEnrolling(false); toast.success(t("admin.agents.add.done", { name: agent.Name })); void refresh(true) }} />}
    {editing && <EditAgentDialog agent={editing} onClose={() => setEditing(null)} onDone={(agent) => { upsert(agent); setEditing(null); toast.success(t("admin.agents.edit.done", { name: agent.Name })) }} />}
    {reconnecting && <ReconnectDialog agent={reconnecting} onClose={() => setReconnecting(null)} onDone={(agent) => { upsert(agent); setReconnecting(null); toast.success(t("admin.agents.reconnect.done", { name: agent.Name })) }} />}
    {blocked && <DeleteBlockedDialog agent={blocked.agent} preview={blocked.preview} onClose={() => setBlocked(null)} />}

    <ConfirmDialog open={confirm !== null} onCancel={() => { if (!confirmBusy) setConfirm(null) }} busy={confirmBusy} error={confirmError}
      tone={confirm?.kind === "delete" ? "danger" : "default"}
      title={confirm ? t(`admin.agents.${confirm.kind}.title`, { name: confirm.agent.Name }) : ""}
      description={confirm ? t(`admin.agents.${confirm.kind}.body`) : undefined}
      confirmLabel={confirm ? t(`admin.agents.${confirm.kind}.confirm`) : ""}
      onConfirm={() => void runConfirm()}>
      {confirm?.kind === "delete" && <ReservationImpactList preview={confirm.preview} />}
    </ConfirmDialog>
  </div>
}
