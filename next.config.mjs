/** @type {import('next').NextConfig} */


const nextConfig = {
    reactStrictMode: false,
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
                port: '',
            },
        ],
        minimumCacheTTL: 24 * 60 * 60,// 24 hours
    },
    output: 'standalone',
};

export default nextConfig;
