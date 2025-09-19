/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Important: do NOT set `output: "export"` when using Edge/WebSockets
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig;