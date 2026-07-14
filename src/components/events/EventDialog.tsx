"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { t } from "@/i18n/t"
import { createEvent, updateEvent, type Event } from "@/api/events/catalog"
import { eventFormSchema, isoToLocal, localToIso, type EventFormValues } from "@/lib/eventSchemas"
import { eventErrorMessage } from "@/lib/eventErrors"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  event?: Event
  onSaved: (e: Event) => void
}

function toDefaults(event?: Event): EventFormValues {
  return {
    Tag: event?.Tag ?? "",
    Name: event?.Name ?? "",
    AvailableFrom: isoToLocal(event?.AvailableFrom ?? ""),
    ArchiveAt: isoToLocal(event?.ArchiveAt ?? ""),
  }
}

export function EventDialog({ open, onOpenChange, event, onSaved }: Props) {
  const isEdit = event !== undefined
  const [error, setError] = useState<string | null>(null)
  const [prevAppliedIdentity, setPrevAppliedIdentity] = useState<string | null>(null)
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: toDefaults(event),
  })
  const busy = form.formState.isSubmitting

  // Re-seed the form at render time when the dialog opens for a (possibly different) event.
  // This uses the "store previous prop" pattern to avoid react-hooks/set-state-in-effect.
  const currentIdentity = open ? (event?.ID ?? "__create__") : null
  if (currentIdentity !== prevAppliedIdentity) {
    setPrevAppliedIdentity(currentIdentity)
    if (open) {
      form.reset(toDefaults(event))
      setError(null)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    const input = {
      Tag: values.Tag,
      Name: values.Name,
      AvailableFrom: localToIso(values.AvailableFrom),
      ArchiveAt: localToIso(values.ArchiveAt),
    }
    try {
      const saved = isEdit ? await updateEvent(event.ID, input) : await createEvent(input)
      onSaved(saved)
      onOpenChange(false)
    } catch (e) {
      setError(eventErrorMessage(e))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(isEdit ? "admin.events.edit.title" : "admin.events.create.title")}</DialogTitle>
          <DialogDescription>
            {t(isEdit ? "admin.events.edit.description" : "admin.events.create.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <FormField control={form.control} name="Tag" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.events.field.tag")}</FormLabel>
                <FormControl><Input {...field} disabled={busy} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="Name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.events.field.name")}</FormLabel>
                <FormControl><Input {...field} disabled={busy} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="AvailableFrom" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.events.field.availableFrom")}</FormLabel>
                <FormControl><Input type="datetime-local" {...field} disabled={busy} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="ArchiveAt" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.events.field.archiveAt")}</FormLabel>
                <FormControl><Input type="datetime-local" {...field} disabled={busy} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                {t("admin.events.dialog.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>{t("admin.events.dialog.submit")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
