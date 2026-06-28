import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils/cn"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3.5 text-sm shadow-sm [&>svg+div]:translate-y-[-1px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        // Neutral notification — clearly elevated above the page surface.
        default:
          "border-border bg-card text-card-foreground [&>svg]:text-foreground",
        // Semantic notifications — saturated tint + strong left accent bar so
        // each reads punchy and separates clearly from the page.
        info: "border-[#1CA8E8]/55 border-l-4 border-l-[#1CA8E8] bg-[#1CA8E8]/15 text-foreground [&>svg]:text-[#1CA8E8]",
        success:
          "border-[#34E5C0]/55 border-l-4 border-l-[#34E5C0] bg-[#34E5C0]/15 text-foreground [&>svg]:text-[#34E5C0]",
        warning:
          "border-[#FFB020]/60 border-l-4 border-l-[#FFB020] bg-[#FFB020]/15 text-foreground [&>svg]:text-[#FFB020]",
        destructive:
          "border-destructive/60 border-l-4 border-l-destructive bg-destructive/15 text-foreground [&>svg]:text-destructive",
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
