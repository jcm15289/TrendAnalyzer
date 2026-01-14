import type {NextConfig} from 'next';

// Set build timestamp and version at build time
const BUILD_TIMESTAMP = new Date().toISOString();
const BUILD_VERSION = process.env.npm_package_version || '0.1.0';

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_BUILD_TIMESTAMP: BUILD_TIMESTAMP,
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
