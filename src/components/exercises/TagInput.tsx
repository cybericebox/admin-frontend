"use client"

import { useState } from "react"
import { X } from "lucide-react"

/**
 * TagInput — chip input for a list of strings (task tags, catalog filter).
 * Enter/comma/blur adds a chip, Backspace on an empty field removes the last one.
 */
export function TagInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [draft, setDraft] = useState("")

  function commit() {
    const tag = draft.trim()
    setDraft("")
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-secondary/40 px-2 py-0.5 text-xs text-foreground"
        >
          {tag}
          {!disabled && (
            <button type="button" aria-label={`remove-${tag}`} onClick={() => onChange(value.filter((x) => x !== tag))}>
              <X className="h-3 w-3 opacity-60 hover:opacity-100" />
            </button>
          )}
        </span>
      ))}
      <input
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            commit()
          }
          if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
