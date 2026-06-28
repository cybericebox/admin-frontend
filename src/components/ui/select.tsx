"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/utils/cn"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Select — our styled dropdown. A native <select> under the hood (keeps keyboard
 * and mobile behaviour for free) wrapped in our chrome: frosted border/background,
 * focus ring, and a chevron affordance. Use instead of a bare <select>.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative inline-flex w-full">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-input bg-secondary/40 pl-3 pr-9 text-sm text-foreground shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
)
Select.displayName = "Select"

export { Select }
