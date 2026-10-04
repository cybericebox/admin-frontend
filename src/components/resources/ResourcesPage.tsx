"use client"

import { useCallback, useState } from "react"
import { getStats, type Reservation } from "@/api/resourceCalendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { AlarmsTab } from "./AlarmsTab"
import { ChangeRequestsTab } from "./ChangeRequestsTab"
import { CancelReservationDialog, ReplanDialog } from "./ReservationDialogs"
import { ReservationEditor } from "./ReservationEditor"
import { SettingsTab } from "./SettingsTab"
import { StatsTab } from "./StatsTab"
import { TimelineTab } from "./TimelineTab"
import { useCalendarResource } from "./resourceView"

type Target = { eventID: string; name: string }

function Count({ value }: { value: number }) {
  return value > 0 ? <span className="ml-1.5 rounded-md bg-[var(--ib-warn-bg)] px-1.5 text-xs text-[var(--ib-warn)] tabular-nums">{value}</span> : null
}

export function ResourcesPage() {
  const { can } = useRole()
  const canWrite = can("infrastructure.write")
  const [tab, setTab] = useState("timeline")
  // Bumped after any change, so every open tab reloads.
  const [version, setVersion] = useState(0)
  const stats = useCalendarResource(getStats, true, String(version))
  const [editing, setEditing] = useState<Target | null>(null)
  const [cancelling, setCancelling] = useState<Target | null>(null)
  const [replanning, setReplanning] = useState<Reservation | null>(null)
  const changed = useCallback(() => setVersion((value) => value + 1), [])

  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold text-foreground">{t("admin.resources.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("admin.resources.subtitle")}</p></div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="timeline">{t("admin.resources.tabs.timeline")}</TabsTrigger>
        <TabsTrigger value="stats">{t("admin.resources.tabs.stats")}</TabsTrigger>
        <TabsTrigger value="requests">{t("admin.resources.tabs.requests")}<Count value={stats.data?.PendingChangeRequests ?? 0} /></TabsTrigger>
        <TabsTrigger value="alarms">{t("admin.resources.tabs.alarms")}<Count value={stats.data?.OpenAlarms ?? 0} /></TabsTrigger>
        <TabsTrigger value="settings">{t("admin.resources.tabs.settings")}</TabsTrigger>
      </TabsList>
      <TabsContent value="timeline" className="mt-5"><TimelineTab canWrite={canWrite} version={version} onEdit={setEditing} onReplan={setReplanning} onCancel={setCancelling} /></TabsContent>
      <TabsContent value="stats" className="mt-5"><StatsTab stats={stats.data} error={stats.error} onRetry={() => void stats.refresh(true)} /></TabsContent>
      <TabsContent value="requests" className="mt-5"><ChangeRequestsTab canWrite={canWrite} version={version} onDecided={changed} /></TabsContent>
      <TabsContent value="alarms" className="mt-5"><AlarmsTab canWrite={canWrite} version={version} onChanged={changed} /></TabsContent>
      <TabsContent value="settings" className="mt-5"><SettingsTab canWrite={canWrite} onSaved={changed} /></TabsContent>
    </Tabs>
    <ReservationEditor target={editing} canWrite={canWrite} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); changed() }}
      onCancelReservation={(target) => { setEditing(null); setCancelling(target) }} />
    <CancelReservationDialog target={cancelling} onCancel={() => setCancelling(null)} onDone={() => { setCancelling(null); changed() }} />
    <ReplanDialog target={replanning} onCancel={() => setReplanning(null)} onDone={() => { setReplanning(null); changed() }} />
  </div>
}
