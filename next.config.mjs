/** @type {import('next').NextConfig} */

// Static export for id-frontend (identity / auth portal).
// - output: 'export' produces the `out/` directory for static hosting.
// - images.unoptimized: true is required when using static export (no server-side image optimization).
// - trailingSlash: true keeps paths clean for static hosting and consistent with query-param routing.
// Dev-only: served through the nginx edge on the real domain (not localhost),
// so Next's dev resources (fonts, HMR) are cross-origin and blocked by default.
// Allow the platform domain + subdomains, derived from NEXT_PUBLIC_DOMAIN.
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN;

const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  allowedDevOrigins: DOMAIN ? [DOMAIN, `*.${DOMAIN}`] : [],
};

export default nextConfig;
