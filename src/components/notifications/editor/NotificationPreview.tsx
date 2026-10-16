"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { t } from "@/i18n/t"
import { EmailPreview, type EmailPreviewProps } from "./EmailPreview"
import { InAppPreview, type InAppPreviewProps } from "./InAppPreview"

/** The same channel switcher for templates and broadcasts. Disabled channels are absent. */
export function NotificationPreview({ email, inApp }: { email?: EmailPreviewProps; inApp?: InAppPreviewProps }) {
  const channels = [...(email ? ["email"] : []), ...(inApp ? ["inbox", "toast"] : [])]
  const [selected, setSelected] = useState("email")
  const active = channels.includes(selected) ? selected : channels[0]
  if (!active) return null
  return <Tabs value={active} onValueChange={setSelected} className="min-w-0">
    <TabsList variant="modal" aria-label={t("admin.notif.preview.tabs")}>
      {channels.map((channel) => <TabsTrigger key={channel} value={channel}>{t(`admin.notif.preview.${channel}`)}</TabsTrigger>)}
    </TabsList>
    {email && <TabsContent value="email" forceMount hidden={active !== "email"}><EmailPreview {...email} /></TabsContent>}
    {inApp && <>
      <TabsContent value="inbox"><InAppPreview {...inApp} surface="inbox" /></TabsContent>
      <TabsContent value="toast"><InAppPreview {...inApp} surface="toast" /></TabsContent>
    </>}
  </Tabs>
}
