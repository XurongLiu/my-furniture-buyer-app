/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets the dev server accept requests that arrive through an ngrok
  // tunnel instead of only from localhost. Free-tier ngrok assigns a new
  // random subdomain each session, so this needs updating when that changes.
  allowedDevOrigins: ["woozy-saline-fossil.ngrok-free.dev"],
};

module.exports = nextConfig;
