/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Do not auto-generate AGENTS.md into the app directory during dev/build.
  agentRules: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/media/:path*",
        destination: "http://localhost:4000/api/v1/media/:path*",
      },
    ];
  },
};

export default nextConfig;
