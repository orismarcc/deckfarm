/**
 * In-memory rate limiter (sliding window counter).
 * Effective per serverless instance — a global rate limit
 * would require Redis/Upstash. For brute-force protection
 * on auth endpoints this is sufficient.
 */

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

// Cleanup stale entries every 10 minutes to avoid memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 10 * 60 * 1000)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter: number // seconds until window resets
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 }
  }

  entry.count++
  const allowed = entry.count <= maxRequests
  const remaining = Math.max(0, maxRequests - entry.count)
  const retryAfter = allowed ? 0 : Math.ceil((entry.resetAt - now) / 1000)

  return { allowed, remaining, retryAfter }
}

/**
 * Extracts a stable key from the request IP.
 * Supports Vercel's x-forwarded-for header.
 */
export function getClientKey(request: Request, suffix: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = (forwarded ? forwarded.split(',')[0] : realIp ?? 'unknown').trim()
  return `${ip}:${suffix}`
}
