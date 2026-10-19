import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils/cn"
import { CREST_SRC } from "@/components/brand/Logo"
import "./spinner.css"

const buttonVariants = cva(
  "admin-tap inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[var(--ib-action-hover)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--ib-danger)_88%,var(--ib-ink))] active:bg-[color-mix(in_srgb,var(--ib-danger)_80%,var(--ib-ink))]",
        outline:
          "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// A button that can be busy must say what it is doing (AGENTS.md «Busy buttons show the operation»): `busyLabel` is
// required whenever `busy` is passed, in the present tense («Зберігаємо…»).
type BusyProps = { busy?: false; busyLabel?: string } | { busy: boolean; busyLabel: string }

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> &
  BusyProps & {
    asChild?: boolean
  }

// The crest of a busy button: decorative, the busy label names the operation. Idle, an empty box of the same size
// keeps the hidden busy face as wide as when it shows.
function BusyMark({ idle }: { idle?: boolean }) {
  if (idle) return <span aria-hidden="true" className="mr-2 inline-block h-[1em] shrink-0 aspect-[375/368] text-[20px]" />
  return <span aria-hidden="true" className="crest-loader crest-loader-sm mr-2 shrink-0">
    {/* eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized images */}
    <img src={CREST_SRC} alt="" />
  </span>
}

// While busy the button is disabled and shows the crest with the operation in place of its icon and label. Both faces
// share one grid cell, so the button keeps the width of the wider one and never jumps; the hidden face stays out of
// the accessible name.
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, busy = false, busyLabel, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        {...props}
      >
        {asChild || busyLabel === undefined ? children : (
          <span className="inline-grid min-w-0 max-w-full items-center justify-items-center">
            <span className={cn("col-start-1 row-start-1 inline-flex min-w-0 max-w-full items-center justify-center gap-[inherit]", busy && "invisible")} aria-hidden={busy || undefined}>{children}</span>
            <span className={cn("col-start-1 row-start-1 inline-flex min-w-0 max-w-full items-center justify-center", !busy && "invisible")} aria-hidden={!busy || undefined}>
              <BusyMark idle={!busy} />{busyLabel}
            </span>
          </span>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
