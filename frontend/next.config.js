/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8085",
        pathname: "/uploads/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: "/api/auth/:path*",
      },
      {
        source: "/api/:path*",
        destination: "http://localhost:8085/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
