/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Do not auto-generate AGENTS.md into the app directory during dev/build.
  agentRules: false,
};

export default nextConfig;
