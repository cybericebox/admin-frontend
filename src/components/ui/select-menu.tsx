"use client"

import { ChevronDown } from "lucide-react"
import { cn } from "@/utils/cn"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"

export interface SelectMenuOption {
  value: string
  label: string
}

interface SelectMenuProps {
  value: string
  onChange: (value: string) => void
  options: SelectMenuOption[]
  disabled?: boolean
  placeholder?: string
  className?: string
}

// Generic custom single-select. A Radix DropdownMenu radio group under the hood
// (fully styled popup) — use where a native <select>'s default option list is
// undesirable. Option-agnostic: pass any {value,label}[].
export function SelectMenu({ value, onChange, options, disabled, placeholder, className }: SelectMenuProps) {
  const selected = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("justify-between font-normal", className)}
        >
          <span className="truncate">{selected ? selected.label : (placeholder ?? "")}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
