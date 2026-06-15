/** @type {import('next').NextConfig} */

// Static export for id-frontend (identity / auth portal).
// - output: 'export' produces the `out/` directory for static hosting.
// - images.unoptimized: true is required when using static export (no server-side image optimization).
// - trailingSlash: true keeps paths clean for static hosting and consistent with query-param routing.
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
