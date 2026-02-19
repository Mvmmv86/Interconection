/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy backend API requests (not /api/defi/* which are local Next.js routes)
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8002/api/v1/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Fix for @wagmi/connectors missing @base-org/account
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@base-org/account': false,
    };

    // Handle node modules that have issues with webpack
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },
  // Transpile packages that need it
  transpilePackages: ['@solana/wallet-adapter-base', '@solana/wallet-adapter-react'],
};

export default nextConfig;
