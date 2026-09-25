// All browser-facing application origins derive from the one public domain.
// Empty origin intentionally means same-origin during local development.
const domain = process.env.NEXT_PUBLIC_DOMAIN?.trim() ?? ""
export const publicDomain = domain

export const apiOrigin = domain ? `https://api.${domain}` : ""
export const idOrigin = domain ? `https://id.${domain}` : ""
export const mainOrigin = domain ? `https://${domain}` : "/"
