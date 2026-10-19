"use client"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { t } from "@/i18n/t"
import { Sidebar } from "./Sidebar"

// The navigation on narrow screens (AGENTS.md «Mobile menu»): an overlay that opens under the header (the site banners and
// the top bar stay in place, the top bar's menu button turns into «close»), never pushes the page, and the page behind does
// not scroll. It is a modal dialog (Radix): focus moves in and is trapped, Esc, a tap outside or a link closes it, focus
// returns to the menu button. `top` is the bottom edge of the header in px. The desktop sidebar is not mounted at the same
// time, so there is one navigation landmark.
export function MobileDrawer({ open, onOpenChange, top }: { open: boolean; onOpenChange: (open: boolean) => void; top: number }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-testid="menu-backdrop" style={{ top }} className="ib-overlay-in fixed inset-x-0 bottom-0 z-50 bg-[var(--ib-backdrop)]" />
        <DialogPrimitive.Content aria-describedby={undefined} style={{ top }} className="fixed bottom-0 left-0 z-50 w-fit max-w-[calc(100vw-3rem)] overscroll-contain outline-none">
          <DialogPrimitive.Title className="sr-only">{t("admin.shell.navLabel")}</DialogPrimitive.Title>
          <Sidebar onNavigate={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
