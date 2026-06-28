import "./globals.css"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { RoleProvider } from "@/lib/useRole"
import { AdminShell } from "@/components/shell/AdminShell"

export const metadata = { title: "Cyber ICE Box Platform Admin" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="grid-bg">
        <RoleProvider>
          <AdminShell>{children}</AdminShell>
        </RoleProvider>
      </body>
    </html>
  )
}
