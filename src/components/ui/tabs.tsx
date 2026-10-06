"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/utils/cn"

// DS underline tabs (components/tabs/tabs.css). Radix gives the roving tabindex, arrows, Home/End and aria-controls;
// focus follows selection (automatic activation). A tablist holds tabs only: no remove buttons inside it.
const Tabs = TabsPrimitive.Root

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  // page: page-level tabs (wider gap); vertical: settings navigation (label + caption per tab).
  variant?: "modal" | "page" | "vertical"
  // Horizontal scroll on narrow screens (default on for horizontal lists).
  scroll?: boolean
}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = "page", scroll, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "ib-tabs",
        variant === "page" && "ib-tabs--page",
        variant === "vertical" && "ib-tabs--vertical",
        variant !== "vertical" && (scroll ?? true) && "ib-tabs--scroll",
        className
      )}
      {...props}
    />
  )
)
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger ref={ref} className={className} {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("ib-tabpanel", className)} {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
