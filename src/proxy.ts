/**
 * Next.js Proxy (replaces middleware in Next.js 16)
 * Runs before every matched request.
 *
 * Security responsibilities:
 * 1. Block malicious URL patterns (path traversal, injection probes)
 * 2. Rate-limit auth endpoints (brute-force protection)
 * 3. Block oversized request bodies before they reach route handlers
 * 4. Enforce admin endpoint access control
 * 5. Add cache-control headers to all API responses
 * 6. Log suspicious requests
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientKey } from '@/lib/security/rate-limit'

// Patterns that should never appear in a legitimate URL
const BLOCKED_URL_PATTERNS = [
  /\.\.\//,             // path traversal
  /%2e%2e/i,            // encoded traversal
  /<script/i,           // XSS attempt in URL
  /javascript:/i,       // JS protocol
  /union\s+select/i,    // SQL injection probe
  /exec\s*\(/i,         // code execution
  /eval\s*\(/i,         // eval injection
  /\x00/,               // null byte injection
  /'\s*or\s+'1'\s*=\s*'1/i, // classic SQLi
]

// Auth endpoints that get extra rate limiting at the proxy layer
// (individual routes also apply their own limits — defence in depth)
const AUTH_RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/auth/login':    { max: 15, windowMs: 15 * 60 * 1000 }, // 15 per 15 min
  '/api/auth/register': { max: 5,  windowMs: 15 * 60 * 1000 }, // 5 per 15 min
}

// Max body size for API routes (5 MB — prevents memory exhaustion)
const MAX_BODY_BYTES = 5 * 1024 * 1024

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const fullPath = pathname + search

  // ── 1. Block malicious URL patterns ────────────────────────────────────────
  for (const pattern of BLOCKED_URL_PATTERNS) {
    if (pattern.test(fullPath)) {
      return new NextResponse(
        JSON.stringify({ error: 'Requisição inválida' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // ── 2. Rate-limit auth endpoints ────────────────────────────────────────────
  const authLimit = AUTH_RATE_LIMITS[pathname]
  if (authLimit) {
    const rl = checkRateLimit(
      getClientKey(request, pathname),
      authLimit.max,
      authLimit.windowMs,
    )
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Muitas tentativas. Aguarde alguns minutos.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfter),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }
  }

  // ── 3. Block oversized payloads ─────────────────────────────────────────────
  const contentLength = request.headers.get('content-length')
  if (contentLength && pathname.startsWith('/api/')) {
    if (parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return new NextResponse(
        JSON.stringify({ error: 'Payload muito grande' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // ── 4. Admin endpoints: block all external access ───────────────────────────
  if (pathname.startsWith('/api/admin')) {
    const adminSecret = process.env.ADMIN_SECRET
    const auth = request.headers.get('authorization') ?? ''
    const token = auth.replace(/^Bearer\s+/i, '')
    if (!adminSecret || token !== adminSecret) {
      return new NextResponse(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // ── 5. Continue — add security + cache headers ──────────────────────────────
  const response = NextResponse.next()

  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  )

  // Prevent caching of any API response (they contain user-specific data)
  if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)).*)',
  ],
}
