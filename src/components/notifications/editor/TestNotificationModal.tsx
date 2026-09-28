"use client"

import { useState } from "react"
import { sendTestNotification } from "@/api/notifications/test"
import { useNotificationTypes, type NotifType } from "@/components/notifications/templateTypes"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { t } from "@/i18n/t"
import { notifChannelLabel, notifTypeLabel } from "@/utils/notifType"
import { toast } from "@/components/ui/toast"

// ── Props ─────────────────────────────────────────────────────────────────────

export type TestNotificationModalProps = {
  open: boolean
  onClose: () => void
  notificationType: string
  /** Override the candidate channel set. Defaults to the type's own Channels. */
  channels?: string[]
  /** Pin the test to a specific template ID (forwarded as TemplateID). */
  templateId?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TestNotificationModal({
  open,
  onClose,
  notificationType,
  channels,
  templateId,
}: TestNotificationModalProps) {
  const types = useNotificationTypes()
  const matchedType = types.find((type) => type.Type === notificationType)
  const availableChannels = channels ?? matchedType?.Channels ?? []

  return <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {notifTypeLabel(notificationType)} {t("admin.notif.test.title")}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <TestNotificationSession
            key={`${notificationType}:${matchedType ? "ready" : "pending"}`}
            notificationType={notificationType}
            variables={matchedType?.Variables ?? []}
            availableChannels={availableChannels}
            templateId={templateId}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  </>
}

function TestNotificationSession({
  notificationType,
  variables,
  availableChannels,
  templateId,
  onClose,
}: {
  notificationType: string
  variables: NotifType["Variables"]
  availableChannels: string[]
  templateId?: string
  onClose: () => void
}) {

  // Variable field state: { [Name]: value }
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((variable) => [variable.Name, variable.Default])))
  // Selected channels (defaults to all available)
  const [selectedChannels, setSelectedChannels] = useState<string[]>(() => [...availableChannels])
  const [showVariables, setShowVariables] = useState(false)
  // In-flight guard
  const [sending, setSending] = useState(false)

  const toggleChannel = (ch: string) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  const handleSend = async () => {
    setSending(true)
    onClose()
    try {
      await sendTestNotification({
        Type: notificationType,
        Channels: selectedChannels,
        Variables: fields,
        ...(templateId ? { TemplateID: templateId } : {}),
      })
      if (selectedChannels.includes("in_app")) {
        window.dispatchEvent(new Event("cybericebox:inbox-updated"))
      }
      toast.success("Тестове сповіщення надіслано.")
    } catch {
      toast.error(t("admin.notif.test.error"))
    } finally {
      setSending(false)
    }
  }

  return (
    <>

        {/* Channel selection */}
        {availableChannels.length > 1 && (
          <div>
            <p className="text-sm font-medium mb-2">{t("admin.notif.test.channels")}</p>
            <div className="flex flex-col gap-2">
              {availableChannels.map((ch) => (
                <Checkbox
                  key={ch}
                  label={notifChannelLabel(ch)}
                  checked={selectedChannels.includes(ch)}
                  onChange={() => toggleChannel(ch)}
                />
              ))}
            </div>
          </div>
        )}
        {availableChannels.length === 1 && (
          <p className="text-sm text-muted-foreground">{notifChannelLabel(availableChannels[0])}</p>
        )}

        {/* Variable inputs */}
        {variables.length > 0 && (
          <div>
            <button type="button" aria-expanded={showVariables} onClick={() => setShowVariables((value) => !value)} className="text-sm font-medium text-primary hover:underline">
              {t("admin.notif.test.variables")} ({variables.length})
            </button>
            {showVariables && <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {variables.map((v) => (
                <div key={v.Name}>
                  <label className="block text-sm font-medium mb-1">{v.Name}</label>
                  {v.Description && (
                    <p className="text-xs text-muted-foreground mb-1">{v.Description}</p>
                  )}
                  <Input
                    value={fields[v.Name] ?? ""}
                    onChange={(e) =>
                      setFields((prev) => ({ ...prev, [v.Name]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>
              {t("admin.notif.test.close")}
            </Button>
          </DialogClose>
          <Button onClick={handleSend} disabled={sending || selectedChannels.length === 0}>
            {sending ? t("admin.notif.test.sending") : t("admin.notif.test.send")}
          </Button>
        </DialogFooter>
    </>
  )
}
