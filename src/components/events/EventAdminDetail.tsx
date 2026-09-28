"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { getEvent, listEventManagers, updateEvent, type Event, type EventManager } from "@/api/events/catalog"
import { EventManagersCard } from "@/components/events/EventManagersCard"
import { EventSiteLink } from "@/components/events/EventSiteLink"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { FieldHelp } from "@/components/ui/field-help"
import { Input } from "@/components/ui/input"
import { LoadingArea } from "@/components/ui/spinner"
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

export function EventAdminDetail({ id }: { id: string }) {
  const { can } = useRole()
  const [event, setEvent] = useState<Event | null>(null)
  const [managers, setManagers] = useState<EventManager[]>([])
  const [draft, setDraft] = useState<ReturnType<typeof formOf> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [managersLoading, setManagersLoading] = useState(true)
  const [managersError, setManagersError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const load = useCallback(async () => {
    try {
      const record = await getEvent(id)
      setEvent(record)
      setDraft(formOf(record))
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadManagers = useCallback(async () => {
    try {
      setManagers(await listEventManagers(id))
      setManagersError(false)
    } catch {
      setManagersError(true)
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
        setLoadError(false)
      })
      .catch(() => { if (active) setLoadError(true) })
      .finally(() => { if (active) setLoading(false) })
    listEventManagers(id)
      .then((memberships) => {
        if (!active) return
        setManagers(memberships)
        setManagersError(false)
      })
      .catch(() => { if (active) setManagersError(true) })
      .finally(() => { if (active) setManagersLoading(false) })
    return () => { active = false }
  }, [id])

  function retryEvent() {
    setLoading(true)
    setLoadError(false)
    void load()
  }

  function retryManagers() {
    setManagersLoading(true)
    void loadManagers()
  }

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

  if (loading && id) return <LoadingArea className="h-full" label={t("admin.loading")} />
  if (!id || loadError || !event || !draft) return <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{t("admin.events.loadError")}</p><Button variant="outline" onClick={retryEvent} disabled={!id}>{t("admin.events.access.retry")}</Button></div>

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Link className="text-sm text-primary hover:underline" href="/events">← {t("admin.events.back")}</Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{event.Name || event.Tag}</h1>
        <div className="mt-1"><EventSiteLink tag={event.Tag} /></div>
      </div>
      <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{t(`admin.events.lifecycle.${event.Status === "archived" ? "archived" : event.Status === "pending" ? "not_available" : event.LifecycleStatus ?? "not_published"}`)}</span>
    </div>

    <Card><CardContent className="pt-5">
      <div className="mb-4"><h2 className="text-base font-semibold text-foreground">{t("admin.events.details.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("admin.events.details.description")}</p></div>
      <form className="space-y-4" onSubmit={(e) => void save(e)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label htmlFor="event-name" className="text-sm font-medium">{t("admin.events.field.name")} <span className="text-destructive" aria-hidden="true">*</span></label><FieldHelp text={t("admin.events.field.nameHelp")} /></div><Input id="event-name" value={draft.Name} onChange={(e) => setDraft({ ...draft, Name: e.target.value })} required disabled={!writable || saving} /></div>
          <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label htmlFor="event-tag" className="text-sm font-medium">{t("admin.events.field.tag")} <span className="text-destructive" aria-hidden="true">*</span></label><FieldHelp text={t("admin.events.field.tagHelp")} /></div><Input id="event-tag" value={draft.Tag} onChange={(e) => setDraft({ ...draft, Tag: e.target.value })} required disabled={!writable || saving} /></div>
          <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label className="text-sm font-medium">{t("admin.events.field.availableFrom")} <span className="text-destructive" aria-hidden="true">*</span></label><FieldHelp text={t("admin.events.field.availableFromHelp")} /></div><DateTimePicker value={draft.AvailableFrom} onChange={(value) => setDraft({ ...draft, AvailableFrom: value })} aria-label={t("admin.events.field.availableFrom")} disabled={!writable || saving} /></div>
          <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label className="text-sm font-medium">{t("admin.events.field.archiveAt")}</label><FieldHelp text={t("admin.events.field.archiveAtHelp")} /></div><DateTimePicker value={draft.ArchiveAt} onChange={(value) => setDraft({ ...draft, ArchiveAt: value })} aria-label={t("admin.events.field.archiveAt")} allowClear disabled={!writable || saving} /></div>
        </div>
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        {writable && <div className="flex justify-end"><Button type="submit" disabled={saving || !isDirty}>{t("admin.events.dialog.submit")}</Button></div>}
      </form>
    </CardContent></Card>

    {managersLoading ? <LoadingArea label={t("admin.loading")} /> : managersError ? <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5"><p role="alert" className="text-sm text-destructive">{t("admin.events.access.loadError")}</p><Button variant="outline" onClick={retryManagers}>{t("admin.events.access.retry")}</Button></CardContent></Card> : <EventManagersCard
      eventID={event.ID}
      managers={managers}
      editable={can("events.write")}
      onChanged={(manager) => setManagers((current) => current.some((item) => item.UserID === manager.UserID) ? current.map((item) => item.UserID === manager.UserID ? manager : item) : [...current, manager])}
      onRemoved={(userID) => setManagers((current) => current.filter((item) => item.UserID !== userID))}
    />}
  </div>
}
