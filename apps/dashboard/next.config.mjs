/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@caterlog/storefront-blocks", "@caterlog/shared"],
  // Do not auto-generate AGENTS.md into the app directory during dev/build.
  agentRules: false,
  async rewrites() {
    const backendUrl = process.env.API_BASE_URL || "http://127.0.0.1:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/webhooks/:path*",
        destination: `${backendUrl}/webhooks/:path*`,
      },
      {
        source: "/og/:path*",
        destination: `${backendUrl}/og/:path*`,
      },
    ];
  },
};

export default nextConfig;
