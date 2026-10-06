"use client"

import { useCallback, useMemo, useState } from "react"
import { listEventsPage } from "@/api/events/catalog"
import { getStats, type Reservation } from "@/api/resourceCalendar"
import { PageHeader } from "@/components/ui/page-header"
import { useUrlState } from "@/lib/useUrlState"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { AlarmsTab } from "./AlarmsTab"
import { ChangeRequestsTab } from "./ChangeRequestsTab"
import { CancelReservationDialog, ReplanDialog } from "./ReservationDialogs"
import { NeedsReservationTab, eventsNeedingReservation } from "./NeedsReservationTab"
import { ReservationEditor } from "./ReservationEditor"
import { SettingsTab } from "./SettingsTab"
import { StatsTab } from "./StatsTab"
import { TimelineTab } from "./TimelineTab"
import { useCalendarResource } from "./resourceView"

const TABS = ["timeline", "stats", "needs", "requests", "alarms", "settings"]

type Target = { eventID: string; name: string }

function Count({ value }: { value: number }) {
  return value > 0 ? <Badge tone="warn" size="sm" className="ml-1.5 tabular-nums">{value}</Badge> : null
}

export function ResourcesPage() {
  const { can } = useRole()
  const canWrite = can("infrastructure.write")
  const [url, setUrl] = useUrlState({ tab: "timeline" })
  const tab = TABS.includes(url.tab) ? url.tab : "timeline"
  const setTab = (value: string) => setUrl({ tab: value })
  // Bumped after any change, so every open tab reloads.
  const [version, setVersion] = useState(0)
  const stats = useCalendarResource(getStats, true, String(version))
  const allEvents = useCalendarResource(() => listEventsPage({ page: 1, pageSize: 200, sortBy: "updated", sortDir: "desc" }), true, String(version))
  const needing = useMemo(() => {
    if (!allEvents.data || !stats.data) return null
    return eventsNeedingReservation(allEvents.data.Items, new Set((stats.data.Events ?? []).map((event) => event.EventID)))
  }, [allEvents.data, stats.data])
  const [editing, setEditing] = useState<Target | null>(null)
  const [cancelling, setCancelling] = useState<Target | null>(null)
  const [replanning, setReplanning] = useState<Reservation | null>(null)
  const changed = useCallback(() => setVersion((value) => value + 1), [])

  return <div className="space-y-5">
    <PageHeader title={t("admin.nav.resources")} sub={t("admin.resources.subtitle")} />
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="h-auto flex-wrap justify-start" aria-label={t("admin.resources.tabsLabel")}>
        <TabsTrigger value="timeline">{t("admin.resources.tabs.timeline")}</TabsTrigger>
        <TabsTrigger value="stats">{t("admin.resources.tabs.stats")}</TabsTrigger>
        <TabsTrigger value="needs">{t("admin.resources.tabs.needs")}<Count value={needing?.length ?? 0} /></TabsTrigger>
        <TabsTrigger value="requests">{t("admin.resources.tabs.requests")}<Count value={stats.data?.PendingChangeRequests ?? 0} /></TabsTrigger>
        <TabsTrigger value="alarms">{t("admin.resources.tabs.alarms")}<Count value={stats.data?.OpenAlarms ?? 0} /></TabsTrigger>
        <TabsTrigger value="settings">{t("admin.resources.tabs.settings")}</TabsTrigger>
      </TabsList>
      <TabsContent value="timeline" className="mt-5"><TimelineTab canWrite={canWrite} version={version} onEdit={setEditing} onReplan={setReplanning} onCancel={setCancelling} /></TabsContent>
      <TabsContent value="stats" className="mt-5"><StatsTab stats={stats.data} error={stats.error} onRetry={() => void stats.refresh(true)} /></TabsContent>
      <TabsContent value="needs" className="mt-5"><NeedsReservationTab events={needing} error={allEvents.error ?? stats.error} onRetry={() => { void allEvents.refresh(true); void stats.refresh(true) }}
        canRead={can("infrastructure.read")} onEdit={setEditing} /></TabsContent>
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
