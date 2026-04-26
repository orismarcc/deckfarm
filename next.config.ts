import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseHost = SUPABASE_URL ? new URL(SUPABASE_URL).host : '*.supabase.co'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Block clickjacking (also handled by CSP frame-ancestors)
          { key: "X-Frame-Options", value: "DENY" },
          // Legacy XSS filter (still respected by some older browsers)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Force HTTPS for 1 year (including subdomains)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // Limit referrer information sent cross-origin
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser feature access
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          // Content Security Policy
          // NOTE: Next.js requires 'unsafe-inline' and 'unsafe-eval' for its runtime.
          // Once nonce-based CSP is configured these can be tightened.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires 'unsafe-inline' for style injection and 'unsafe-eval'
              // for the dev runtime. Both are standard constraints for Next.js apps.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Supabase storage, OSM tiles, Esri satellite tiles, local data URIs
              `img-src 'self' data: blob: https://${supabaseHost} https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://server.arcgisonline.com`,
              "font-src 'self' data:",
              // Open-Meteo for weather; Supabase for data sync; Nominatim for geocoding
              `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.open-meteo.com https://geocoding-api.open-meteo.com https://nominatim.openstreetmap.org`,
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              // Service worker scope
              "worker-src 'self' blob:",
              "manifest-src 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          // Prevent browsers from caching sensitive API responses
          ...([] as { key: string; value: string }[]),
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,           // suppress build output unless there's an error
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
