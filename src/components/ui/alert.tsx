import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils/cn"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3.5 text-sm [&>svg+div]:translate-y-[-1px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        // Neutral notification — clearly elevated above the page surface.
        default:
          "border-border bg-card text-card-foreground [&>svg]:text-foreground",
        // Semantic notifications use restrained surface tints and a uniform
        // border, without a decorative accent strip.
        info: "border-border bg-[var(--ib-soft)] text-foreground [&>svg]:text-primary",
        success:
          "border-border bg-[var(--ib-ok-bg)] text-foreground [&>svg]:text-[var(--ib-ok)]",
        warning:
          "border-border bg-[var(--ib-warn-bg)] text-foreground [&>svg]:text-[var(--ib-warn)]",
        destructive:
          "border-destructive/60 bg-destructive/15 text-foreground [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold leading-none tracking-tight text-foreground", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
