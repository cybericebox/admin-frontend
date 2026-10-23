import type { EmailBodyBlock } from "@/components/notifications/editor/emailBlocks"
import { latestEmailTemplates } from "@/api/notifications/emailTemplates"
import { latestInAppTemplates } from "@/api/notifications/inAppTemplates"
import { BROADCAST_VARIABLES } from "@/api/notifications/broadcasts"
import { inspectTemplate } from "@/components/notifications/editor/variableUtils"
import { notifTypeLabel } from "@/utils/notifType"
import type { BroadcastTemplate as SavedTemplate } from "@/api/notifications/broadcastTemplates"
import { templateMessage, type BroadcastMessage } from "./broadcastMessage"

// What a broadcast can start from: a saved broadcast template («saved», exactly its channels) or the published
// template of one notification type, per channel («signal», only turns its channels on).
export type BroadcastTemplate = {
  type: string
  label: string
  kind?: "saved" | "signal"
  email?: { subject: string; preheader: string; body: EmailBodyBlock[] }
  inApp?: { title: string; body: string; link: string }
}

// The saved platform broadcast templates, by name.
export function savedBroadcastTemplates(records: SavedTemplate[]): BroadcastTemplate[] {
  return records.map((record) => {
    const message = templateMessage(record)
    return {
      type: `saved:${record.ID}`, label: record.Name, kind: "saved" as const,
      ...(message.email ? { email: { subject: message.subject, preheader: message.preheader, body: message.body } } : {}),
      ...(message.inApp ? { inApp: { title: message.title, body: message.inAppBody, link: message.link } } : {}),
    }
  }).sort((a, b) => a.label.localeCompare(b.label, "uk"))
}

// The message with the template applied: a saved template sets exactly its channels, a signal template turns on its own.
export function withTemplate(current: BroadcastMessage, template: BroadcastTemplate): BroadcastMessage {
  const next = { ...current }
  if (template.kind === "saved") { next.email = !!template.email; next.inApp = !!template.inApp }
  if (template.email) Object.assign(next, { email: true, subject: template.email.subject, preheader: template.email.preheader, body: template.email.body })
  if (template.inApp) Object.assign(next, { inApp: true, title: template.inApp.title, inAppBody: template.inApp.body, link: template.inApp.link })
  return next
}

// Published email and in-app templates of the platform, one entry per notification type.
export async function loadBroadcastTemplates(): Promise<BroadcastTemplate[]> {
  const [emails, inApps] = await Promise.all([latestEmailTemplates(), latestInAppTemplates()])
  const byType = new Map<string, BroadcastTemplate>()
  const entry = (type: string) => {
    let found = byType.get(type)
    if (!found) { found = { type, label: notifTypeLabel(type) }; byType.set(type, found) }
    return found
  }
  for (const item of emails) {
    if (item.Published) entry(item.NotificationType).email = { subject: item.Published.Subject, preheader: item.Published.Preheader, body: item.Published.Body }
  }
  for (const item of inApps) {
    if (item.Published) entry(item.NotificationType).inApp = { title: item.Published.Title, body: item.Published.Body, link: item.Published.Link }
  }
  return [...byType.values()].sort((a, b) => a.label.localeCompare(b.label, "uk"))
}

const TOKEN = /\{\{\s*\.?\s*([A-Za-z_]\w*)\s*\}\}/g
const SUPPORTED: readonly string[] = BROADCAST_VARIABLES

// Variable names used in the texts that a broadcast cannot fill, in order of first use.
export function unsupportedVariables(values: unknown[]): string[] {
  return inspectTemplate(values).variables.filter((name) => !SUPPORTED.includes(name))
}

// The text as a recipient would get it: variables the broadcast cannot fill come out empty.
export function withoutUnsupported(text: string): string {
  return text.replace(TOKEN, (token, name: string) => (SUPPORTED.includes(name) ? token : ""))
}

export function withoutUnsupportedBlocks(blocks: EmailBodyBlock[]): EmailBodyBlock[] {
  return JSON.parse(withoutUnsupported(JSON.stringify(blocks))) as EmailBodyBlock[]
}
