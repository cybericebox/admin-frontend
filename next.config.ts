import type { NextConfig } from "next"

// Static export for the admin portal.
// Every host comes from env; a missing one fails the build (and `next dev`).
const REQUIRED = [
  "NEXT_PUBLIC_MAIN_HOST",
  "NEXT_PUBLIC_API_HOST",
  "NEXT_PUBLIC_ID_HOST",
  "NEXT_PUBLIC_ADMIN_HOST",
  "NEXT_PUBLIC_EXERCISES_HOST",
  "NEXT_PUBLIC_EVENT_DOMAIN",
]
const missing = REQUIRED.filter((name) => !process.env[name]?.trim())
if (missing.length) throw new Error(`Missing required env: ${missing.join(", ")}`)

// Dev-only: DEV_ALLOWED_ORIGINS (comma list of hosts) when set, otherwise the configured hosts and event sites.
const devOrigins = process.env.DEV_ALLOWED_ORIGINS
  ? process.env.DEV_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [
      ...REQUIRED.filter((name) => name !== "NEXT_PUBLIC_EVENT_DOMAIN").map((name) => process.env[name]!.trim()),
      process.env.NEXT_PUBLIC_EVENT_DOMAIN!.trim(),
      `*.${process.env.NEXT_PUBLIC_EVENT_DOMAIN!.trim()}`,
    ]

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  images: {
    unoptimized: true,
  },
  // Keep URLs slashless and avoid browser-cached 308 slash redirects.
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: [...new Set(devOrigins)],
}

export default nextConfig
