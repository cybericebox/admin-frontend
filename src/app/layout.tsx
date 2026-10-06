import "./globals.css"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { RoleProvider } from "@/lib/useRole"
import { AdminShell } from "@/components/shell/AdminShell"
import { ServiceStatusGate } from "@/components/ServiceStatusGate"
import { THEME_BOOT_SCRIPT } from "@/lib/theme"
import { ToastProvider } from "@/components/ui/toast"
import { APP_ROOT_ID } from "@/lib/appRoot"
import { t } from "@/i18n/t"
import { Analytics } from "@/components/consent/Analytics"

// noindex also as a meta tag: static hosts (GitHub Pages) cannot send X-Robots-Tag.
export const metadata = { title: t("meta.title"), robots: { index: false, follow: false } }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${GeistSans.variable} ${GeistMono.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} /></head>
      {/* Browser extensions can add attributes to body before React hydrates. */}
      <body className="grid-bg" suppressHydrationWarning>
        {/* the outage overlay dims and inerts this root; it stays rendered */}
        <div id={APP_ROOT_ID}>
          <RoleProvider>
            <ToastProvider><AdminShell>{children}</AdminShell></ToastProvider>
          </RoleProvider>
        </div>
        <ServiceStatusGate />
        {/* the consent panel is always mounted («Налаштування файлів cookie»); GA loads only when configured */}
        <Analytics gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} />
      </body>
    </html>
  )
}
