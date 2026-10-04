import { t } from "@/i18n/t"

const KIND_KEYS: Record<string, string> = {
  smtp_auth: "admin.notif.logs.smtp.auth",
  smtp_rcpt: "admin.notif.logs.smtp.rcpt",
  smtp_rejected: "admin.notif.logs.smtp.rejected",
  smtp_connect: "admin.notif.logs.smtp.connect",
}

export type SmtpErrorView = {
  /** The line to show: a human text for a known kind, else the raw error. */
  text: string
  /** The raw error for the «Технічні деталі» block; empty when it is already the line itself. */
  technical: string
}

/** Maps a journal error kind (+ SMTP reply code) to a human line; an unknown or empty kind keeps the raw text. */
export function smtpErrorView(kind: string | undefined, code: string | undefined, raw: string | undefined): SmtpErrorView | null {
  const rawText = raw ?? ""
  const key = kind ? KIND_KEYS[kind] : undefined
  if (kind === "smtp_other") {
    const text = code ? t("admin.notif.logs.smtp.other", { code }) : t("admin.notif.logs.smtp.otherNoCode")
    return { text, technical: rawText }
  }
  if (key) return { text: t(key), technical: rawText }
  return rawText ? { text: rawText, technical: "" } : null
}
