"use client"

import { useEffect, useRef, useState } from "react"
import { getCapacity, getSettings, putSettings, type Conflict } from "@/api/resourceCalendar"
import { TableWrap } from "@/components/common/DsTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldHelp } from "@/components/ui/field-help"
import { LoadError } from "@/components/ui/load-error"
import { NumberInput } from "@/components/ui/number-input"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { tRich } from "@/i18n/tRich"
import { amountToText, isDoesNotFit, textToAmount, type AmountText } from "@/lib/resourceCalendar"
import { AllowConflictsDialog, BLOCK, Badge, Th, formatAmount, formatWindow, useCalendarResource } from "./resourceView"

const NONE: Conflict[] = []

/** The always-on minimum of the test pool, and the capacity the calendar sees per agent. */
export function SettingsTab({ canWrite, onSaved }: { canWrite: boolean; onSaved: () => void }) {
  const settings = useCalendarResource(getSettings, true)
  const capacity = useCalendarResource(getCapacity, true)
  const [text, setText] = useState<AmountText>({ cpu: "", memoryMiB: "" })
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [conflicts, setConflicts] = useState<Conflict[]>(NONE)
  const [confirm, setConfirm] = useState(false)
  const loaded = useRef(false)

  // The saved value fills the form once; later refreshes never overwrite what is being typed.
  useEffect(() => {
    if (settings.data && !loaded.current) {
      loaded.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the form starts from the saved value
      setText(amountToText(settings.data.TestPool))
    }
  }, [settings.data])

  async function save(allowConflicts: boolean) {
    const pool = textToAmount(text) ?? { CPUMillicores: 0, MemoryBytes: 0 }
    setBusy(true)
    setError("")
    try {
      const result = await putSettings({ TestPool: pool, ...(allowConflicts ? { AllowConflicts: true } : {}) })
      settings.setData(result.Settings)
      setConflicts(result.Conflicts ?? NONE)
      setDirty(false)
      setConfirm(false)
      toast.success(t("admin.resources.settings.saved"))
      onSaved()
    } catch (err) {
      if (!allowConflicts && isDoesNotFit(err)) setConfirm(true)
      else setError(localizedError(err))
    } finally {
      setBusy(false)
    }
  }

  const agents = capacity.data?.Agents ?? []
  return <div className="space-y-4">
    <Card>
      <CardHeader className="pb-0"><CardTitle className="flex items-center gap-1.5 text-base">{t("admin.resources.settings.testPool")}<FieldHelp text={t("admin.resources.settings.testPoolHelp")} /></CardTitle></CardHeader>
      <CardContent className="space-y-3 pt-3">
        {settings.error && settings.data === null ? <LoadError className={BLOCK} message={t("admin.resources.settings.loadError")} error={settings.error} onRetry={() => void settings.refresh(true)} />
          : settings.data === null ? <LoadingArea className={BLOCK} label={t("admin.loading")} />
          : <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void save(false) }}>
            <div className="grid max-w-md grid-cols-2 gap-3">
              <label className="space-y-1.5 text-sm font-medium">{t("admin.resources.editor.cpuMillicores")}
                <NumberInput value={text.cpu} onChange={(cpu) => { setText({ ...text, cpu }); setDirty(true) }} disabled={!canWrite || busy} /></label>
              <label className="space-y-1.5 text-sm font-medium">{t("admin.resources.editor.memoryMiB")}
                <NumberInput value={text.memoryMiB} onChange={(memoryMiB) => { setText({ ...text, memoryMiB }); setDirty(true) }} disabled={!canWrite || busy} /></label>
            </div>
            <p className="text-xs text-muted-foreground">{t("admin.resources.settings.unitHint")}</p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {conflicts.length > 0 && <ul className="space-y-1 text-sm" data-testid="settings-conflicts">{conflicts.map((conflict) => <li key={`${conflict.From}-${conflict.To}`} className="flex flex-wrap items-center gap-2"><Badge tone="danger">{t("admin.resources.conflict.pool")}</Badge><span className="tabular-nums">{formatWindow(conflict.From, conflict.To)}</span></li>)}</ul>}
            {canWrite && <Button type="submit" busy={busy} disabled={!dirty}>{t("admin.resources.settings.save")}</Button>}
          </form>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="pb-0"><CardTitle className="text-base">{t("admin.resources.settings.capacity")}</CardTitle></CardHeader>
      <CardContent className="space-y-3 pt-3">
        {capacity.error && capacity.data === null ? <LoadError className={BLOCK} message={t("admin.resources.settings.capacityError")} error={capacity.error} onRetry={() => void capacity.refresh(true)} />
          : capacity.data === null ? <LoadingArea className={BLOCK} label={t("admin.loading")} />
          : <>
            <p className="text-sm">{tRich("admin.resources.settings.totalLine", { amount: <span className="font-medium tabular-nums">{formatAmount(capacity.data.Total)}</span> })}</p>
            {(capacity.data.CPUUnlimited || capacity.data.MemoryUnlimited) && <p className="text-sm text-muted-foreground">{t("admin.resources.settings.unlimited")}</p>}
            {agents.length > 0 && <TableWrap label={t("admin.resources.settings.capacity")} rows={3}><table aria-label={t("admin.resources.settings.capacity")} className="ib-table">
              <thead><tr><Th>{t("admin.resources.col.agent")}</Th><Th>{t("admin.resources.col.capacity")}</Th><Th>{t("admin.resources.settings.deviceMax")}</Th><Th>{t("admin.resources.col.state")}</Th></tr></thead>
              <tbody>{agents.map((agent) => <tr key={agent.ID}>
                <td className="font-medium">{agent.Name}</td>
                <td>{agent.CPUUnlimited && agent.MemoryUnlimited ? t("admin.resources.settings.agentUnlimited") : formatAmount(agent.Capacity)}</td>
                <td className="ib-table__dim">{formatAmount(agent.DeviceMax)}</td>
                <td><span className="inline-flex flex-wrap gap-1.5">
                  {agent.Used ? <Badge tone="ok">{t("admin.resources.settings.used")}</Badge> : <Badge>{t(`admin.resources.settings.why.${agent.Why || "disabled"}`)}</Badge>}
                  {!agent.Connected && <Badge tone="warn">{t("admin.resources.stats.offline")}</Badge>}
                </span></td>
              </tr>)}</tbody></table></TableWrap>}
          </>}
      </CardContent>
    </Card>
    <AllowConflictsDialog open={confirm} busy={busy} error={error} onCancel={() => { setConfirm(false); setError("") }} onConfirm={() => void save(true)} />
  </div>
}
