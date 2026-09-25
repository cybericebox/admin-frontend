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

  return (
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
  )
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
  // In-flight guard
  const [sending, setSending] = useState(false)
  // Success / error feedback
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle")

  const toggleChannel = (ch: string) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  const handleSend = async () => {
    setSending(true)
    setStatus("idle")
    try {
      await sendTestNotification({
        Type: notificationType,
        Channels: selectedChannels,
        Variables: fields,
        ...(templateId ? { TemplateID: templateId } : {}),
      })
      setStatus("sent")
    } catch {
      setStatus("error")
    } finally {
      setSending(false)
    }
  }

  return (
    <>

        {/* Channel selection */}
        {availableChannels.length > 0 && (
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

        {/* Variable inputs */}
        {variables.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">{t("admin.notif.test.variables")}</p>
            <div className="flex flex-col gap-3">
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
            </div>
          </div>
        )}

        {/* Status feedback */}
        {status === "sent" && (
          <p className="text-sm text-primary">{t("admin.notif.test.sent")}</p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive">{t("admin.notif.test.error")}</p>
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
