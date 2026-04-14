import type { NextConfig } from "next";

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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://${supabaseHost}`,
              "font-src 'self' data:",
              `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
