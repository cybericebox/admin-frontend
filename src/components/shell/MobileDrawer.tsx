"use client"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { t } from "@/i18n/t"
import { Sidebar } from "./Sidebar"

// The navigation on narrow screens is a modal dialog (Radix): focus moves in and is trapped, Esc and the backdrop close it,
// focus returns to the menu button. The desktop sidebar is not mounted at the same time, so there is one navigation landmark.
export function MobileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ib-overlay-in fixed inset-0 z-50 bg-[var(--ib-backdrop)]" />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 h-dvh w-fit max-w-[calc(100vw-3rem)] outline-none">
          <DialogPrimitive.Title className="sr-only">{t("admin.shell.navLabel")}</DialogPrimitive.Title>
          <Sidebar onClose={() => onOpenChange(false)} onNavigate={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
