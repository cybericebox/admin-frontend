"use client"

import { useEffect, useState } from "react"
import { sendTestNotification } from "@/api/notifications/test"
import { useNotificationTypes } from "@/components/notifications/templateTypes"
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
import { formatNotifType } from "@/utils/notifType"

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

  // Variable field state: { [Name]: value }
  const [fields, setFields] = useState<Record<string, string>>({})
  // Selected channels (defaults to all available)
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  // In-flight guard
  const [sending, setSending] = useState(false)
  // Success / error feedback
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle")

  // Seed state whenever the modal opens or the resolved type changes.
  useEffect(() => {
    if (!open) return
    const vars = matchedType?.Variables ?? []
    const seed: Record<string, string> = {}
    vars.forEach((v) => {
      seed[v.Name] = v.Default
    })
    setFields(seed)

    const availableChannels = channels ?? matchedType?.Channels ?? []
    setSelectedChannels([...availableChannels])
    setStatus("idle")
    setSending(false)
  }, [open, notificationType, matchedType, channels])

  const availableChannels = channels ?? matchedType?.Channels ?? []

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

  const variables = matchedType?.Variables ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {formatNotifType(notificationType)} {t("admin.notif.test.title")}
          </DialogTitle>
        </DialogHeader>

        {/* Channel selection */}
        {availableChannels.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">{t("admin.notif.test.channels")}</p>
            <div className="flex flex-col gap-2">
              {availableChannels.map((ch) => (
                <Checkbox
                  key={ch}
                  label={ch}
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
          <p className="text-sm text-green-600">{t("admin.notif.test.sent")}</p>
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
          <Button onClick={handleSend} disabled={sending}>
            {sending ? t("admin.notif.test.sending") : t("admin.notif.test.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
