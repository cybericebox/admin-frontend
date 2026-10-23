import type { EmailBodyBlock } from "@/components/notifications/editor/emailBlocks"
import type { BroadcastChannel } from "@/api/notifications/broadcasts"
import { TEMPLATE_NAME_MAX, type BroadcastTemplate, type BroadcastTemplateInput } from "@/api/notifications/broadcastTemplates"
import { t } from "@/i18n/t"

// The message of a broadcast without its audience: what the composer edits and a broadcast template saves.
export type BroadcastMessage = {
  email: boolean
  inApp: boolean
  subject: string
  preheader: string
  body: EmailBodyBlock[]
  title: string
  inAppBody: string
  link: string
}

export function emptyMessage(): BroadcastMessage {
  return { email: true, inApp: true, subject: "", preheader: "", body: [], title: "", inAppBody: "", link: "" }
}

// A rich-text block or in-app body counts as filled when it has any visible text.
export function hasBody(blocks: EmailBodyBlock[]): boolean {
  return blocks.some((block) => block.type !== "divider" && block.type !== "preset")
}

export function messageChannels(message: Pick<BroadcastMessage, "email" | "inApp">): BroadcastChannel[] {
  return [...(message.email ? ["email" as const] : []), ...(message.inApp ? ["in_app" as const] : [])]
}

// Whether the message can be sent (the audience aside): what the composer and the template editor both require.
export function messageComplete(message: BroadcastMessage): boolean {
  const emailValid = !message.email || (message.subject.trim() !== "" && hasBody(message.body))
  const inAppValid = !message.inApp || (message.title.trim() !== "" && message.inAppBody.trim() !== "")
  return messageChannels(message).length > 0 && emailValid && inAppValid
}

// The parts of the chosen channels only, as a broadcast and a template carry them.
export function messageContent(message: BroadcastMessage): Omit<BroadcastTemplateInput, "Name"> {
  return {
    Channels: messageChannels(message),
    Subject: message.email ? message.subject : "",
    Preheader: message.email ? message.preheader : "",
    EmailBody: message.email ? message.body : [],
    EmailStyling: {},
    InAppTitle: message.inApp ? message.title : "",
    InAppBody: message.inApp ? message.inAppBody : "",
    InAppLink: message.inApp ? message.link : "",
  }
}

export function templateInput(name: string, message: BroadcastMessage): BroadcastTemplateInput {
  return { Name: name.trim(), ...messageContent(message) }
}

// A saved template as composer fields: exactly its channels and texts.
export function templateMessage(template: BroadcastTemplate): BroadcastMessage {
  const channels = template.Channels ?? []
  return {
    email: channels.includes("email"), inApp: channels.includes("in_app"),
    subject: template.Subject, preheader: template.Preheader, body: template.EmailBody ?? [],
    title: template.InAppTitle, inAppBody: template.InAppBody, link: template.InAppLink,
  }
}

export function templateNameError(name: string): string {
  if (!name.trim()) return t("admin.notif.customTpl.validation.name")
  if ([...name.trim()].length > TEMPLATE_NAME_MAX) return t("admin.notif.customTpl.validation.nameLength", { max: TEMPLATE_NAME_MAX })
  return ""
}
