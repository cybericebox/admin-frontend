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
import { t } from "@/i18n/t"

interface RoleSelectProps {
  value: string
  onChange: (role: string) => void
  roles: string[]
  disabled?: boolean
  placeholder?: string
  className?: string
}

// Custom single-select role picker. A Radix DropdownMenu radio group under the
// hood (fully styled popup) — replaces the native <select> so the option list
// matches the rest of our custom dropdowns.
export function RoleSelect({ value, onChange, roles, disabled, placeholder, className }: RoleSelectProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("justify-between font-normal", className)}
        >
          <span className="truncate">{value ? t(`admin.role.${value}`) : (placeholder ?? "")}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {roles.map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              {t(`admin.role.${r}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
