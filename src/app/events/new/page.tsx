"use client"

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react"
import Link from "next/link"
import { createEvent, getInfrastructureAvailable, listEventManagers, type Event, type EventManager } from "@/api/events/catalog"
import { EventManagersCard } from "@/components/events/EventManagersCard"
import { Button } from "@/components/ui/button"
import { LoadError } from "@/components/ui/load-error"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { FieldHelp } from "@/components/ui/field-help"
import { Input } from "@/components/ui/input"
import { eventErrorMessage } from "@/lib/eventErrors"
import { eventFormSchema, localToIso, type EventFormValues } from "@/lib/eventSchemas"
import { publicDomain } from "@/lib/origins"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"
import { toast } from "@/components/ui/toast"

const subscribeToHost = () => () => {}
const currentDomain = () => publicDomain || window.location.hostname.replace(/^(admin|www)\./i, "")
const serverDomain = () => publicDomain

export default function NewEventPage() {
  const domain = useSyncExternalStore(subscribeToHost, currentDomain, serverDomain)
  const { can } = useRole()
  const [draft, setDraft] = useState<EventFormValues>({ Name: "", Tag: "", AvailableFrom: "", ArchiveAt: "" })
  const [created, setCreated] = useState<Event | null>(null)
  const [managers, setManagers] = useState<EventManager[]>([])
  const [managersError, setManagersError] = useState<{ cause: unknown } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [infrastructure, setInfrastructure] = useState(true)
  // null = unknown (no infrastructure.read or the status request failed):
  // keep the choice enabled and let the backend validate it.
  const [infrastructureAvailable, setInfrastructureAvailable] = useState<boolean | null>(null)
  const canReadInfrastructure = can("infrastructure.read")

  useEffect(() => {
    if (!canReadInfrastructure) return
    let active = true
    getInfrastructureAvailable().then((available) => {
      if (!active) return
      setInfrastructureAvailable(available)
      if (!available) setInfrastructure(false)
    }).catch(() => {})
    return () => { active = false }
  }, [canReadInfrastructure])

  async function refreshManagers(eventID: string) {
    try {
      setManagers(await listEventManagers(eventID))
      setManagersError(null)
    } catch (cause) {
      setManagersError({ cause })
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = eventFormSchema.safeParse(draft)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? t("admin.events.err.generic"))
      return
    }
    setBusy(true)
    setError("")
    try {
      const saved = await createEvent({
        Name: draft.Name,
        Tag: draft.Tag,
        AvailableFrom: localToIso(draft.AvailableFrom),
        ArchiveAt: draft.ArchiveAt ? localToIso(draft.ArchiveAt) : null,
        InfrastructureAllowed: infrastructure,
      })
      setCreated(saved)
      toast.success(t("admin.events.create.created"))
      await refreshManagers(saved.ID)
    } catch (cause) {
      toast.error(eventErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!can("events.write")) return <p role="alert" className="text-sm text-destructive">{t("admin.events.create.forbidden")}</p>

  return <div className="w-full space-y-5">
    <div>
      <Link href="/events" className="text-sm text-primary hover:underline">← {t("admin.events.back")}</Link>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">{t("admin.events.create.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(created ? "admin.events.create.createdNext" : "admin.events.create.description")}</p>
    </div>
    {!created ? <Card><CardContent className="pt-5">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label htmlFor="new-event-name" className="text-sm font-medium">{t("admin.events.field.name")} <span className="text-destructive" aria-hidden="true">*</span></label><FieldHelp text={t("admin.events.field.nameHelp")} /></div><Input id="new-event-name" value={draft.Name} onChange={(event) => setDraft({ ...draft, Name: event.target.value })} required disabled={busy} /></div>
        <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label htmlFor="new-event-tag" className="text-sm font-medium">{t("admin.events.field.tag")} <span className="text-destructive" aria-hidden="true">*</span></label><FieldHelp text={t("admin.events.field.tagHelp")} /></div><div className="flex h-10 min-w-0 items-center overflow-hidden rounded-md border border-border bg-card text-sm text-foreground focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40"><span className="shrink-0 pl-3 text-muted-foreground">https://</span><Input id="new-event-tag" value={draft.Tag} onChange={(event) => setDraft({ ...draft, Tag: event.target.value })} autoComplete="off" spellCheck={false} placeholder="tag" required disabled={busy} className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 font-mono shadow-none focus-visible:border-0 focus-visible:ring-0" />{domain && <span className="shrink-0 pr-3 font-mono text-muted-foreground">.{domain}</span>}</div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label className="text-sm font-medium">{t("admin.events.field.availableFrom")} <span className="text-destructive" aria-hidden="true">*</span></label><FieldHelp text={t("admin.events.field.availableFromHelp")} /></div><DateTimePicker value={draft.AvailableFrom} onChange={(value) => setDraft({ ...draft, AvailableFrom: value })} aria-label={t("admin.events.field.availableFrom")} disabled={busy} /></div>
          <div className="space-y-1.5"><div className="flex items-center gap-1.5"><label className="text-sm font-medium">{t("admin.events.field.archiveAt")}</label><FieldHelp text={t("admin.events.field.archiveAtHelp")} /></div><DateTimePicker value={draft.ArchiveAt} onChange={(value) => setDraft({ ...draft, ArchiveAt: value })} aria-label={t("admin.events.field.archiveAt")} allowClear disabled={busy} /></div>
        </div>
        <div className="space-y-1.5"><div className="flex items-center gap-1.5"><div className="flex items-center gap-2"><Switch id="new-event-infrastructure" checked={infrastructure} onCheckedChange={setInfrastructure} disabled={busy || infrastructureAvailable === false} /><label htmlFor="new-event-infrastructure" className="text-sm leading-snug cursor-pointer select-none">{t("admin.events.field.infrastructure")}</label></div><FieldHelp text={t("admin.events.field.infrastructureHelp")} /></div>{infrastructureAvailable === false && <p className="text-xs text-muted-foreground">{t("admin.events.field.infrastructureUnavailable")}</p>}</div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button asChild type="button" variant="outline"><Link href="/events">{t("admin.events.dialog.cancel")}</Link></Button><Button type="submit" busy={busy} disabled={!draft.Name.trim() || !draft.Tag.trim() || !draft.AvailableFrom}>{t("admin.events.dialog.submit")}</Button></div>
      </form>
    </CardContent></Card> : <>
      {managersError ? <Card><CardContent className="pt-5"><LoadError message={t("admin.events.access.loadError")} error={managersError.cause} onRetry={() => void refreshManagers(created.ID)} /></CardContent></Card> : <EventManagersCard eventID={created.ID} managers={managers} editable onChanged={(manager) => setManagers((current) => current.some((item) => item.UserID === manager.UserID) ? current.map((item) => item.UserID === manager.UserID ? manager : item) : [...current, manager])} onRemoved={(userID) => setManagers((current) => current.filter((item) => item.UserID !== userID))} />}
      <div className="flex justify-end"><Button asChild><Link href={`/events/detail?id=${encodeURIComponent(created.ID)}`}>{t("admin.events.create.finish")}</Link></Button></div>
    </>}
  </div>
}
