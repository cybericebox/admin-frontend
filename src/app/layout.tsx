import "./globals.css"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { RoleProvider } from "@/lib/useRole"
import { AdminShell } from "@/components/shell/AdminShell"
import { ServiceStatusGate } from "@/components/ServiceStatusGate"
import { THEME_BOOT_SCRIPT } from "@/lib/theme"
import { ToastProvider } from "@/components/ui/toast"

// noindex also as a meta tag: static hosts (GitHub Pages) cannot send X-Robots-Tag.
export const metadata = { title: "Cyber ICE Box Platform Admin", robots: { index: false, follow: false } }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} /></head>
      {/* Browser extensions can add attributes to body before React hydrates. */}
      <body className="grid-bg" suppressHydrationWarning>
        <RoleProvider>
          <ToastProvider><AdminShell>{children}</AdminShell></ToastProvider>
        </RoleProvider>
        <ServiceStatusGate />
      </body>
    </html>
  )
}
