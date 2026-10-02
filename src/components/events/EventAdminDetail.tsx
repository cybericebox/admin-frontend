"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { getEvent, listEventManagers, setEventInfrastructure, updateEvent, type Event, type EventManager } from "@/api/events/catalog"
import { EventAnalyticsTab } from "@/components/events/EventAnalyticsTab"
import { EventManagersCard } from "@/components/events/EventManagersCard"
import { EventSiteLink } from "@/components/events/EventSiteLink"
import { EventReservationButton } from "@/components/resources/EventReservationButton"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { FieldHelp } from "@/components/ui/field-help"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Input } from "@/components/ui/input"
import { LoadingArea } from "@/components/ui/spinner"
import { LoadError } from "@/components/ui/load-error"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import { eventErrorMessage } from "@/lib/eventErrors"
import { eventFormSchema, isoToLocal, localToIso } from "@/lib/eventSchemas"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"

function formOf(event: Event) {
  return {
    Name: event.Name,
    Tag: event.Tag,
    AvailableFrom: isoToLocal(event.AvailableFrom),
    ArchiveAt: isoToLocal(event.ArchiveAt),
  }
}

export function EventAdminDetail({ id, initialTab }: { id: string; initialTab?: string | null }) {
  const { can, me } = useRole()
  const [tab, setTab] = useState(initialTab === "analytics" ? "analytics" : "overview")

  // The tab lives in the address (?tab=analytics), so the way back from the event site lands on it.
  function changeTab(next: string) {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === "overview") url.searchParams.delete("tab")
    else url.searchParams.set("tab", next)
    window.history.replaceState(window.history.state, "", url)
  }
  const [event, setEvent] = useState<Event | null>(null)
  const [managers, setManagers] = useState<EventManager[]>([])
  const [draft, setDraft] = useState<ReturnType<typeof formOf> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<{ cause: unknown } | null>(null)
  const [managersLoading, setManagersLoading] = useState(true)
  const [managersError, setManagersError] = useState<{ cause: unknown } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [infraTarget, setInfraTarget] = useState<boolean | null>(null)
  const [infraBusy, setInfraBusy] = useState(false)
  const [infraError, setInfraError] = useState("")

  const load = useCallback(async () => {
    try {
      const record = await getEvent(id)
      setEvent(record)
      setDraft(formOf(record))
      setLoadError(null)
    } catch (cause) {
      setLoadError({ cause })
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadManagers = useCallback(async () => {
    try {
      setManagers(await listEventManagers(id))
      setManagersError(null)
    } catch (cause) {
      setManagersError({ cause })
    } finally {
      setManagersLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let active = true
    getEvent(id)
      .then((record) => {
        if (!active) return
        setEvent(record)
        setDraft(formOf(record))
        setLoadError(null)
      })
      .catch((cause) => { if (active) setLoadError({ cause }) })
      .finally(() => { if (active) setLoading(false) })
    listEventManagers(id)
      .then((memberships) => {
        if (!active) return
        setManagers(memberships)
        setManagersError(null)
      })
      .catch((cause) => { if (active) setManagersError({ cause }) })
      .finally(() => { if (active) setManagersLoading(false) })
    return () => { active = false }
  }, [id])

  function retryEvent() {
    setLoading(true)
    setLoadError(null)
    void load()
  }

  function retryManagers() {
    setManagersLoading(true)
    void loadManagers()
  }

  // The raw attempts journal is for the event's assigned write moderators only (owner or manager).
  const canOpenJournal = Boolean(me?.ID && managers.some((manager) => manager.UserID === me.ID && (manager.Role === 0 || manager.Role === 1)))
  const writable = can("events.write") && event?.Status !== "archived"
  const isDirty = Boolean(event && draft && Object.entries(formOf(event)).some(([key, value]) => draft[key as keyof typeof draft] !== value))

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!event || !draft || !writable || !isDirty || saving) return
    setSaveError("")
    const result = eventFormSchema.safeParse(draft)
    if (!result.success) {
      setSaveError(result.error.issues[0]?.message ?? t("admin.events.err.generic"))
      return
    }
    setSaving(true)
    try {
      const next = await updateEvent(event.ID, {
        Name: draft.Name,
        Tag: draft.Tag,
        AvailableFrom: localToIso(draft.AvailableFrom),
        ArchiveAt: draft.ArchiveAt ? localToIso(draft.ArchiveAt) : null,
      })
      setEvent(next)
      setDraft(formOf(next))
      toast.success(t("admin.events.details.saved"))
    } catch (error) {
      toast.error(eventErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const published = Boolean(event && event.Status !== "archived" && (event.LifecycleStatus ?? "not_published") !== "not_published")
  const infraEditable = writable && !published
  const infraLockReason = !can("events.write") ? t("admin.events.infra.noRights") : event?.Status === "archived" || published ? t("admin.events.infra.locked") : ""

  async function confirmInfrastructure() {
    if (!event || infraTarget === null || infraBusy) return
    setInfraBusy(true)
    setInfraError("")
    try {
      const next = await setEventInfrastructure(event.ID, infraTarget)
      setEvent((current) => current ? { ...current, InfrastructureAllowed: next.InfrastructureAllowed, UpdatedAt: next.UpdatedAt } : next)
      toast.success(t(infraTarget ? "admin.events.infra.savedOn" : "admin.events.infra.savedOff"))
      setInfraTarget(null)
    } catch (error) {
      setInfraError(eventErrorMessage(error))
    } finally {
      setInfraBusy(false)
    }
  }

  if (loading && id) return <LoadingArea className="h-full" label={t("admin.loading")} />
  if (!id || loadError || !event || !draft) return <LoadError message={t("admin.events.loadError")} error={loadError?.cause} onRetry={id ? retryEvent : undefined} className="h-full" />

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Link className="text-sm text-primary hover:underline" href="/events">← {t("admin.events.back")}</Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{event.Name || event.Tag}</h1>
        <div className="mt-1"><EventSiteLink tag={event.Tag} /></div>
      </div>
      <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{t(`admin.events.lifecycle.${event.Status === "archived" ? "archived" : event.Status === "pending" ? "not_available" : event.LifecycleStatus ?? "not_published"}`)}</span>
    </div>

    <Tabs value={tab} onValueChange={changeTab}>
    <TabsList aria-label={t("admin.events.tabs.label")}>
      <TabsTrigger value="overview">{t("admin.events.tabs.overview")}</TabsTrigger>
      <TabsTrigger value="analytics">{t("admin.events.tabs.analytics")}</TabsTrigger>
    </TabsList>
    <TabsContent value="overview" className="mt-5 space-y-5">
    <Card><CardContent className="pt-5">
      <div className="mb-4"><h2 className="text-base font-semibold text-foreground">{t("admin.events.details.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("admin.events.details.description")}</p></div>
      <form className="space-y-4" onSubmit={(e) => void save(e)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label htmlFor="event-name" className="text-sm font-medium">{t("admin.events.field.name")} <span className="text-destructive" aria-hidden="true">*</span></label><FieldHelp text={t("admin.events.field.nameHelp")} /></div><Input id="event-name" value={draft.Name} onChange={(e) => setDraft({ ...draft, Name: e.target.value })} required disabled={!writable || saving} /></div>
          <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label htmlFor="event-tag" className="text-sm font-medium">{t("admin.events.field.tag")} <span className="text-destructive" aria-hidden="true">*</span></label><FieldHelp text={t("admin.events.field.tagHelp")} /></div><Input id="event-tag" value={draft.Tag} onChange={(e) => setDraft({ ...draft, Tag: e.target.value })} required disabled={!writable || saving} /></div>
          <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label className="text-sm font-medium">{t("admin.events.field.availableFrom")} <span className="text-destructive" aria-hidden="true">*</span></label><FieldHelp text={t("admin.events.field.availableFromHelp")} /></div><DateTimePicker value={draft.AvailableFrom} onChange={(value) => setDraft({ ...draft, AvailableFrom: value })} aria-label={t("admin.events.field.availableFrom")} disabled={!writable || saving} /></div>
          <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label className="text-sm font-medium">{t("admin.events.field.archiveAt")}</label><FieldHelp text={t("admin.events.field.archiveAtHelp")} /></div><DateTimePicker value={draft.ArchiveAt} onChange={(value) => setDraft({ ...draft, ArchiveAt: value })} aria-label={t("admin.events.field.archiveAt")} allowClear disabled={!writable || saving} /></div>
        </div>
        <div className="flex items-center gap-1.5" data-testid="event-infrastructure">
          {infraEditable
            ? <Switch id="event-infrastructure" checked={Boolean(event.InfrastructureAllowed)} onCheckedChange={(next) => { setInfraError(""); setInfraTarget(next) }} disabled={saving} />
            : <HoverTooltip text={infraLockReason}><span className="inline-flex"><Switch id="event-infrastructure" checked={Boolean(event.InfrastructureAllowed)} onCheckedChange={() => undefined} disabled /></span></HoverTooltip>}
          <label htmlFor="event-infrastructure" className="cursor-pointer select-none text-sm font-medium">{t("admin.events.field.infrastructure")}</label>
          <FieldHelp text={t("admin.events.field.infrastructureHelp")} />
        </div>
        {event.InfrastructureAllowed && <div className="flex items-center gap-3" data-testid="event-reservation"><EventReservationButton eventID={event.ID} name={event.Name} /></div>}
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        {writable && <div className="flex justify-end"><Button type="submit" busy={saving} disabled={!isDirty}>{t("admin.events.dialog.submit")}</Button></div>}
      </form>
    </CardContent></Card>

    {managersLoading ? <LoadingArea label={t("admin.loading")} /> : managersError ? <Card><CardContent className="pt-5"><LoadError message={t("admin.events.access.loadError")} error={managersError.cause} onRetry={retryManagers} /></CardContent></Card> : <EventManagersCard
      eventID={event.ID}
      managers={managers}
      editable={can("events.write")}
      onChanged={(manager) => setManagers((current) => current.some((item) => item.UserID === manager.UserID) ? current.map((item) => item.UserID === manager.UserID ? manager : item) : [...current, manager])}
      onRemoved={(userID) => setManagers((current) => current.filter((item) => item.UserID !== userID))}
    />}
    </TabsContent>
    <TabsContent value="analytics" className="mt-5">
      <EventAnalyticsTab eventID={event.ID} tag={event.Tag} canOpenJournal={canOpenJournal} />
    </TabsContent>
    </Tabs>

    <ConfirmDialog
      open={infraTarget !== null}
      onCancel={() => setInfraTarget(null)}
      title={t(infraTarget ? "admin.events.infra.confirmOnTitle" : "admin.events.infra.confirmOffTitle")}
      description={t(infraTarget ? "admin.events.infra.confirmOnDescription" : "admin.events.infra.confirmOffDescription")}
      confirmLabel={t(infraTarget ? "admin.events.infra.confirmOn" : "admin.events.infra.confirmOff")}
      busy={infraBusy}
      error={infraError}
      onConfirm={() => void confirmInfrastructure()}
    />
  </div>
}
