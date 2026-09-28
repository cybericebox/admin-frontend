"use client"

import { useState, type FormEvent } from "react"
import { apiPut } from "@/api/client"
import { eventErrorMessage } from "@/lib/eventErrors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectMenu } from "@/components/ui/select-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"

export type EventConfig = {
  EventID: string
  Participation: number | null
  Registration: number
  ScoreboardVisibility: number
  ParticipantsVisibility: number
  PreviewDescription: string
  PreviewPicture: string
  MaxTeamSize: number
  MinTeamSize: number | null
  MaxTeams: number | null
  UpdatedAt: string
}

type ConfigInput = Omit<EventConfig, "EventID" | "UpdatedAt">

const participationOptions = [
  { value: "", label: "Не налаштовано" },
  { value: "0", label: "Індивідуальна участь" },
  { value: "1", label: "Командна участь" },
]
const registrationOptions = [
  { value: "0", label: "Закрита" },
  { value: "1", label: "За підтвердженням" },
  { value: "2", label: "Відкрита" },
]
const visibilityOptions = [
  { value: "0", label: "Приховано" },
  { value: "1", label: "Лише учасникам" },
  { value: "2", label: "Публічно" },
]

function initialInput(config: EventConfig): ConfigInput {
  return {
    Participation: config.Participation,
    Registration: config.Registration,
    ScoreboardVisibility: config.ScoreboardVisibility,
    ParticipantsVisibility: config.ParticipantsVisibility,
    PreviewDescription: config.PreviewDescription ?? "",
    PreviewPicture: config.PreviewPicture ?? "",
    MaxTeamSize: config.MaxTeamSize,
    MinTeamSize: config.MinTeamSize,
    MaxTeams: config.MaxTeams,
  }
}

function nullableNumber(raw: string): number | null {
  return raw === "" ? null : Number(raw)
}

export function EventConfigDialog({ eventID, config, onClose, onSaved }: {
  eventID: string
  config: EventConfig
  onClose: () => void
  onSaved: (next: EventConfig) => void
}) {
  const [draft, setDraft] = useState<ConfigInput>(() => initialInput(config))
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const isDirty = Object.entries(initialInput(config)).some(([key, value]) => draft[key as keyof ConfigInput] !== value)

  function change<K extends keyof ConfigInput>(key: K, value: ConfigInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !isDirty) return
    setError("")
    if (!Number.isInteger(draft.MaxTeamSize) || draft.MaxTeamSize < 1 ||
      (draft.MinTeamSize !== null && (!Number.isInteger(draft.MinTeamSize) || draft.MinTeamSize < 1 || draft.MinTeamSize > draft.MaxTeamSize)) ||
      (draft.MaxTeams !== null && (!Number.isInteger(draft.MaxTeams) || draft.MaxTeams < 1))) {
      setError("Перевірте обмеження команд: значення мають бути додатними, а мінімум не більшим за максимум.")
      return
    }
    if (new TextEncoder().encode(draft.PreviewDescription.trim()).length > 1000) {
      setError("Опис картки має бути не довшим за 1000 байтів.")
      return
    }
    if (draft.PreviewPicture.trim() && !/^https:\/\/[^\s/]+/i.test(draft.PreviewPicture.trim())) {
      setError("Адреса зображення має починатися з https://.")
      return
    }
    setBusy(true)
    try {
      const next = await apiPut<EventConfig>(`/api/events/${encodeURIComponent(eventID)}/config`, {
        ...draft,
        PreviewDescription: draft.PreviewDescription.trim(),
        PreviewPicture: draft.PreviewPicture.trim(),
      })
      onSaved(next)
      toast.success("Налаштування заходу збережено.")
      onClose()
    } catch (failure) {
      toast.error(eventErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Участь і видимість</DialogTitle><DialogDescription>Налаштування реєстрації, таблиці результатів і картки заходу.</DialogDescription></DialogHeader>
      <form onSubmit={(event) => void save(event)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><label className="text-sm font-medium">Тип участі</label>{config.Participation === null ? <SelectMenu value={draft.Participation?.toString() ?? ""} onChange={(value) => change("Participation", nullableNumber(value))} options={participationOptions} ariaLabel="Тип участі" disabled={busy} className="w-full" /> : <p className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">{config.Participation === 1 ? "Командна участь" : "Індивідуальна участь"} — тип участі змінити не можна</p>}</div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Реєстрація</label><SelectMenu value={draft.Registration.toString()} onChange={(value) => change("Registration", Number(value))} options={registrationOptions} ariaLabel="Реєстрація" disabled={busy} className="w-full" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Видимість результатів</label><SelectMenu value={draft.ScoreboardVisibility.toString()} onChange={(value) => change("ScoreboardVisibility", Number(value))} options={visibilityOptions} ariaLabel="Видимість результатів" disabled={busy} className="w-full" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Видимість учасників</label><SelectMenu value={draft.ParticipantsVisibility.toString()} onChange={(value) => change("ParticipantsVisibility", Number(value))} options={visibilityOptions} ariaLabel="Видимість учасників" disabled={busy} className="w-full" /></div>
          <div className="space-y-1.5"><label htmlFor="event-min-team" className="text-sm font-medium">Мінімум учасників у команді</label><Input id="event-min-team" type="number" min="1" max={draft.MaxTeamSize} value={draft.MinTeamSize ?? ""} onChange={(event) => change("MinTeamSize", nullableNumber(event.target.value))} disabled={busy} placeholder="Без мінімуму" /></div>
          <div className="space-y-1.5"><label htmlFor="event-max-team" className="text-sm font-medium">Максимум учасників у команді</label><Input id="event-max-team" type="number" min="1" required value={draft.MaxTeamSize || ""} onChange={(event) => change("MaxTeamSize", Number(event.target.value))} disabled={busy} /></div>
          <div className="space-y-1.5"><label htmlFor="event-max-teams" className="text-sm font-medium">Ліміт команд</label><Input id="event-max-teams" type="number" min="1" value={draft.MaxTeams ?? ""} onChange={(event) => change("MaxTeams", nullableNumber(event.target.value))} disabled={busy} placeholder="Без обмеження" /></div>
        </div>
        <div className="space-y-1.5"><label htmlFor="event-preview-description" className="text-sm font-medium">Опис картки</label><textarea id="event-preview-description" value={draft.PreviewDescription} onChange={(event) => change("PreviewDescription", event.target.value)} disabled={busy} rows={3} className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary" /></div>
        <div className="space-y-1.5"><label htmlFor="event-preview-picture" className="text-sm font-medium">Зображення картки (HTTPS URL)</label><Input id="event-preview-picture" type="url" value={draft.PreviewPicture} onChange={(event) => change("PreviewPicture", event.target.value)} disabled={busy} placeholder="https://..." /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Скасувати</Button><Button type="submit" disabled={busy || !isDirty}>Зберегти налаштування</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
