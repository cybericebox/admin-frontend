"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/utils/cn"
import { t } from "@/i18n/t"
import { isValidEmail } from "@/lib/emailParse"
import { roleLabel } from "@/lib/roles"
import type { Role } from "@/lib/useRole"
import { HoverTooltip } from "@/components/ui/hover-tooltip"

export type EmailChipStatus = "pending" | "invalid" | "invited" | "exists" | "failed"
export type EmailChip = { email: string; status: EmailChipStatus; error?: string; firstName?: string; lastName?: string; role?: Role }

interface EmailTagInputProps {
  chips: EmailChip[]
  onChange: (chips: EmailChip[]) => void
  disabled?: boolean
  id?: string
  describedBy?: string
}

const STATUS_CLASS: Record<EmailChipStatus, string> = {
  pending: "border-border bg-secondary/60 text-foreground",
  invalid: "border-destructive bg-destructive/15 text-destructive",
  invited: "border-[var(--ib-ok)] bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]",
  exists: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/60 bg-destructive/15 text-foreground",
}

const STATUS_OUTCOME_KEY: Partial<Record<EmailChipStatus, string>> = {
  invited: "admin.users.invite.outcome.invited",
  exists: "admin.users.invite.outcome.exists",
  failed: "admin.users.invite.outcome.failed",
}

// Typing or pasting splits on comma, semicolon, spaces and newlines.
const SEPARATOR = /[\s,;]+/

// addChips appends addresses as chips: repeats (case-insensitive) are skipped
// but may fill names/role the chip lacks; invalid addresses stay as red chips.
export function addChips(chips: EmailChip[], entries: Array<Pick<EmailChip, "email" | "firstName" | "lastName" | "role">>): EmailChip[] {
  const next = [...chips]
  const index = new Map(next.map((chip, position) => [chip.email, position]))
  for (const entry of entries) {
    const email = entry.email.trim().toLowerCase()
    if (!email) continue
    const position = index.get(email)
    if (position !== undefined) {
      const chip = next[position]
      next[position] = { ...chip, firstName: chip.firstName || entry.firstName, lastName: chip.lastName || entry.lastName, role: chip.role ?? entry.role }
      continue
    }
    index.set(email, next.length)
    next.push({ email, status: isValidEmail(email) ? "pending" : "invalid", firstName: entry.firstName, lastName: entry.lastName, role: entry.role })
  }
  return next
}

function chipTitle(chip: EmailChip): string | undefined {
  if (chip.status === "invalid") return t("admin.users.invite.invalidEmail")
  if (chip.status === "failed") return chip.error
  const name = `${chip.firstName ?? ""} ${chip.lastName ?? ""}`.trim()
  const parts = [name, chip.role ? roleLabel(chip.role) : ""].filter(Boolean)
  return parts.length ? parts.join(" · ") : undefined
}

// The hint (name, role or error) covers only the label, so the remove button keeps its own focus and name.
function ChipLabel({ chip }: { chip: EmailChip }) {
  const label = <span className="inline-flex items-center gap-1">
    {chip.email}
    {STATUS_OUTCOME_KEY[chip.status] && (
      <span className="text-2xs uppercase tracking-wide opacity-70">{t(STATUS_OUTCOME_KEY[chip.status]!)}</span>
    )}
  </span>
  const hint = chipTitle(chip)
  return hint ? <HoverTooltip text={hint}>{label}</HoverTooltip> : label
}

// Gmail-style address input: separators and paste turn text into chips,
// Backspace in the empty input removes the last chip.
export default function EmailTagInput({ chips, onChange, disabled, id, describedBy }: EmailTagInputProps) {
  const [buffer, setBuffer] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const invalid = chips.some((chip) => chip.status === "invalid")

  function commit(text: string) {
    const emails = text.split(SEPARATOR).filter(Boolean)
    if (emails.length) onChange(addChips(chips, emails.map((email) => ({ email }))))
  }

  function change(value: string) {
    const parts = value.split(SEPARATOR)
    if (parts.length > 1) {
      commit(parts.slice(0, -1).join(" "))
      setBuffer(parts[parts.length - 1])
    } else setBuffer(value)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    if ((e.key === "Enter" || e.key === "Tab") && buffer.trim()) {
      e.preventDefault()
      commit(buffer)
      setBuffer("")
    } else if (e.key === "Backspace" && buffer === "" && chips.length > 0) {
      e.preventDefault()
      onChange(chips.slice(0, -1))
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-20 flex-wrap content-start gap-1.5 rounded-md border border-input bg-card p-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40",
        invalid && "border-destructive",
        disabled && "opacity-50",
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map((c) => (
        <span
          key={c.email}
          className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs", STATUS_CLASS[c.status])}
        >
          <ChipLabel chip={c} />
          <button
            type="button"
            aria-label={t("admin.users.invite.removeChip", { email: c.email })}
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onChange(chips.filter((chip) => chip.email !== c.email)) }}
            className="opacity-60 hover:opacity-100 disabled:opacity-30"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="email"
        autoComplete="off"
        value={buffer}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => { if (buffer.trim()) { commit(buffer); setBuffer("") } }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text")
          if (!SEPARATOR.test(text)) return
          e.preventDefault()
          commit(`${buffer}${text}`)
          setBuffer("")
        }}
        placeholder={chips.length === 0 ? t("admin.users.invite.emailPlaceholder") : ""}
        className="min-w-[12rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground outline-none placeholder:text-placeholder"
      />
    </div>
  )
}
