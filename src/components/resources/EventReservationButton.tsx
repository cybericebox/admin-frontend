"use client"

import { useState } from "react"
import { CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { CancelReservationDialog } from "./ReservationDialogs"
import { ReservationEditor } from "./ReservationEditor"

/** On the event card: opens the resource reservation editor of this event. */
export function EventReservationButton({ eventID, name }: { eventID: string; name: string }) {
  const { can } = useRole()
  const [editing, setEditing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  if (!can("infrastructure.read")) return null
  const target = { eventID, name }
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}><CalendarClock className="mr-2 h-4 w-4" aria-hidden />{t("admin.resources.editor.open")}</Button>
    <ReservationEditor target={editing ? target : null} canWrite={can("infrastructure.write")} onClose={() => setEditing(false)} onSaved={() => setEditing(false)}
      onCancelReservation={() => { setEditing(false); setCancelling(true) }} />
    <CancelReservationDialog target={cancelling ? target : null} onCancel={() => setCancelling(false)} onDone={() => setCancelling(false)} />
  </>
}
