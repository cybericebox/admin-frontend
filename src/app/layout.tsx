import "./globals.css"
export const metadata = { title: "CyberICEBox Admin" }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  )
}
