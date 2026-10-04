import type { EmailBodyBlock } from "@/components/notifications/editor/emailBlocks"
import { latestEmailTemplates } from "@/api/notifications/emailTemplates"
import { latestInAppTemplates } from "@/api/notifications/inAppTemplates"
import { BROADCAST_VARIABLES } from "@/api/notifications/broadcasts"
import { notifTypeLabel } from "@/utils/notifType"

// A published template of one notification type, per channel: what a broadcast can start from.
export type BroadcastTemplate = {
  type: string
  label: string
  email?: { subject: string; preheader: string; body: EmailBodyBlock[] }
  inApp?: { title: string; body: string; link: string }
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
export function unsupportedVariables(texts: string[]): string[] {
  const found = new Set<string>()
  for (const text of texts) for (const match of text.matchAll(TOKEN)) if (!SUPPORTED.includes(match[1])) found.add(match[1])
  return [...found]
}

// The text as a recipient would get it: variables the broadcast cannot fill come out empty.
export function withoutUnsupported(text: string): string {
  return text.replace(TOKEN, (token, name: string) => (SUPPORTED.includes(name) ? token : ""))
}

export function withoutUnsupportedBlocks(blocks: EmailBodyBlock[]): EmailBodyBlock[] {
  return JSON.parse(withoutUnsupported(JSON.stringify(blocks))) as EmailBodyBlock[]
}
