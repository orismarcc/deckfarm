/**
 * Next.js Proxy (formerly middleware)
 * Runs before every matched request.
 * - Blocks obviously malicious URL patterns (injection / traversal)
 * - Enforces admin endpoint access control
 * - Adds security headers to every response
 */

import { NextRequest, NextResponse } from 'next/server'

// Patterns that should never appear in a legitimate URL
const BLOCKED_URL_PATTERNS = [
  /\.\.\//,             // path traversal
  /%2e%2e/i,            // encoded traversal
  /<script/i,           // XSS attempt in URL
  /javascript:/i,       // JS protocol
  /union\s+select/i,    // SQL injection
  /exec\s*\(/i,         // code execution
  /eval\s*\(/i,         // eval injection
  /\x00/,               // null byte injection
]

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const fullPath = pathname + search

  // 1. Block malicious URL patterns
  for (const pattern of BLOCKED_URL_PATTERNS) {
    if (pattern.test(fullPath)) {
      return new NextResponse(
        JSON.stringify({ error: 'Bad Request' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // 2. Admin endpoints: block all external access (internal-only via env gate)
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

  // 3. Continue — route handler will do further validation
  const response = NextResponse.next()

  // 4. Additional security headers (complement next.config.ts)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  )

  return response
}

export const config = {
  // Apply to all API routes and pages (exclude static files and _next internals)
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)).*)'],
}
