/** @type {import('next').NextConfig} */


const nextConfig = {
    reactStrictMode: false,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
                port: '',
            },
        ],
    },
    output: 'standalone',
};

export default nextConfig;
