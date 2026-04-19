const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  register: true,
  // Disable in dev to avoid stale SW during local development
  disable: process.env.NODE_ENV === "development",
  // Auto-update: when a new SW is deployed, clients pick it up on next visit
  reloadOnOnline: true,
  // Forzar que el nou SW s'activi immediatament (evita cachés velles que petaven)
  skipWaiting: true,
  clientsClaim: true,
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
