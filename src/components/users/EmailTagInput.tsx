"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/utils/cn"
import { t } from "@/i18n/t"
import { parseEmails, isValidEmail } from "@/lib/emailParse"

export type EmailChipStatus = "pending" | "invited" | "exists" | "failed"
export type EmailChip = { email: string; status: EmailChipStatus; error?: string }

interface EmailTagInputProps {
  chips: EmailChip[]
  onChange: (chips: EmailChip[]) => void
  disabled?: boolean
}

const STATUS_CLASS: Record<EmailChipStatus, string> = {
  pending: "border-border bg-secondary/60 text-foreground",
  invited: "border-[var(--ib-ok)] bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]",
  exists: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/60 bg-destructive/15 text-foreground",
}

const STATUS_OUTCOME_KEY: Partial<Record<EmailChipStatus, string>> = {
  invited: "admin.users.invite.outcome.invited",
  exists: "admin.users.invite.outcome.exists",
  failed: "admin.users.invite.outcome.failed",
}

export default function EmailTagInput({ chips, onChange, disabled }: EmailTagInputProps) {
  const [buffer, setBuffer] = useState("")
  const [hint, setHint] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function addEmails(text: string, parsed?: string[]) {
    const existing = new Set(chips.map((c) => c.email.toLowerCase()))
    const p = parsed || parseEmails(text)
    const fresh = p.filter((e) => !existing.has(e.toLowerCase()))
    if (fresh.length === 0) return
    onChange([...chips, ...fresh.map((email) => ({ email, status: "pending" as const }))])
  }

  function commitBuffer(): boolean {
    const trimmed = buffer.trim()
    if (!trimmed) return true
    const parsed = parseEmails(trimmed)
    addEmails(trimmed, parsed)
    // If nothing parsed out of a non-empty buffer, it's an invalid token: keep it.
    const parsedAnything = parsed.length > 0
    if (!parsedAnything && !isValidEmail(trimmed.toLowerCase())) {
      setHint(true)
      return false
    }
    setHint(false)
    setBuffer("")
    return true
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === " " || e.key === "Tab") {
      if (buffer.trim()) {
        e.preventDefault()
        commitBuffer()
      }
    } else if (e.key === "Backspace" && buffer === "" && chips.length > 0) {
      e.preventDefault()
      onChange(chips.slice(0, -1))
    }
  }

  function removeChip(email: string) {
    onChange(chips.filter((c) => c.email !== email))
  }

  return (
    <div>
      <div
        className={cn(
          "flex min-h-20 flex-wrap content-start gap-1.5 rounded-md border border-input bg-secondary/40 p-2",
          disabled && "opacity-50",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map((c) => (
          <span
            key={c.email}
            title={c.status === "failed" ? c.error : undefined}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
              STATUS_CLASS[c.status],
            )}
          >
            {c.email}
            {c.status !== "pending" && (
              <span className="text-[10px] uppercase tracking-wide opacity-70">
                {t(STATUS_OUTCOME_KEY[c.status]!)}
              </span>
            )}
            <button
              type="button"
              aria-label={`remove ${c.email}`}
              disabled={disabled}
              onClick={(e) => { e.stopPropagation(); removeChip(c.email) }}
              className="opacity-60 hover:opacity-100 disabled:opacity-30"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={buffer}
          disabled={disabled}
          onChange={(e) => { setBuffer(e.target.value); if (hint) setHint(false) }}
          onKeyDown={onKeyDown}
          onBlur={() => commitBuffer()}
          onPaste={(e) => {
            e.preventDefault()
            addEmails(e.clipboardData.getData("text"))
          }}
          placeholder={chips.length === 0 ? t("admin.users.invite.emailPlaceholder") : ""}
          className="min-w-[12rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-destructive">{t("admin.users.invite.invalidEmail")}</p>}
    </div>
  )
}
